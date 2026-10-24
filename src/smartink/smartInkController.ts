// INKFIX: Central Smart Ink Orchestration Controller
import { Point, Stroke, annotationStore } from '../draw/annotationStore';
import { store } from '../state/store';
import { inkClassifier, ClassificationResult } from './classifier';
import { shapeFitter, FitResult } from './shapeFitter';
import { textLineDetector } from './textLines';
import { wordGrouper, WordCluster } from './wordGrouper';
import { InkTransaction } from './transaction';
import { smartInkInspector } from './inspector';
import { aiRouter } from '../ai/aiRouter';
import { keyVault } from '../ai/keyVault';
import { getThresholds } from './thresholds';

export class SmartInkController {
  private pendingStrokes: Stroke[] = [];
  private idleTimer = 0;
  private speculativeController: AbortController | null = null;
  private speculativePromise: Promise<string> | null = null;
  private undoTimer = 0;
  private isProcessing = false;

  // Hold-to-snap state
  private holdTimer = 0;
  private holdTriggered = false;
  private holdRingEl: HTMLElement | null = null;

  init(): void {
    window.addEventListener('cancel-in-progress-drawing', () => {
      this.cancelPending();
    });

    store.subscribe((state, prevState) => {
      if (state.currentPage !== prevState.currentPage) {
        this.cancelPending();
      }
    });
  }

  cancelPending(): void {
    window.clearTimeout(this.idleTimer);
    window.clearTimeout(this.holdTimer);
    this.removeHoldRing();
    if (this.speculativeController) {
      try {
        this.speculativeController.abort();
      } catch {}
      this.speculativeController = null;
    }
    this.speculativePromise = null;
    this.pendingStrokes = [];
    this.isProcessing = false;
  }

  // --- Hold-to-Snap Hooks (Part D2) ---
  onPointerDown(e: PointerEvent): void {
    this.holdTriggered = false;
    window.clearTimeout(this.holdTimer);
    this.removeHoldRing();

    // Cancel speculative AI if user starts new stroke
    if (this.speculativeController) {
      try {
        this.speculativeController.abort();
      } catch {}
      this.speculativeController = null;
    }
    this.speculativePromise = null;
  }

  onPointerStill(point: Point, screenX: number, screenY: number): void {
    const s = store.getState();
    if (s.activeTool !== 'pen' && s.activeTool !== 'highlighter') return;

    window.clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => {
      this.holdTriggered = true;
      this.showHoldRing(screenX, screenY);
    }, 500); // 0.5s hold-to-snap
  }

  onPointerMove(dx: number, dy: number): void {
    // If pointer moves significantly (> 8px), cancel hold-to-snap
    if (Math.hypot(dx, dy) > 8) {
      window.clearTimeout(this.holdTimer);
      this.removeHoldRing();
      this.holdTriggered = false;
    }
  }

  // --- Main Stroke Completion Hook ---
  onNewStroke(stroke: Stroke): void {
    const s = store.getState();
    const isPen = stroke.tool === 'pen';
    const isHighlighter = stroke.tool === 'highlighter';

    if (!isPen && !isHighlighter) return;

    // ECON: Check if Smart Ink is enabled (Part B: pure code features work offline)
    if (!s.settings.smartInkEnabled) return;

    window.clearTimeout(this.idleTimer);
    this.pendingStrokes.push(stroke);

    const wasHoldSnap = this.holdTriggered;
    this.holdTriggered = false;
    this.removeHoldRing();

    // If hold-to-snap fired, convert immediately (0 ms delay per Part D2)
    if (wasHoldSnap) {
      this.processStrokeBatch(true);
      return;
    }

    // ECON: Speculative recognition ONLY when Smart Text toggle (✍→Aa) is explicitly ON (Part B / D4)
    if (s.isHandwritingEnabled) {
      const speculativeDelay = 500;
      setTimeout(() => {
        if (this.pendingStrokes.length > 0 && !this.speculativeController) {
          this.launchSpeculativeRecognition();
        }
      }, speculativeDelay);
    }

    // Sync thresholds with user sensitivity setting
    shapeFitter.setThresholds(getThresholds(s.settings.smartInkSensitivity || 'normal'));

    // Standard timer delay: shape delay 0.45s, highlighter 0.15s, text 1.0s (Part D)
    const classification = inkClassifier.classifyStroke(stroke, this.pendingStrokes);

    let delayMs = s.settings.smartInkTextDelayMs || 1000;
    if (s.settings.smartInkConvertText === 'line') {
      delayMs = 2000;
    }

    if (isHighlighter) {
      // ECON: Highlighter delay default 0.15s (150ms) per Part D1
      delayMs = s.settings.smartInkHighlighterDelayMs || 150;
    } else if (classification.inkClass === 'shape' || classification.inkClass === 'underline' || classification.inkClass === 'line') {
      delayMs = s.settings.smartInkShapeDelayMs || 450;
    }

    this.idleTimer = window.setTimeout(() => {
      this.processStrokeBatch(false);
    }, delayMs);
  }

  /**
   * Processes the batch of pending strokes into shapes, straight lines, or text
   */
  private async processStrokeBatch(immediate = false): Promise<void> {
    if (this.isProcessing || this.pendingStrokes.length === 0) return;
    this.isProcessing = true;

    const strokes = [...this.pendingStrokes];
    this.pendingStrokes = [];

    const startTime = Date.now();
    const latestStroke = strokes[strokes.length - 1];
    const classification = inkClassifier.classifyStroke(latestStroke, strokes);

    // --- Branch 0: Highlighter Straighten & Snap (Part D1) ---
    if (latestStroke.tool === 'highlighter') {
      await this.processHighlighter(latestStroke, startTime);
      this.isProcessing = false;
      return;
    }

    // --- Branch 1: Underline Snap (Part D2) ---
    if (classification.inkClass === 'underline' && classification.fitResult) {
      const transaction = new InkTransaction([latestStroke]);
      await transaction.execute(async () => {
        let fit = classification.fitResult!;
        // Snap to text candidate directly above if available
        const box = {
          x: Math.min(fit.startPoint.x, fit.endPoint.x),
          y: Math.min(fit.startPoint.y, fit.endPoint.y),
          width: Math.abs(fit.endPoint.x - fit.startPoint.x),
          height: Math.max(1, Math.abs(fit.endPoint.y - fit.startPoint.y))
        };

        const textAbove = textLineDetector.findCandidateAboveUnderline(box);
        if (textAbove) {
          const snapped = textLineDetector.snapUnderlineToText(fit.startPoint, fit.endPoint, textAbove);
          fit.startPoint = snapped.start;
          fit.endPoint = snapped.end;
        }

        const repStroke: Stroke = {
          id: `line-${Date.now()}`,
          tool: latestStroke.tool,
          color: latestStroke.color,
          size: latestStroke.size,
          alpha: latestStroke.alpha,
          points: [fit.startPoint, fit.endPoint],
          shapeType: 'line',
          startPoint: fit.startPoint,
          endPoint: fit.endPoint,
          isUnderline: true,
          timestamp: Date.now()
        };

        return [repStroke];
      });

      smartInkInspector.recordDecision({
        tool: latestStroke.tool,
        strokeCount: 1,
        features: { isUnderline: true },
        classScores: { underline: classification.confidence },
        branchTaken: 'underline_snap',
        aiCalled: false,
        latencyMs: Date.now() - startTime,
        result: 'converted',
        reason: classification.reason
      });

      this.isProcessing = false;
      return;
    }

    // --- Branch 2: Freehand Geometric Shape (Part D3) ---
    if ((classification.inkClass === 'shape' || classification.inkClass === 'line') && classification.fitResult) {
      const fit = classification.fitResult;

      // Purely geometric recognition by default; AI second-opinion only if smartInkAiAssist is explicitly enabled
      let finalFit: FitResult | null = fit;
      let aiUsed = false;
      const s = store.getState();

      if (s.settings.smartInkAiAssist && fit.confidence >= 0.35 && fit.confidence < 0.6 && keyVault.hasAnyKey()) {
        try {
          aiUsed = true;
          finalFit = await this.queryShapeClassifyAI(latestStroke, fit);
        } catch {
          finalFit = fit; // fallback to local fit
        }
      }

      if (finalFit) {
        const transaction = new InkTransaction([latestStroke]);
        await transaction.execute(async () => {
          const repStroke: Stroke = {
            id: `shape-${Date.now()}`,
            tool: finalFit!.shapeType === 'arrow' ? 'arrow' : latestStroke.tool,
            color: latestStroke.color,
            size: latestStroke.size,
            alpha: latestStroke.alpha,
            points: [finalFit!.startPoint, finalFit!.endPoint],
            shapeType: finalFit!.shapeType,
            startPoint: finalFit!.startPoint,
            endPoint: finalFit!.endPoint,
            extraPoints: finalFit!.extraPoints,
            box: finalFit!.box,
            timestamp: Date.now()
          };
          return [repStroke];
        });

        smartInkInspector.recordDecision({
          tool: latestStroke.tool,
          strokeCount: 1,
          features: { shapeType: finalFit.shapeType },
          classScores: { [finalFit.shapeType]: finalFit.confidence },
          branchTaken: aiUsed ? 'ai_assisted_shape' : 'local_geometric_shape',
          aiCalled: aiUsed,
          aiTask: aiUsed ? 'shape-classify' : undefined,
          latencyMs: Date.now() - startTime,
          result: 'converted',
          reason: `Snapped to clean ${finalFit.shapeType}`
        });

        this.isProcessing = false;
        return;
      }
    }

    // --- Branch 3: Word-Level Handwriting-to-Text (Part D4) ---
    if (classification.inkClass === 'text' || classification.inkClass === 'shirorekha') {
      if (store.getState().isHandwritingEnabled) {
        await this.processWordClusters(strokes, startTime);
      } else {
        // Pure code: Smart Text toggle is OFF, leave handwriting raw untouched
        smartInkInspector.recordDecision({
          tool: latestStroke.tool,
          strokeCount: strokes.length,
          features: {},
          classScores: { text: 0.9 },
          branchTaken: 'text_raw_preserved',
          aiCalled: false,
          latencyMs: Date.now() - startTime,
          result: 'left_as_drawn',
          reason: 'Smart Text toggle (✍→Aa) is OFF; ink preserved untouched'
        });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Computes bounding box of stroke points
   */
  private getStrokeBounds(stroke: Stroke): { minX: number; maxX: number; minY: number; maxY: number } {
    if (!stroke.points || stroke.points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  }

  /**
   * ECON: Highlighter clean band & text line snapping within 0.15s purely by code (Part D1)
   */
  private async processHighlighter(stroke: Stroke, startTime: number): Promise<void> {
    const s = store.getState();
    const isBoard = s.isBoardMode;
    const blendMode: GlobalCompositeOperation = isBoard ? 'screen' : 'multiply';
    const alpha = isBoard ? 0.35 : 0.32;
    const box = this.getStrokeBounds(stroke);

    // Snap to text lines if available
    const coveredLines = textLineDetector.findLinesCovered({
      x: box.minX,
      y: box.minY,
      width: Math.max(1, box.maxX - box.minX),
      height: Math.max(1, box.maxY - box.minY)
    });

    const transaction = new InkTransaction([stroke]);
    await transaction.execute(async () => {
      if (coveredLines.length > 0) {
        // Snap one clean horizontal band per covered text line
        const bands: Stroke[] = [];
        for (const line of coveredLines) {
          const height = Math.max(stroke.size, line.box.height + 2);
          const minX = Math.max(box.minX, line.box.x);
          const maxX = Math.min(box.maxX, line.box.x + line.box.width);
          const midY = line.box.y + line.box.height / 2;

          bands.push({
            id: `hl-band-${Date.now()}-${Math.random()}`,
            tool: 'highlighter',
            color: stroke.color,
            size: height,
            alpha,
            blendMode,
            shapeType: 'line',
            startPoint: { x: minX, y: midY },
            endPoint: { x: maxX, y: midY },
            points: [{ x: minX, y: midY }, { x: maxX, y: midY }],
            timestamp: Date.now()
          });
        }
        return bands;
      }

      // If no text line found, straighten the drawn stroke
      const pts = stroke.points;
      const start = { ...pts[0] };
      const end = { ...pts[pts.length - 1] };
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const angleDeg = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));

      // If within 10° of horizontal, snap to perfectly horizontal
      if (angleDeg <= 10 || angleDeg >= 170) {
        const midY = (start.y + end.y) / 2;
        start.y = midY;
        end.y = midY;
      }

      const repStroke: Stroke = {
        id: `hl-straight-${Date.now()}`,
        tool: 'highlighter',
        color: stroke.color,
        size: stroke.size,
        alpha,
        blendMode,
        shapeType: 'line',
        startPoint: start,
        endPoint: end,
        points: [start, end],
        timestamp: Date.now()
      };
      return [repStroke];
    });

    smartInkInspector.recordDecision({
      tool: stroke.tool,
      strokeCount: 1,
      features: { isHighlighter: true, coveredLines: coveredLines.length },
      classScores: { highlighter: 0.95 },
      branchTaken: 'highlighter_band_snap',
      aiCalled: false,
      latencyMs: Date.now() - startTime,
      result: 'converted',
      reason: coveredLines.length > 0 ? `Snapped to ${coveredLines.length} text lines` : 'Straightened highlighter band'
    });
  }

  /**
   * Converts word clusters into clean typeset word objects (Part F)
   */
  private async processWordClusters(strokes: Stroke[], startTime: number): Promise<void> {
    const s = store.getState().settings;
    if (s.smartInkConvertText === 'off') {
      smartInkInspector.recordDecision({
        tool: strokes[0]?.tool || 'pen',
        strokeCount: strokes.length,
        features: {},
        classScores: { text: 0.9 },
        branchTaken: 'text_off',
        aiCalled: false,
        latencyMs: Date.now() - startTime,
        result: 'left_as_drawn',
        reason: 'Convert text setting is Off; ink preserved untouched'
      });
      return;
    }

    const clusters = wordGrouper.groupStrokesIntoWords(strokes);
    const completeClusters = clusters.filter((c) => c.isCompleteWord);

    if (completeClusters.length === 0) {
      // Leave strokes as drawn (e.g. incomplete glyph or tiny mark)
      smartInkInspector.recordDecision({
        tool: strokes[0]?.tool || 'pen',
        strokeCount: strokes.length,
        features: {},
        classScores: { text: 0.5 },
        branchTaken: 'incomplete_word_hold',
        aiCalled: false,
        latencyMs: Date.now() - startTime,
        result: 'left_as_drawn',
        reason: 'Stroke is a lone small mark or incomplete word, left untouched'
      });
      return;
    }

    // Check if key is available
    if (!keyVault.hasAnyKey()) {
      // Leave ink untouched
      smartInkInspector.recordDecision({
        tool: strokes[0]?.tool || 'pen',
        strokeCount: strokes.length,
        features: {},
        classScores: { text: 0.8 },
        branchTaken: 'text_no_key',
        aiCalled: false,
        latencyMs: Date.now() - startTime,
        result: 'left_as_drawn',
        reason: 'No AI key configured; ink preserved untouched'
      });
      return;
    }

    // Perform OCR via AI Router
    const transaction = new InkTransaction(strokes);
    try {
      await transaction.execute(async () => {
        // Render strokes to offscreen cropped canvas
        const crop = this.renderStrokesToPng(strokes);

        // Prompt per spec
        const prompt =
          'Transcribe the handwritten words in this image exactly. Return only the typeset words separated by single spaces. Preserve Devanagari matras and shirorekha. No markdown, no explanation.';

        let transcription = '';
        if (this.speculativePromise) {
          transcription = await this.speculativePromise;
        } else {
          const result = await aiRouter.run('handwriting-ocr', {
            image: crop.base64Png,
            prompt,
            temperature: 0.0,
            maxTokens: 60
          });
          transcription = result.text.trim();
        }

        this.speculativePromise = null;
        if (!transcription) {
          throw new Error('AI returned empty transcription');
        }

        const words = transcription.split(/\s+/).filter(Boolean);
        const repStrokes: Stroke[] = [];

        // Calculate width per word
        const totalBox = crop.box;
        const avgCharWidth = totalBox.width / Math.max(1, transcription.length);
        let currX = totalBox.x;

        for (let i = 0; i < words.length; i++) {
          const w = words[i];
          const wWidth = Math.max(20, w.length * avgCharWidth);

          repStrokes.push({
            id: `typeset-word-${Date.now()}-${i}`,
            tool: 'text',
            color: strokes[0].color,
            size: Math.max(20, Math.round(totalBox.height * 0.82)),
            alpha: 1.0,
            points: [{ x: currX, y: totalBox.y }],
            text: w,
            box: {
              x: currX,
              y: totalBox.y,
              width: wWidth,
              height: totalBox.height
            },
            timestamp: Date.now()
          });

          currX += wWidth + avgCharWidth * 0.8; // Space between words
        }

        return repStrokes;
      });

      smartInkInspector.recordDecision({
        tool: strokes[0]?.tool || 'pen',
        strokeCount: strokes.length,
        features: { clusterCount: completeClusters.length },
        classScores: { text: 0.9 },
        branchTaken: 'word_typeset_ocr',
        aiCalled: true,
        aiTask: 'handwriting-ocr',
        latencyMs: Date.now() - startTime,
        result: 'converted',
        reason: 'Converted to typeset word objects'
      });
    } catch (err: any) {
      // ECON: If out of quota or AI fails, raw ink is kept intact with short note (Part D4)
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message: 'हस्तलेखन रूपांतरण सीमा या त्रुटि: लिखावट सुरक्षित रखी गई (Handwriting preserved untouched)'
          }
        })
      );
      smartInkInspector.recordDecision({
        tool: strokes[0]?.tool || 'pen',
        strokeCount: strokes.length,
        features: {},
        classScores: { text: 0.9 },
        branchTaken: 'ocr_error_rollback',
        aiCalled: true,
        latencyMs: Date.now() - startTime,
        result: 'left_as_drawn',
        reason: `AI conversion failed (${err?.message || 'error'}), raw ink restored transactionally`
      });
    }
  }

  /**
   * Speculatively starts OCR after 500ms of idle time (Part E2)
   */
  private launchSpeculativeRecognition(): void {
    if (this.pendingStrokes.length === 0 || !keyVault.hasAnyKey()) return;

    this.speculativeController = new AbortController();
    const strokes = [...this.pendingStrokes];
    const crop = this.renderStrokesToPng(strokes);

    const prompt =
      'Transcribe the handwritten words in this image exactly. Return only the typeset words separated by single spaces. Preserve Devanagari matras and shirorekha. No markdown, no explanation.';

    this.speculativePromise = aiRouter
      .run(
        'handwriting-ocr',
        {
          image: crop.base64Png,
          prompt,
          temperature: 0.0,
          maxTokens: 60,
          signal: this.speculativeController.signal
        },
        { quality: 'fast' }
      )
      .then((res) => res.text.trim())
      .catch(() => '');
  }

  /**
   * Calls shape-classify router task for uncertain strokes (Part D3)
   */
  private async queryShapeClassifyAI(stroke: Stroke, localFit: FitResult): Promise<FitResult | null> {
    const crop = this.renderStrokesToPng([stroke], 256);
    const prompt =
      'Classify the hand-drawn mark in this image. Reply JSON only: {"label":"line|underline|arrow|double_arrow|circle|ellipse|rectangle|square|triangle|diamond|quadrilateral|bracket|text|scribble","confidence":0-1}.';

    const result = await aiRouter.run('shape-classify', {
      image: crop.base64Png,
      prompt,
      temperature: 0.0,
      maxTokens: 40
    });

    try {
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.confidence >= 0.6) {
          const lbl = parsed.label;
          if (lbl === 'circle' || lbl === 'ellipse') {
            return { ...localFit, shapeType: lbl };
          }
          if (lbl === 'rectangle' || lbl === 'square') {
            return { ...localFit, shapeType: lbl === 'rectangle' ? 'rect' : 'square' };
          }
          if (lbl === 'triangle' || lbl === 'diamond' || lbl === 'arrow') {
            return { ...localFit, shapeType: lbl };
          }
        }
      }
    } catch {}

    return localFit;
  }

  private renderStrokesToPng(strokes: Stroke[], maxDimension?: number): { base64Png: string; box: { x: number; y: number; width: number; height: number } } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes) {
      for (const p of s.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    const padding = 16;
    let w = Math.max(32, Math.round(maxX - minX + padding * 2));
    let h = Math.max(32, Math.round(maxY - minY + padding * 2));

    const canvas = document.createElement('canvas');
    if (maxDimension && (w > maxDimension || h > maxDimension)) {
      const scale = maxDimension / Math.max(w, h);
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
    } else {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const scaleFactor = canvas.width / w;
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(padding - minX, padding - minY);

    for (const s of strokes) {
      const blackStroke: Stroke = {
        ...s,
        color: '#000000',
        alpha: 1.0
      };
      annotationStore.renderStroke(ctx, blackStroke);
    }
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/png');
    const base64Png = dataUrl.replace(/^data:image\/png;base64,/, '');

    return {
      base64Png,
      box: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
    };
  }

  private showHoldRing(screenX: number, screenY: number): void {
    this.removeHoldRing();
    const ring = document.createElement('div');
    ring.id = 'smartInkHoldRing';
    ring.style.position = 'fixed';
    ring.style.pointerEvents = 'none';
    ring.style.zIndex = '9999';
    ring.style.left = `${screenX - 22}px`;
    ring.style.top = `${screenY - 22}px`;
    ring.style.width = '44px';
    ring.style.height = '44px';
    ring.style.borderRadius = '50%';
    ring.style.border = '3px solid var(--primary-accent, #38bdf8)';
    ring.style.boxShadow = '0 0 15px rgba(56, 189, 248, 0.7)';
    ring.style.animation = 'pulse-ring 0.4s ease-out infinite';
    document.body.appendChild(ring);
    this.holdRingEl = ring;
  }

  private removeHoldRing(): void {
    if (this.holdRingEl) {
      this.holdRingEl.remove();
      this.holdRingEl = null;
    }
  }
}

export const smartInkController = new SmartInkController();
