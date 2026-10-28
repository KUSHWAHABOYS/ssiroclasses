import { ActiveTool, ShapeType, store } from '../state/store';
import { layerManager } from '../core/layers';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

// INKFIX: Extended shape types for Smart Ink auto-beautified shapes
export type ExtendedShapeType = ShapeType | 'square' | 'ellipse' | 'triangle' | 'diamond' | 'double_arrow' | 'arrow';

export interface Stroke {
  id: string;
  tool: ActiveTool;
  color: string;
  size: number;
  alpha: number;
  points: Point[];
  shapeType?: ShapeType | ExtendedShapeType;
  startPoint?: Point;
  endPoint?: Point;
  text?: string;
  box?: { x: number; y: number; width: number; height: number };
  timestamp: number;
  // INKFIX: Transactional Smart Ink fields
  replacedBy?: string; // If set, this stroke is hidden because replaced by a conversion
  conversionId?: string; // If set, this stroke is the replacement resulting from a conversion
  extraPoints?: Point[]; // Polygon vertices for triangle, diamond, quad
  isUnderline?: boolean;
  attachedTextId?: string;
  // ECON: Blend mode for highlighters by slide brightness (multiply on light, screen on dark)
  blendMode?: GlobalCompositeOperation;
}

export class AnnotationStore {
  private strokes: Stroke[] = [];
  private undoStack: Stroke[][] = [];
  private perSlideStorage: Map<number, Stroke[]> = new Map();
  private boardStrokes: Stroke[] = [];
  private boardUndoStack: Stroke[][] = [];
  private slideStrokesTemp: Stroke[] = [];
  private slideUndoStackTemp: Stroke[][] = [];

  constructor() {
    // Retain drawn strokes on stage resize / orientation changes
    layerManager.onResize(() => {
      this.redrawAll();
    });
  }

  switchToBoard(): void {
    this.slideStrokesTemp = [...this.strokes];
    this.slideUndoStackTemp = [...this.undoStack];
    this.strokes = [...this.boardStrokes];
    this.undoStack = [...this.boardUndoStack];
    this.clearCanvases();
    this.redrawAll();
  }

  switchToDeck(): void {
    this.boardStrokes = [...this.strokes];
    this.boardUndoStack = [...this.undoStack];
    this.strokes = [...this.slideStrokesTemp];
    this.undoStack = [...this.slideUndoStackTemp];
    this.clearCanvases();
    this.redrawAll();
  }

  getStrokes(): Stroke[] {
    return this.strokes.filter((s) => !s.replacedBy);
  }

  getAllStrokes(): Stroke[] {
    return this.strokes;
  }

  // INKFIX: Commit a conversion transaction
  commitConversion(conversionId: string, rawStrokeIds: string[], replacements: Stroke[]): void {
    this.saveSnapshot();
    const rawSet = new Set(rawStrokeIds);
    for (const s of this.strokes) {
      if (rawSet.has(s.id)) {
        s.replacedBy = conversionId;
      }
    }
    this.strokes.push(...replacements);
    this.redrawAll();
  }

  // INKFIX: Roll back conversion (e.g. on error or invariant failure)
  rollbackConversion(conversionId: string): void {
    this.strokes = this.strokes.filter((s) => s.conversionId !== conversionId);
    for (const s of this.strokes) {
      if (s.replacedBy === conversionId) {
        delete s.replacedBy;
      }
    }
    this.redrawAll();
  }

  // INKFIX: Undo conversion (restores raw strokes and records undo snapshot)
  undoConversion(conversionId: string): boolean {
    this.saveSnapshot();
    this.rollbackConversion(conversionId);
    return true;
  }

  // INKFIX: Purge hidden raw strokes older than maxAgeMs (default 60s per Part B4)
  purgeOldReplacedStrokes(maxAgeMs = 60000): void {
    const now = Date.now();
    this.strokes = this.strokes.filter((s) => {
      if (s.replacedBy && now - s.timestamp > maxAgeMs) {
        return false;
      }
      return true;
    });
  }

  addStroke(stroke: Stroke): void {
    this.saveSnapshot();
    this.strokes.push(stroke);
    this.redrawAll();
  }

  saveSnapshot(): void {
    // Deep clone array of strokes for undo stack
    this.undoStack.push(this.strokes.map((s) => ({ ...s, points: [...s.points] })));
    if (this.undoStack.length > 30) {
      this.undoStack.shift();
    }
  }

  undo(): boolean {
    if (this.undoStack.length === 0) {
      if (this.strokes.length > 0) {
        this.strokes = [];
        this.redrawAll();
        return true;
      }
      return false;
    }
    const previous = this.undoStack.pop()!;
    this.strokes = previous;
    this.redrawAll();
    return true;
  }

  // WELCOME-FIX: Check if any slide or current canvas contains annotations
  hasAnnotations(): boolean {
    if (this.strokes.length > 0) return true;
    for (const list of this.perSlideStorage.values()) {
      if (list && list.length > 0) return true;
    }
    return false;
  }

  // WELCOME-FIX: Reset all annotations and slide history
  resetAll(): void {
    this.strokes = [];
    this.undoStack = [];
    this.perSlideStorage.clear();
    this.clearCanvases();
  }

  clearAll(): void {
    if (this.strokes.length > 0) {
      this.saveSnapshot();
    }
    this.strokes = [];
    this.clearCanvases();
  }

  clearCanvases(): void {
    const ctxA = layerManager.annotationCtx;
    const ctxP = layerManager.previewCtx;
    const dims = layerManager.getDimensions();

    ctxA.save();
    ctxA.resetTransform?.();
    ctxA.clearRect(0, 0, ctxA.canvas.width, ctxA.canvas.height);
    ctxA.restore();

    ctxP.save();
    ctxP.resetTransform?.();
    ctxP.clearRect(0, 0, ctxP.canvas.width, ctxP.canvas.height);
    ctxP.restore();
  }

  // Handle slide transition auto-erase or per-slide persistence
  onSlideChange(oldPage: number, newPage: number): void {
    const { keepAnnotationsPerSlide } = store.getState().settings;

    if (keepAnnotationsPerSlide) {
      this.perSlideStorage.set(oldPage, [...this.strokes]);
      this.strokes = this.perSlideStorage.get(newPage) || [];
      this.clearCanvases();
      this.redrawAll();
    } else {
      // Synchronous auto-erase guarantee: zero flash of old ink
      this.strokes = [];
      this.undoStack = [];
      this.clearCanvases();
    }
  }

  // Stroke eraser: hit-tests distance to stroke points
  eraseStrokeAt(point: Point, radius: number): boolean {
    const rSq = radius * radius;
    const initialLen = this.strokes.length;
    const erasedConversionIds = new Set<string>();

    this.strokes = this.strokes.filter((stroke) => {
      // INKFIX: Hidden raw strokes (replacedBy) are not directly hit-tested
      if (stroke.replacedBy) return true;

      // If shape or text, test bounding box
      if (stroke.box) {
        const b = stroke.box;
        const inside =
          point.x >= b.x - radius &&
          point.x <= b.x + b.width + radius &&
          point.y >= b.y - radius &&
          point.y <= b.y + b.height + radius;
        if (inside) {
          if (stroke.conversionId) erasedConversionIds.add(stroke.conversionId);
          return false;
        }
        return true;
      }

      // Freehand stroke or line: test points or endpoints
      if (stroke.points && stroke.points.length > 0) {
        for (const p of stroke.points) {
          const dx = p.x - point.x;
          const dy = p.y - point.y;
          if (dx * dx + dy * dy <= rSq) {
            if (stroke.conversionId) erasedConversionIds.add(stroke.conversionId);
            return false; // Erase this stroke
          }
        }
      } else if (stroke.startPoint && stroke.endPoint) {
        const dx1 = stroke.startPoint.x - point.x;
        const dy1 = stroke.startPoint.y - point.y;
        const dx2 = stroke.endPoint.x - point.x;
        const dy2 = stroke.endPoint.y - point.y;
        if (dx1 * dx1 + dy1 * dy1 <= rSq || dx2 * dx2 + dy2 * dy2 <= rSq) {
          if (stroke.conversionId) erasedConversionIds.add(stroke.conversionId);
          return false;
        }
      }
      return true;
    });

    // INKFIX: Clean up any hidden raw strokes associated with erased conversions
    if (erasedConversionIds.size > 0) {
      this.strokes = this.strokes.filter((s) => !s.replacedBy || !erasedConversionIds.has(s.replacedBy));
    }

    if (this.strokes.length !== initialLen) {
      this.redrawAll();
      return true;
    }
    return false;
  }

  redrawAll(): void {
    this.clearCanvases();
    const ctx = layerManager.annotationCtx;
    if (!ctx) return;

    for (const stroke of this.strokes) {
      if (stroke.replacedBy) continue; // INKFIX: Hidden because replaced by a transaction
      this.renderStroke(ctx, stroke);
    }
  }

  renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    ctx.save();

    const isBoard = store.getState().isBoardMode;
    const defaultHighlighterBlend: GlobalCompositeOperation = isBoard ? 'screen' : 'multiply';
    const defaultHighlighterAlpha = isBoard ? 0.35 : 0.32;

    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = stroke.alpha || defaultHighlighterAlpha;
      ctx.globalCompositeOperation = stroke.blendMode || defaultHighlighterBlend;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'butt'; // Marker flat look per Part D1.1
      ctx.lineJoin = 'round';
    } else if (stroke.tool === 'pen') {
      ctx.globalAlpha = stroke.alpha || 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    if (stroke.shapeType) {
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = stroke.alpha || defaultHighlighterAlpha;
        ctx.globalCompositeOperation = stroke.blendMode || defaultHighlighterBlend;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';
      } else {
        ctx.globalAlpha = stroke.alpha || 1.0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      this.drawShape(ctx, stroke.shapeType, stroke.startPoint!, stroke.endPoint!, stroke.extraPoints);
      ctx.restore();
      return;
    }

    if (stroke.tool === 'arrow' && stroke.startPoint && stroke.endPoint) {
      ctx.globalAlpha = stroke.alpha || 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      this.drawArrow(ctx, stroke.startPoint, stroke.endPoint, stroke.size);
      ctx.restore();
      return;
    }

    if (stroke.tool === 'text' && stroke.text && stroke.box) {
      ctx.globalAlpha = stroke.alpha || 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = stroke.color;
      // Script detection for typography
      const isHindi = /[\u0900-\u097F]/.test(stroke.text);
      const fontSize = Math.max(18, Math.round(stroke.box.height * 0.85));
      ctx.font = isHindi
        ? `600 ${fontSize}px "Noto Sans Devanagari", sans-serif`
        : `600 ${fontSize}px Inter, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(stroke.text, stroke.box.x, stroke.box.y);
      ctx.restore();
      return;
    }

    // Freehand stroke with quadratic curve midpoint smoothing
    const pts = stroke.points;
    if (pts.length === 0) {
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawShape(
    ctx: CanvasRenderingContext2D,
    type: ShapeType | ExtendedShapeType,
    start: Point,
    end: Point,
    extraPoints?: Point[]
  ): void {
    ctx.beginPath();
    if (type === 'rect' || type === 'square') {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      ctx.strokeRect(x, y, w, h);
    } else if (type === 'circle' || type === 'ellipse') {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'line') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (type === 'triangle') {
      if (extraPoints && extraPoints.length >= 3) {
        ctx.moveTo(extraPoints[0].x, extraPoints[0].y);
        ctx.lineTo(extraPoints[1].x, extraPoints[1].y);
        ctx.lineTo(extraPoints[2].x, extraPoints[2].y);
        ctx.closePath();
        ctx.stroke();
      } else {
        const topX = (start.x + end.x) / 2;
        const topY = Math.min(start.y, end.y);
        const botY = Math.max(start.y, end.y);
        ctx.moveTo(topX, topY);
        ctx.lineTo(start.x, botY);
        ctx.lineTo(end.x, botY);
        ctx.closePath();
        ctx.stroke();
      }
    } else if (type === 'diamond') {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      ctx.moveTo(cx, start.y);
      ctx.lineTo(end.x, cy);
      ctx.lineTo(cx, end.y);
      ctx.lineTo(start.x, cy);
      ctx.closePath();
      ctx.stroke();
    } else if (type === 'double_arrow') {
      this.drawArrow(ctx, start, end, ctx.lineWidth, true);
    }
  }

  drawArrow(ctx: CanvasRenderingContext2D, start: Point, end: Point, strokeWidth: number, doubleEnded = false): void {
    const headLength = Math.max(14, strokeWidth * 4);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowAngle = (28 * Math.PI) / 180; // 28 degrees per B6.5

    // Subtle drop shadow for 3D look
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Shaft
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Triangular filled head at end
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - arrowAngle),
      end.y - headLength * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + arrowAngle),
      end.y - headLength * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fill();

    // If double-ended, also draw head at start
    if (doubleEnded) {
      const backAngle = angle + Math.PI;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(
        start.x - headLength * Math.cos(backAngle - arrowAngle),
        start.y - headLength * Math.sin(backAngle - arrowAngle)
      );
      ctx.lineTo(
        start.x - headLength * Math.cos(backAngle + arrowAngle),
        start.y - headLength * Math.sin(backAngle + arrowAngle)
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

export const annotationStore = new AnnotationStore();
