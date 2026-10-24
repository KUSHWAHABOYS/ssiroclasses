// INKFIX: Transactional Conversions and Invariant Checks (Part B)
import { Stroke, annotationStore } from '../draw/annotationStore';
import { smartInkInspector } from './inspector';

export interface TransactionResult {
  success: boolean;
  conversionId: string;
  error?: string;
}

/**
 * Calculates a positive metric representing total visible ink/shapes/text on canvas.
 */
export function calculateVisibleInkMetric(strokes: Stroke[]): number {
  let metric = 0;
  for (const s of strokes) {
    if (s.replacedBy) continue; // Hidden from canvas

    if (s.tool === 'text') {
      // Text metric: length of text and bounding box perimeter
      const textLen = (s.text || '').trim().length;
      const b = s.box || { width: 40, height: 20 };
      metric += Math.max(10, textLen * 10 + b.width + b.height);
    } else if (s.shapeType || s.tool === 'arrow') {
      // Shape / arrow metric: bounding diagonal or stroke length
      if (s.startPoint && s.endPoint) {
        const dx = s.endPoint.x - s.startPoint.x;
        const dy = s.endPoint.y - s.startPoint.y;
        metric += Math.max(20, Math.sqrt(dx * dx + dy * dy));
      } else {
        metric += 50;
      }
    } else {
      // Freehand stroke metric: number of points and total length
      const pts = s.points || [];
      if (pts.length > 0) {
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
          const dx = pts[i].x - pts[i - 1].x;
          const dy = pts[i].y - pts[i - 1].y;
          len += Math.sqrt(dx * dx + dy * dy);
        }
        metric += Math.max(5, pts.length + len);
      }
    }
  }
  return metric;
}

/**
 * Validates that all coordinates and dimensions in replacement strokes are finite,
 * plausible, and within reasonable stage bounds.
 */
export function validateReplacementStrokes(
  replacements: Stroke[],
  stageWidth = 3840,
  stageHeight = 2160
): boolean {
  if (!replacements || replacements.length === 0) return false;

  const margin = 500;
  const minX = -margin;
  const maxX = stageWidth + margin;
  const minY = -margin;
  const maxY = stageHeight + margin;

  for (const s of replacements) {
    // Tool and color check
    if (!s.id || !s.tool || !s.color) return false;

    // Text stroke validation
    if (s.tool === 'text') {
      if (!s.text || typeof s.text !== 'string' || s.text.trim().length === 0) {
        return false;
      }
      if (!s.box) return false;
      const { x, y, width, height } = s.box;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        return false;
      }
      if (width <= 0 || height <= 0 || x < minX || x > maxX || y < minY || y > maxY) {
        return false;
      }
    }

    // Shape / Arrow stroke validation
    if (s.shapeType || s.tool === 'arrow') {
      if (!s.startPoint || !s.endPoint) return false;
      const { x: sx, y: sy } = s.startPoint;
      const { x: ex, y: ey } = s.endPoint;
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(ex) || !Number.isFinite(ey)) {
        return false;
      }
      if (sx < minX || sx > maxX || sy < minY || sy > maxY || ex < minX || ex > maxX || ey < minY || ey > maxY) {
        return false;
      }
      // Check that start and end are not degenerate identical points
      const dist = Math.hypot(ex - sx, ey - sy);
      if (dist < 2 && !s.shapeType) return false;
    }

    // Freehand replacement points check (e.g. smoothed lines/highlighters)
    if (s.points && s.points.length > 0) {
      for (const p of s.points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
        if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) return false;
      }
    }
  }

  return true;
}

export class InkTransaction {
  readonly conversionId: string;
  readonly rawStrokes: Stroke[];

  constructor(rawStrokes: Stroke[]) {
    this.conversionId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.rawStrokes = [...rawStrokes];
  }

  /**
   * Executes transactional conversion:
   * 1. Runs builder function
   * 2. Validates replacement
   * 3. Synchronously replaces raw strokes with replacement strokes in annotationStore
   * 4. Invariant assertion: Visible ink is never zeroed or reduced to nothing
   * 5. Rolls back on any failure or invariant violation
   */
  async execute(
    builder: () => Promise<Stroke[] | null>,
    stageWidth = 3840,
    stageHeight = 2160
  ): Promise<TransactionResult> {
    const rawIds = this.rawStrokes.map((s) => s.id);
    const strokesBefore = annotationStore.getAllStrokes ? annotationStore.getAllStrokes() : annotationStore.getStrokes();
    const metricBefore = calculateVisibleInkMetric(strokesBefore);

    try {
      // Step 1: Build replacements (waits for geometry or AI)
      const replacements = await builder();

      if (!replacements || replacements.length === 0) {
        // Safe no-op: raw strokes remain visible exactly as drawn
        return { success: false, conversionId: this.conversionId, error: 'No replacement generated' };
      }

      // Step 2: Validate replacements
      const isValid = validateReplacementStrokes(replacements, stageWidth, stageHeight);
      if (!isValid) {
        throw new Error('Replacement geometry or text failed validation check');
      }

      // Tag replacements with conversionId
      for (const rep of replacements) {
        rep.conversionId = this.conversionId;
      }

      // Step 3: Synchronous commit in annotationStore
      annotationStore.commitConversion(this.conversionId, rawIds, replacements);

      // Step 4: Invariant check (visible ink must NEVER disappear)
      const strokesAfter = annotationStore.getAllStrokes ? annotationStore.getAllStrokes() : annotationStore.getStrokes();
      const metricAfter = calculateVisibleInkMetric(strokesAfter);

      if (metricBefore > 0 && metricAfter <= 0) {
        // INVARIANT VIOLATION: visible ink vanished!
        console.error('INK INVARIANT VIOLATION: visible ink reduced to 0! Rolling back conversion.');
        annotationStore.rollbackConversion(this.conversionId);
        smartInkInspector.recordDecision({
          tool: this.rawStrokes[0]?.tool || 'pen',
          strokeCount: this.rawStrokes.length,
          features: { metricBefore, metricAfter },
          classScores: {},
          branchTaken: 'transaction_rollback',
          aiCalled: false,
          latencyMs: 0,
          result: 'rolled_back',
          reason: 'Invariant violation: visible ink metric reduced to zero'
        });
        return { success: false, conversionId: this.conversionId, error: 'Invariant violation: visible ink zeroed' };
      }

      return { success: true, conversionId: this.conversionId };
    } catch (err: any) {
      // Step 5: Roll back on any error
      console.warn('Smart Ink Transaction failed, rolling back to raw ink:', err.message);
      annotationStore.rollbackConversion(this.conversionId);
      smartInkInspector.recordDecision({
        tool: this.rawStrokes[0]?.tool || 'pen',
        strokeCount: this.rawStrokes.length,
        features: {},
        classScores: {},
        branchTaken: 'transaction_exception_rollback',
        aiCalled: false,
        latencyMs: 0,
        result: 'rolled_back',
        reason: err.message || 'Transaction error'
      });
      return { success: false, conversionId: this.conversionId, error: err.message };
    }
  }
}
