import { annotationStore, Point, Stroke } from './annotationStore';
import { layerManager } from '../core/layers';
import { store } from '../state/store';

type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface HandleInfo {
  type: ResizeHandleType;
  x: number;
  y: number;
  cursor: string;
}

export class ShapeSelector {
  private selectedStroke: Stroke | null = null;
  private isInteracting = false;
  private interactionMode: 'move' | 'resize' | null = null;
  private activeHandle: ResizeHandleType | null = null;

  private startPointerCoords: Point = { x: 0, y: 0 };
  private initialBox: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 };
  private initialStartPoint: Point = { x: 0, y: 0 };
  private initialEndPoint: Point = { x: 0, y: 0 };
  private initialPoints: Point[] = [];
  private initialExtraPoints: Point[] = [];

  constructor() {
    this.bindKeyboard();
  }

  getSelectedStroke(): Stroke | null {
    return this.selectedStroke;
  }

  deselect(): void {
    if (this.selectedStroke) {
      this.selectedStroke = null;
      this.isInteracting = false;
      this.interactionMode = null;
      this.activeHandle = null;
      this.clearOverlay();
    }
  }

  private isShapeStroke(s: Stroke): boolean {
    if (s.replacedBy) return false;
    return (
      s.tool === 'shape' ||
      s.tool === 'arrow' ||
      Boolean(s.shapeType) ||
      (Boolean(s.box) && s.tool !== 'pen' && s.tool !== 'highlighter')
    );
  }

  private getStrokeBox(s: Stroke): { x: number; y: number; width: number; height: number } {
    if (s.box && s.box.width >= 0 && s.box.height >= 0) {
      return s.box;
    }
    const sp = s.startPoint || s.points[0] || { x: 0, y: 0 };
    const ep = s.endPoint || s.points[s.points.length - 1] || sp;
    const box = {
      x: Math.min(sp.x, ep.x),
      y: Math.min(sp.y, ep.y),
      width: Math.max(10, Math.abs(ep.x - sp.x)),
      height: Math.max(10, Math.abs(ep.y - sp.y))
    };
    s.box = box;
    return box;
  }

  private getHandles(box: { x: number; y: number; width: number; height: number }): HandleInfo[] {
    const { x, y, width: w, height: h } = box;
    return [
      { type: 'nw', x: x, y: y, cursor: 'nwse-resize' },
      { type: 'n', x: x + w / 2, y: y, cursor: 'ns-resize' },
      { type: 'ne', x: x + w, y: y, cursor: 'nesw-resize' },
      { type: 'e', x: x + w, y: y + h / 2, cursor: 'ew-resize' },
      { type: 'se', x: x + w, y: y + h, cursor: 'nwse-resize' },
      { type: 's', x: x + w / 2, y: y + h, cursor: 'ns-resize' },
      { type: 'sw', x: x, y: y + h, cursor: 'nesw-resize' },
      { type: 'w', x: x, y: y + h / 2, cursor: 'ew-resize' }
    ];
  }

  private hitTestHandle(pt: Point, box: { x: number; y: number; width: number; height: number }): HandleInfo | null {
    const handles = this.getHandles(box);
    const radius = 18; // 18px hit radius for easy touch targeting
    const rSq = radius * radius;

    for (const h of handles) {
      const dx = pt.x - h.x;
      const dy = pt.y - h.y;
      if (dx * dx + dy * dy <= rSq) {
        return h;
      }
    }
    return null;
  }

  private hitTestStroke(pt: Point, stroke: Stroke): boolean {
    const box = this.getStrokeBox(stroke);
    const margin = 14;
    return (
      pt.x >= box.x - margin &&
      pt.x <= box.x + box.width + margin &&
      pt.y >= box.y - margin &&
      pt.y <= box.y + box.height + margin
    );
  }

  handlePointerDown(e: PointerEvent): boolean {
    if (store.getState().activeTool !== 'select') return false;

    const coords = layerManager.toSlideCoords(e.clientX, e.clientY);

    // 1. If we already have a selected stroke, check if a resize handle was tapped
    if (this.selectedStroke) {
      const box = this.getStrokeBox(this.selectedStroke);
      const hitHandle = this.hitTestHandle(coords, box);
      if (hitHandle) {
        this.isInteracting = true;
        this.interactionMode = 'resize';
        this.activeHandle = hitHandle.type;
        this.startPointerCoords = coords;
        this.recordInitialState(this.selectedStroke);
        annotationStore.saveSnapshot();
        return true;
      }

      // Check if clicked inside current selected stroke to move it
      if (this.hitTestStroke(coords, this.selectedStroke)) {
        this.isInteracting = true;
        this.interactionMode = 'move';
        this.activeHandle = null;
        this.startPointerCoords = coords;
        this.recordInitialState(this.selectedStroke);
        annotationStore.saveSnapshot();
        return true;
      }
    }

    // 2. Search for any shape stroke from top to bottom
    const allStrokes = annotationStore.getStrokes();
    for (let i = allStrokes.length - 1; i >= 0; i--) {
      const stroke = allStrokes[i];
      if (!this.isShapeStroke(stroke)) continue;

      if (this.hitTestStroke(coords, stroke)) {
        this.selectedStroke = stroke;
        this.isInteracting = true;
        this.interactionMode = 'move';
        this.activeHandle = null;
        this.startPointerCoords = coords;
        this.recordInitialState(stroke);
        annotationStore.saveSnapshot();
        this.renderOverlay();
        return true;
      }
    }

    // 3. Clicked empty space: deselect
    if (this.selectedStroke) {
      this.deselect();
    }
    return false;
  }

  handlePointerMove(e: PointerEvent): boolean {
    if (store.getState().activeTool !== 'select') return false;

    const coords = layerManager.toSlideCoords(e.clientX, e.clientY);

    if (!this.isInteracting || !this.selectedStroke) {
      // Update cursor when hovering over handles
      if (this.selectedStroke) {
        const box = this.getStrokeBox(this.selectedStroke);
        const handle = this.hitTestHandle(coords, box);
        if (handle) {
          layerManager.annotationCanvas.style.cursor = handle.cursor;
          return true;
        } else if (this.hitTestStroke(coords, this.selectedStroke)) {
          layerManager.annotationCanvas.style.cursor = 'move';
          return true;
        }
      }
      layerManager.annotationCanvas.style.cursor = 'default';
      return false;
    }

    const dx = coords.x - this.startPointerCoords.x;
    const dy = coords.y - this.startPointerCoords.y;

    if (this.interactionMode === 'move') {
      const newX = this.initialBox.x + dx;
      const newY = this.initialBox.y + dy;

      this.selectedStroke.box = {
        x: newX,
        y: newY,
        width: this.initialBox.width,
        height: this.initialBox.height
      };

      if (this.selectedStroke.startPoint) {
        this.selectedStroke.startPoint = {
          x: this.initialStartPoint.x + dx,
          y: this.initialStartPoint.y + dy
        };
      }
      if (this.selectedStroke.endPoint) {
        this.selectedStroke.endPoint = {
          x: this.initialEndPoint.x + dx,
          y: this.initialEndPoint.y + dy
        };
      }
      this.selectedStroke.points = this.initialPoints.map((p) => ({
        ...p,
        x: p.x + dx,
        y: p.y + dy
      }));
      if (this.selectedStroke.extraPoints) {
        this.selectedStroke.extraPoints = this.initialExtraPoints.map((p) => ({
          ...p,
          x: p.x + dx,
          y: p.y + dy
        }));
      }

      annotationStore.redrawAll();
      this.renderOverlay();
      return true;
    }

    if (this.interactionMode === 'resize' && this.activeHandle) {
      let { x, y, width: w, height: h } = this.initialBox;

      switch (this.activeHandle) {
        case 'se':
          w = Math.max(12, w + dx);
          h = Math.max(12, h + dy);
          break;
        case 'e':
          w = Math.max(12, w + dx);
          break;
        case 's':
          h = Math.max(12, h + dy);
          break;
        case 'ne':
          w = Math.max(12, w + dx);
          const newYNe = y + dy;
          if (h - dy >= 12) {
            y = newYNe;
            h = h - dy;
          }
          break;
        case 'n':
          if (h - dy >= 12) {
            y = y + dy;
            h = h - dy;
          }
          break;
        case 'nw':
          if (w - dx >= 12) {
            x = x + dx;
            w = w - dx;
          }
          if (h - dy >= 12) {
            y = y + dy;
            h = h - dy;
          }
          break;
        case 'w':
          if (w - dx >= 12) {
            x = x + dx;
            w = w - dx;
          }
          break;
        case 'sw':
          if (w - dx >= 12) {
            x = x + dx;
            w = w - dx;
          }
          h = Math.max(12, h + dy);
          break;
      }

      const scaleX = this.initialBox.width > 0 ? w / this.initialBox.width : 1;
      const scaleY = this.initialBox.height > 0 ? h / this.initialBox.height : 1;

      this.selectedStroke.box = { x, y, width: w, height: h };

      if (this.selectedStroke.startPoint) {
        this.selectedStroke.startPoint = {
          x: x + (this.initialStartPoint.x - this.initialBox.x) * scaleX,
          y: y + (this.initialStartPoint.y - this.initialBox.y) * scaleY
        };
      }
      if (this.selectedStroke.endPoint) {
        this.selectedStroke.endPoint = {
          x: x + (this.initialEndPoint.x - this.initialBox.x) * scaleX,
          y: y + (this.initialEndPoint.y - this.initialBox.y) * scaleY
        };
      }
      this.selectedStroke.points = this.initialPoints.map((p) => ({
        ...p,
        x: x + (p.x - this.initialBox.x) * scaleX,
        y: y + (p.y - this.initialBox.y) * scaleY
      }));
      if (this.selectedStroke.extraPoints) {
        this.selectedStroke.extraPoints = this.initialExtraPoints.map((p) => ({
          ...p,
          x: x + (p.x - this.initialBox.x) * scaleX,
          y: y + (p.y - this.initialBox.y) * scaleY
        }));
      }

      annotationStore.redrawAll();
      this.renderOverlay();
      return true;
    }

    return false;
  }

  handlePointerUp(): boolean {
    if (!this.isInteracting) return false;
    this.isInteracting = false;
    this.interactionMode = null;
    this.activeHandle = null;
    if (this.selectedStroke) {
      this.renderOverlay();
    }
    return true;
  }

  private recordInitialState(stroke: Stroke): void {
    const box = this.getStrokeBox(stroke);
    this.initialBox = { ...box };
    this.initialStartPoint = stroke.startPoint ? { ...stroke.startPoint } : { x: box.x, y: box.y };
    this.initialEndPoint = stroke.endPoint ? { ...stroke.endPoint } : { x: box.x + box.width, y: box.y + box.height };
    this.initialPoints = stroke.points ? stroke.points.map((p) => ({ ...p })) : [];
    this.initialExtraPoints = stroke.extraPoints ? stroke.extraPoints.map((p) => ({ ...p })) : [];
  }

  renderOverlay(): void {
    if (!this.selectedStroke) {
      this.clearOverlay();
      return;
    }

    const ctx = layerManager.previewCtx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const box = this.getStrokeBox(this.selectedStroke);
    const pad = 6;
    const x = box.x - pad;
    const y = box.y - pad;
    const w = box.width + pad * 2;
    const h = box.height + pad * 2;

    ctx.save();
    // Subtle translucent tint inside selected shape
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.fillRect(x, y, w, h);

    // Bounding dashed border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // 8 resize handles
    const handles = this.getHandles({ x, y, width: w, height: h });
    for (const handle of handles) {
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
    }

    ctx.restore();
  }

  clearOverlay(): void {
    const ctx = layerManager.previewCtx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    layerManager.annotationCanvas.style.cursor = 'default';
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedStroke) {
        // If an input is focused, don't delete shape
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;

        const allStrokes = annotationStore.getAllStrokes();
        const idx = allStrokes.indexOf(this.selectedStroke);
        if (idx !== -1) {
          annotationStore.saveSnapshot();
          allStrokes.splice(idx, 1);
          annotationStore.redrawAll();
          this.deselect();
        }
      }
    });
  }
}

export const shapeSelector = new ShapeSelector();
