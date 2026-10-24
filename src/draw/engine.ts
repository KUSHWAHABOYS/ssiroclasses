import { ActiveTool, store } from '../state/store';
import { layerManager } from '../core/layers';
import { annotationStore, Point, Stroke } from './annotationStore';
import { shortcutManager } from '../core/shortcuts';

export class DrawingEngine {
  private isDrawing = false;
  private currentStrokePoints: Point[] = [];
  private startPoint: Point | null = null;
  private activePointerId: number | null = null;
  private hasStylusEverBeenUsed = false;
  private eraserCursorEl: HTMLElement | null = null;

  // Handwriting grouping hook
  private onStrokeFinishedCallbacks: Array<(stroke: Stroke) => void> = [];

  init(): void {
    const canvas = layerManager.annotationCanvas;

    canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.handlePointerCancel(e));

    // Handle cancellation during slide change or overlay opening
    window.addEventListener('cancel-in-progress-drawing', () => {
      this.cancelCurrentStroke();
    });

    this.createEraserCursor();
  }

  onStrokeFinished(cb: (stroke: Stroke) => void): void {
    this.onStrokeFinishedCallbacks.push(cb);
  }

  private createEraserCursor(): void {
    const ring = document.createElement('div');
    ring.id = 'eraserCursorRing';
    ring.style.position = 'fixed';
    ring.style.pointerEvents = 'none';
    ring.style.borderRadius = '50%';
    ring.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    ring.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.5)';
    ring.style.display = 'none';
    ring.style.zIndex = '42';
    ring.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(ring);
    this.eraserCursorEl = ring;
  }

  private updateEraserCursor(clientX: number, clientY: number, size: number, visible: boolean): void {
    if (!this.eraserCursorEl) return;
    if (!visible) {
      this.eraserCursorEl.style.display = 'none';
      return;
    }
    this.eraserCursorEl.style.display = 'block';
    this.eraserCursorEl.style.left = `${clientX}px`;
    this.eraserCursorEl.style.top = `${clientY}px`;
    this.eraserCursorEl.style.width = `${size}px`;
    this.eraserCursorEl.style.height = `${size}px`;
  }

  private handlePointerDown(e: PointerEvent): void {
    const state = store.getState();
    if (state.activeTool === 'select') return;

    // Palm rejection: if stylus was used and this event is a wide finger touch, reject
    if (e.pointerType === 'pen') {
      this.hasStylusEverBeenUsed = true;
    } else if (e.pointerType === 'touch' && this.hasStylusEverBeenUsed) {
      if ((e.width && e.width > 36) || (e.height && e.height > 36)) {
        return; // Reject palm contact
      }
    }

    this.isDrawing = true;
    this.activePointerId = e.pointerId;
    layerManager.annotationCanvas.setPointerCapture(e.pointerId);

    const coords = layerManager.toStageCoords(e.clientX, e.clientY);
    const point: Point = {
      x: coords.x,
      y: coords.y,
      pressure: e.pressure || 0.5,
      time: performance.now()
    };

    this.startPoint = point;
    this.currentStrokePoints = [point];

    if (state.activeTool === 'eraser') {
      this.updateEraserCursor(e.clientX, e.clientY, state.eraserSize, true);
      this.executeEraser(point);
    } else if (state.activeTool === 'pen') {
      // Begin drawing path on preview canvas
      const ctx = layerManager.previewCtx;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.save();
      ctx.strokeStyle = state.activeColor;
      ctx.fillStyle = state.activeColor;
      ctx.lineWidth = state.penSize;
      ctx.globalAlpha = state.penAlpha;
      ctx.beginPath();
      ctx.arc(point.x, point.y, state.penSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (state.activeTool === 'highlighter') {
      // Setup preview canvas for translucent highlighter per B6.2
      const ctx = layerManager.previewCtx;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.save();
      ctx.globalAlpha = 1.0;
      layerManager.previewCanvas.style.opacity = `${state.highlighterAlpha}`;
      layerManager.previewCanvas.style.mixBlendMode = 'multiply';
      ctx.strokeStyle = state.activeColor;
      ctx.lineWidth = state.highlighterWidth;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    const state = store.getState();
    if (state.activeTool === 'eraser') {
      this.updateEraserCursor(e.clientX, e.clientY, state.eraserSize, true);
    } else {
      this.updateEraserCursor(0, 0, 0, false);
    }

    if (!this.isDrawing || e.pointerId !== this.activePointerId) return;

    // Use coalesced events for smooth curves on 4K boards
    const events: PointerEvent[] = (e.getCoalescedEvents ? e.getCoalescedEvents() : [e]) as PointerEvent[];

    for (const evt of events) {
      const coords = layerManager.toStageCoords(evt.clientX, evt.clientY);
      const point: Point = {
        x: coords.x,
        y: coords.y,
        pressure: evt.pressure || 0.5,
        time: performance.now()
      };
      this.currentStrokePoints.push(point);
    }

    const currentPt = this.currentStrokePoints[this.currentStrokePoints.length - 1];

    if (state.activeTool === 'eraser') {
      this.executeEraser(currentPt);
    } else if (state.activeTool === 'pen') {
      this.renderPenPreview();
    } else if (state.activeTool === 'highlighter') {
      this.renderHighlighterPreview();
    } else if (state.activeTool === 'shape' && this.startPoint) {
      this.renderShapePreview(this.startPoint, currentPt, state.activeShape);
    } else if (state.activeTool === 'arrow' && this.startPoint) {
      this.renderArrowPreview(this.startPoint, currentPt);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDrawing || e.pointerId !== this.activePointerId) return;
    this.isDrawing = false;
    this.activePointerId = null;

    try {
      layerManager.annotationCanvas.releasePointerCapture(e.pointerId);
    } catch {}

    const state = store.getState();
    const currentPt = this.currentStrokePoints[this.currentStrokePoints.length - 1];

    // Reset preview canvas styles
    layerManager.previewCanvas.style.opacity = '1';
    layerManager.previewCanvas.style.mixBlendMode = 'normal';
    layerManager.previewCtx.clearRect(0, 0, layerManager.previewCtx.canvas.width, layerManager.previewCtx.canvas.height);

    if (state.activeTool === 'eraser') {
      // Finished eraser stroke
      this.currentStrokePoints = [];
      return;
    }

    if (state.activeTool === 'shape' && this.startPoint) {
      // Minimum-size rule: drag distance < 6px discarded per B6.4
      const dist = Math.hypot(currentPt.x - this.startPoint.x, currentPt.y - this.startPoint.y);
      if (dist >= 6) {
        let endP = currentPt;
        if (shortcutManager.isShiftDown && (state.activeShape === 'rect' || state.activeShape === 'circle')) {
          const side = Math.max(Math.abs(currentPt.x - this.startPoint.x), Math.abs(currentPt.y - this.startPoint.y));
          endP = {
            x: this.startPoint.x + Math.sign(currentPt.x - this.startPoint.x) * side,
            y: this.startPoint.y + Math.sign(currentPt.y - this.startPoint.y) * side
          };
        }

        const stroke: Stroke = {
          id: `shape-${Date.now()}-${Math.random()}`,
          tool: 'shape',
          color: state.activeColor,
          size: state.penSize,
          alpha: state.penAlpha,
          points: [this.startPoint, endP],
          shapeType: state.activeShape,
          startPoint: this.startPoint,
          endPoint: endP,
          box: {
            x: Math.min(this.startPoint.x, endP.x),
            y: Math.min(this.startPoint.y, endP.y),
            width: Math.abs(endP.x - this.startPoint.x),
            height: Math.abs(endP.y - this.startPoint.y)
          },
          timestamp: Date.now()
        };
        annotationStore.addStroke(stroke);
      }
    } else if (state.activeTool === 'arrow' && this.startPoint) {
      const dist = Math.hypot(currentPt.x - this.startPoint.x, currentPt.y - this.startPoint.y);
      if (dist >= 6) {
        const stroke: Stroke = {
          id: `arrow-${Date.now()}-${Math.random()}`,
          tool: 'arrow',
          color: state.activeColor,
          size: state.penSize,
          alpha: state.penAlpha,
          points: [this.startPoint, currentPt],
          startPoint: this.startPoint,
          endPoint: currentPt,
          box: {
            x: Math.min(this.startPoint.x, currentPt.x),
            y: Math.min(this.startPoint.y, currentPt.y),
            width: Math.abs(currentPt.x - this.startPoint.x),
            height: Math.abs(currentPt.y - this.startPoint.y)
          },
          timestamp: Date.now()
        };
        annotationStore.addStroke(stroke);
      }
    } else if (state.activeTool === 'pen' || state.activeTool === 'highlighter') {
      if (this.currentStrokePoints.length > 0) {
        const isHighlighter = state.activeTool === 'highlighter';
        const stroke: Stroke = {
          id: `stroke-${Date.now()}-${Math.random()}`,
          tool: state.activeTool,
          color: state.activeColor,
          size: isHighlighter ? state.highlighterWidth : state.penSize,
          alpha: isHighlighter ? state.highlighterAlpha : state.penAlpha,
          points: [...this.currentStrokePoints],
          timestamp: Date.now()
        };

        annotationStore.addStroke(stroke);

        // Notify handwriting group collector if enabled
        if (state.isHandwritingEnabled && state.activeTool === 'pen') {
          for (const cb of this.onStrokeFinishedCallbacks) {
            cb(stroke);
          }
        }
      }
    }

    this.currentStrokePoints = [];
    this.startPoint = null;
  }

  private handlePointerCancel(e: PointerEvent): void {
    this.cancelCurrentStroke();
  }

  private cancelCurrentStroke(): void {
    this.isDrawing = false;
    this.activePointerId = null;
    this.currentStrokePoints = [];
    this.startPoint = null;
    layerManager.previewCanvas.style.opacity = '1';
    layerManager.previewCanvas.style.mixBlendMode = 'normal';
    layerManager.previewCtx.clearRect(0, 0, layerManager.previewCtx.canvas.width, layerManager.previewCtx.canvas.height);
    this.updateEraserCursor(0, 0, 0, false);
  }

  private executeEraser(point: Point): void {
    const state = store.getState();
    if (state.eraserMode === 'stroke') {
      annotationStore.eraseStrokeAt(point, state.eraserSize / 2);
    } else {
      // Pixel eraser using destination-out
      const ctx = layerManager.annotationCtx;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(point.x, point.y, state.eraserSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderPenPreview(): void {
    const pts = this.currentStrokePoints;
    if (pts.length < 2) return;

    const ctx = layerManager.previewCtx;
    const state = store.getState();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.strokeStyle = state.activeColor;
    ctx.lineWidth = state.penSize;
    ctx.globalAlpha = state.penAlpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  private renderHighlighterPreview(): void {
    const pts = this.currentStrokePoints;
    if (pts.length < 2) return;

    const ctx = layerManager.previewCtx;
    const state = store.getState();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.strokeStyle = state.activeColor;
    ctx.lineWidth = state.highlighterWidth;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  private renderShapePreview(start: Point, current: Point, shape: any): void {
    const ctx = layerManager.previewCtx;
    const state = store.getState();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    let endP = current;
    if (shortcutManager.isShiftDown && (shape === 'rect' || shape === 'circle')) {
      const side = Math.max(Math.abs(current.x - start.x), Math.abs(current.y - start.y));
      endP = {
        x: start.x + Math.sign(current.x - start.x) * side,
        y: start.y + Math.sign(current.y - start.y) * side
      };
    }

    ctx.save();
    ctx.strokeStyle = state.activeColor;
    ctx.lineWidth = state.penSize;
    ctx.globalAlpha = state.penAlpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    annotationStore.drawShape(ctx, shape, start, endP);
    ctx.restore();
  }

  private renderArrowPreview(start: Point, current: Point): void {
    const ctx = layerManager.previewCtx;
    const state = store.getState();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.strokeStyle = state.activeColor;
    ctx.fillStyle = state.activeColor;
    ctx.lineWidth = state.penSize;
    ctx.globalAlpha = state.penAlpha;

    annotationStore.drawArrow(ctx, start, current, state.penSize);
    ctx.restore();
  }
}

export const drawingEngine = new DrawingEngine();
