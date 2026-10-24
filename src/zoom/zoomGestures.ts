// SSIRO-UPDATE: Gesture & Input Handler for Whole-slide Zoom & Pinch
import { store } from '../state/store';
import { layerManager } from '../core/layers';
import { zoomController } from './zoomController';

export class ZoomGestureHandler {
  private isPinching = false;
  private initialPinchDist = 0;
  private initialScale = 1.0;
  private pinchMidX = 0;
  private pinchMidY = 0;

  private isPanning = false;
  private lastPanX = 0;
  private lastPanY = 0;
  private lastPanTime = 0;
  private panVelocityX = 0;
  private panVelocityY = 0;

  // Middle mouse dragging
  private isMiddleMouseDown = false;

  // Single finger / tool dragging when activeTool === 'zoom'
  private isSingleFingerDrag = false;
  private singleTapStartTime = 0;
  private singleTapStartX = 0;
  private singleTapStartY = 0;

  init(): void {
    const stage = layerManager.stageEl;

    this.bindTouchGestures(stage);
    this.bindMouseAndWheel(stage);
    this.bindKeyboard();
  }

  private bindTouchGestures(stage: HTMLElement): void {
    stage.addEventListener('touchstart', (e: TouchEvent) => {
      const state = store.getState();

      if (e.touches.length === 2) {
        // Multi-touch pinch starts (works in every tool per C6 spec)
        this.isPinching = true;
        this.isPanning = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        this.initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        this.initialScale = zoomController.getScale();

        const stageRect = stage.getBoundingClientRect();
        this.pinchMidX = (t1.clientX + t2.clientX) / 2 - stageRect.left;
        this.pinchMidY = (t1.clientY + t2.clientY) / 2 - stageRect.top;

        this.lastPanX = (t1.clientX + t2.clientX) / 2;
        this.lastPanY = (t1.clientY + t2.clientY) / 2;
        this.lastPanTime = performance.now();
        this.panVelocityX = 0;
        this.panVelocityY = 0;
      } else if (e.touches.length === 1 && state.activeTool === 'zoom') {
        // Zoom tool active: single touch pans
        this.isSingleFingerDrag = true;
        const t = e.touches[0];
        this.lastPanX = t.clientX;
        this.lastPanY = t.clientY;
        this.lastPanTime = performance.now();
        this.singleTapStartX = t.clientX;
        this.singleTapStartY = t.clientY;
        this.singleTapStartTime = performance.now();
        this.panVelocityX = 0;
        this.panVelocityY = 0;
      } else if (e.touches.length === 3) {
        // Three-finger tap opens toolbar when hidden per conflict rule
        if (state.isZen && !state.isToolbarVisibleInZen) {
          store.setState({ isToolbarVisibleInZen: true });
        }
      }
    }, { passive: true });

    stage.addEventListener('touchmove', (e: TouchEvent) => {
      const state = store.getState();

      if (this.isPinching && e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const ratio = currentDist / Math.max(1, this.initialPinchDist);

        let targetScale = this.initialScale * ratio;
        // Rubber-band at limits (1x to 8x)
        if (targetScale < 1.0) {
          targetScale = 1.0 - (1.0 - targetScale) * 0.3;
        } else if (targetScale > 8.0) {
          targetScale = 8.0 + (targetScale - 8.0) * 0.3;
        }

        const stageRect = stage.getBoundingClientRect();
        const currentMidX = (t1.clientX + t2.clientX) / 2 - stageRect.left;
        const currentMidY = (t1.clientY + t2.clientY) / 2 - stageRect.top;

        // Apply 1:1 gesture zoom
        zoomController.zoomAt(targetScale, currentMidX, currentMidY, true);

        // Two finger pan
        const currentPanX = (t1.clientX + t2.clientX) / 2;
        const currentPanY = (t1.clientY + t2.clientY) / 2;
        const dx = currentPanX - this.lastPanX;
        const dy = currentPanY - this.lastPanY;

        const now = performance.now();
        const dt = Math.max(1, now - this.lastPanTime);
        this.panVelocityX = (dx / dt) * 16;
        this.panVelocityY = (dy / dt) * 16;

        this.lastPanX = currentPanX;
        this.lastPanY = currentPanY;
        this.lastPanTime = now;

        if (zoomController.getScale() > 1.05) {
          zoomController.panBy(dx, dy);
        }
      } else if (this.isSingleFingerDrag && e.touches.length === 1 && state.activeTool === 'zoom') {
        const t = e.touches[0];
        const dx = t.clientX - this.lastPanX;
        const dy = t.clientY - this.lastPanY;

        const now = performance.now();
        const dt = Math.max(1, now - this.lastPanTime);
        this.panVelocityX = (dx / dt) * 16;
        this.panVelocityY = (dy / dt) * 16;

        this.lastPanX = t.clientX;
        this.lastPanY = t.clientY;
        this.lastPanTime = now;

        zoomController.panBy(dx, dy);
      }
    }, { passive: true });

    stage.addEventListener('touchend', (e: TouchEvent) => {
      const state = store.getState();

      if (this.isPinching && e.touches.length < 2) {
        this.isPinching = false;
        // Apply inertia if was panning
        if (Math.hypot(this.panVelocityX, this.panVelocityY) > 2) {
          zoomController.applyInertia(this.panVelocityX, this.panVelocityY);
        }
      }

      if (this.isSingleFingerDrag && e.touches.length === 0) {
        this.isSingleFingerDrag = false;
        const touch = e.changedTouches[0];
        const now = performance.now();
        const dt = now - this.singleTapStartTime;
        const dist = touch ? Math.hypot(touch.clientX - this.singleTapStartX, touch.clientY - this.singleTapStartY) : 100;

        // Check tap-to-zoom when Zoom tool is active
        if (dt < 250 && dist < 15 && state.activeTool === 'zoom') {
          this.handleTapToZoom(touch.clientX, touch.clientY);
        } else if (Math.hypot(this.panVelocityX, this.panVelocityY) > 2) {
          zoomController.applyInertia(this.panVelocityX, this.panVelocityY);
        }
      }
    }, { passive: true });
  }

  private handleTapToZoom(clientX: number, clientY: number): void {
    const stageRect = layerManager.stageEl.getBoundingClientRect();
    const cx = clientX - stageRect.left;
    const cy = clientY - stageRect.top;

    const currentScale = zoomController.getScale();
    if (currentScale > 1.05) {
      // Return to 1x
      zoomController.animateZoom(1.0);
    } else {
      // Tap-to-zoom animates to 2.5x centered on the tap per spec C6
      zoomController.animateZoom(2.5, cx, cy);
    }
  }

  private bindMouseAndWheel(stage: HTMLElement): void {
    // Wheel zoom: Ctrl+wheel or plain wheel with Zoom tool
    stage.addEventListener('wheel', (e: WheelEvent) => {
      const state = store.getState();
      const isZoomTool = state.activeTool === 'zoom';

      if (e.ctrlKey || isZoomTool) {
        e.preventDefault();
        const stageRect = stage.getBoundingClientRect();
        const cx = e.clientX - stageRect.left;
        const cy = e.clientY - stageRect.top;

        const currentScale = zoomController.getScale();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        const targetScale = currentScale * factor;

        zoomController.zoomAt(targetScale, cx, cy, false);
      }
    }, { passive: false });

    // Middle-mouse drag or Zoom tool mouse drag
    stage.addEventListener('mousedown', (e: MouseEvent) => {
      const state = store.getState();
      if (e.button === 1 || (e.button === 0 && state.activeTool === 'zoom')) {
        // Don't drag if clicked on UI
        if ((e.target as HTMLElement).closest('.toolbar-container, .popover, .header, .settings-modal')) return;

        e.preventDefault();
        this.isMiddleMouseDown = true;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        this.lastPanTime = performance.now();
        this.panVelocityX = 0;
        this.panVelocityY = 0;
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isMiddleMouseDown) return;
      e.preventDefault();
      const dx = e.clientX - this.lastPanX;
      const dy = e.clientY - this.lastPanY;

      const now = performance.now();
      const dt = Math.max(1, now - this.lastPanTime);
      this.panVelocityX = (dx / dt) * 16;
      this.panVelocityY = (dy / dt) * 16;

      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.lastPanTime = now;

      zoomController.panBy(dx, dy);
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (this.isMiddleMouseDown) {
        this.isMiddleMouseDown = false;
        if (Math.hypot(this.panVelocityX, this.panVelocityY) > 2) {
          zoomController.applyInertia(this.panVelocityX, this.panVelocityY);
        }
      }
    });

    // Double-click with Zoom tool active toggles zoom
    stage.addEventListener('dblclick', (e: MouseEvent) => {
      const state = store.getState();
      if (state.activeTool === 'zoom') {
        e.stopPropagation();
        this.handleTapToZoom(e.clientX, e.clientY);
      }
    });
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.key === '+' || e.key === '=') {
        zoomController.animateZoom(zoomController.getScale() * 1.25);
      } else if (e.key === '-' || e.key === '_') {
        zoomController.animateZoom(zoomController.getScale() / 1.25);
      } else if (e.key === '0') {
        zoomController.resetZoom();
      } else if (e.key === 'z' || e.key === 'Z') {
        if (!e.ctrlKey && !e.metaKey) {
          const state = store.getState();
          if (state.activeTool === 'zoom') {
            store.setState({ activeTool: 'select' });
          } else {
            store.setState({ activeTool: 'zoom' });
          }
        }
      }
    });
  }
}

export const zoomGestureHandler = new ZoomGestureHandler();
