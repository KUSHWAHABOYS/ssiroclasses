import { ActiveTool, ShapeType, store } from '../state/store';
import { layerManager } from '../core/layers';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

export interface Stroke {
  id: string;
  tool: ActiveTool;
  color: string;
  size: number;
  alpha: number;
  points: Point[];
  shapeType?: ShapeType;
  startPoint?: Point;
  endPoint?: Point;
  text?: string;
  box?: { x: number; y: number; width: number; height: number };
  timestamp: number;
}

export class AnnotationStore {
  private strokes: Stroke[] = [];
  private undoStack: Stroke[][] = [];
  private perSlideStorage: Map<number, Stroke[]> = new Map();

  getStrokes(): Stroke[] {
    return this.strokes;
  }

  addStroke(stroke: Stroke): void {
    this.saveSnapshot();
    this.strokes.push(stroke);
    this.redrawAll();
  }

  saveSnapshot(): void {
    this.undoStack.push([...this.strokes]);
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

    this.strokes = this.strokes.filter((stroke) => {
      // If shape or text, test bounding box
      if (stroke.box) {
        const b = stroke.box;
        const inside =
          point.x >= b.x - radius &&
          point.x <= b.x + b.width + radius &&
          point.y >= b.y - radius &&
          point.y <= b.y + b.height + radius;
        return !inside;
      }

      // Freehand stroke: test points
      for (const p of stroke.points) {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        if (dx * dx + dy * dy <= rSq) {
          return false; // Erase this stroke
        }
      }
      return true;
    });

    if (this.strokes.length !== initialLen) {
      this.redrawAll();
      return true;
    }
    return false;
  }

  redrawAll(): void {
    this.clearCanvases();
    const ctx = layerManager.annotationCtx;

    for (const stroke of this.strokes) {
      this.renderStroke(ctx, stroke);
    }
  }

  renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    ctx.save();

    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = stroke.alpha || 0.25;
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'butt'; // Marker look per B6.2
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
      ctx.globalAlpha = stroke.alpha || 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.drawShape(ctx, stroke.shapeType, stroke.startPoint!, stroke.endPoint!);
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

  drawShape(ctx: CanvasRenderingContext2D, type: ShapeType, start: Point, end: Point): void {
    ctx.beginPath();
    if (type === 'rect') {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      ctx.strokeRect(x, y, w, h);
    } else if (type === 'circle') {
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
    }
  }

  drawArrow(ctx: CanvasRenderingContext2D, start: Point, end: Point, strokeWidth: number): void {
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

    // Triangular filled head
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

    ctx.restore();
  }
}

export const annotationStore = new AnnotationStore();
