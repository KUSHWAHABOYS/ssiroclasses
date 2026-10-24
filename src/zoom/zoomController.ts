// SSIRO-UPDATE: Whole-slide Zoom Controller
import { store } from '../state/store';
import { layerManager } from '../core/layers';

export interface ZoomTransform {
  scale: number;
  panX: number;
  panY: number;
}

export class ZoomController {
  private zoomRoot: HTMLElement | null = null;
  private zoomIndicator: HTMLElement | null = null;
  private btnResetChip: HTMLElement | null = null;

  private scale = 1.0;
  private panX = 0;
  private panY = 0;

  private minScale = 1.0;
  private maxScale = 8.0;

  private isAnimating = false;
  private animationFrameId = 0;
  private inertiaFrameId = 0;
  private indicatorTimer = 0;
  private settleTimer = 0;

  private onTransformChangeCallbacks: Array<(transform: ZoomTransform) => void> = [];
  private onSettleCallbacks: Array<(transform: ZoomTransform) => void> = [];

  init(): void {
    this.zoomRoot = document.getElementById('zoomRoot');
    this.zoomIndicator = document.getElementById('zoomIndicator');
    this.btnResetChip = document.getElementById('btnZoomReset');

    this.btnResetChip?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.animateZoom(1.0);
    });

    // SSIRO-UPDATE: Hook coordinate conversion into layerManager
    layerManager.setSlideCoordsConverter((cx, cy) => this.toSlideCoords(cx, cy));

    // When window resizes, clamp transform
    layerManager.onResize(() => {
      this.clampAndApply(false);
    });
  }

  getTransform(): ZoomTransform {
    return { scale: this.scale, panX: this.panX, panY: this.panY };
  }

  getScale(): number {
    return this.scale;
  }

  onTransformChange(cb: (t: ZoomTransform) => void): void {
    this.onTransformChangeCallbacks.push(cb);
  }

  onSettle(cb: (t: ZoomTransform) => void): void {
    this.onSettleCallbacks.push(cb);
  }

  /**
   * Convert client viewport screen coordinates (e.g. from PointerEvent)
   * through the inverse view transform into slide / canvas coordinates.
   */
  toSlideCoords(clientX: number, clientY: number): { x: number; y: number } {
    const stageRect = layerManager.stageEl.getBoundingClientRect();
    const stageX = clientX - stageRect.left;
    const stageY = clientY - stageRect.top;

    return {
      x: (stageX - this.panX) / this.scale,
      y: (stageY - this.panY) / this.scale
    };
  }

  /**
   * Convert slide / canvas coordinates into stage-relative screen coordinates.
   */
  toStageCoords(slideX: number, slideY: number): { x: number; y: number } {
    return {
      x: slideX * this.scale + this.panX,
      y: slideY * this.scale + this.panY
    };
  }

  /**
   * Convert slide / canvas coordinates to client window coordinates.
   */
  toClientCoords(slideX: number, slideY: number): { clientX: number; clientY: number } {
    const stageRect = layerManager.stageEl.getBoundingClientRect();
    const stagePoint = this.toStageCoords(slideX, slideY);
    return {
      clientX: stagePoint.x + stageRect.left,
      clientY: stagePoint.y + stageRect.top
    };
  }

  /**
   * Zoom centered at a stage coordinate (cx, cy).
   */
  zoomAt(newScale: number, cx: number, cy: number, immediate = false): void {
    const clampedScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    if (Math.abs(clampedScale - this.scale) < 0.001) return;

    const oldScale = this.scale;
    const scaleRatio = clampedScale / oldScale;

    // Fixed point equation: cx - newPanX = (cx - oldPanX) * (newScale / oldScale)
    const newPanX = cx - (cx - this.panX) * scaleRatio;
    const newPanY = cy - (cy - this.panY) * scaleRatio;

    if (immediate) {
      this.scale = clampedScale;
      this.panX = newPanX;
      this.panY = newPanY;
      this.clampAndApply(true);
    } else {
      this.animateTo(clampedScale, newPanX, newPanY, 280);
    }
  }

  /**
   * Directly pan by delta pixels in stage space.
   */
  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.clampAndApply(true);
  }

  /**
   * Apply inertial panning with friction = 0.92 per C6 spec.
   */
  applyInertia(initialVx: number, initialVy: number): void {
    cancelAnimationFrame(this.inertiaFrameId);
    let vx = initialVx;
    let vy = initialVy;
    const friction = 0.92;

    const step = () => {
      if (Math.hypot(vx, vy) < 0.1) {
        cancelAnimationFrame(this.inertiaFrameId);
        this.triggerSettle();
        return;
      }
      this.panX += vx;
      this.panY += vy;
      vx *= friction;
      vy *= friction;
      this.clampAndApply(false);
      this.inertiaFrameId = requestAnimationFrame(step);
    };

    this.inertiaFrameId = requestAnimationFrame(step);
  }

  /**
   * Animate smoothly to a target scale (centered at stage center if no point given).
   */
  animateZoom(targetScale: number, centerX?: number, centerY?: number, durationMs = 280): void {
    const stageDims = layerManager.getDimensions();
    const cx = centerX !== undefined ? centerX : stageDims.width / 2;
    const cy = centerY !== undefined ? centerY : stageDims.height / 2;

    const clampedScale = Math.max(this.minScale, Math.min(this.maxScale, targetScale));
    const oldScale = this.scale;
    const scaleRatio = clampedScale / oldScale;

    const targetPanX = clampedScale <= 1.0 ? 0 : cx - (cx - this.panX) * scaleRatio;
    const targetPanY = clampedScale <= 1.0 ? 0 : cy - (cy - this.panY) * scaleRatio;

    this.animateTo(clampedScale, targetPanX, targetPanY, durationMs);
  }

  private animateTo(targetScale: number, targetPanX: number, targetPanY: number, durationMs: number): void {
    cancelAnimationFrame(this.animationFrameId);
    cancelAnimationFrame(this.inertiaFrameId);

    const startScale = this.scale;
    const startPanX = this.panX;
    const startPanY = this.panY;

    // Pre-clamp targets
    const stageDims = layerManager.getDimensions();
    const minPanX = (1 - targetScale) * stageDims.width;
    const minPanY = (1 - targetScale) * stageDims.height;
    const clampedTargetPanX = targetScale <= 1.0 ? 0 : Math.max(minPanX, Math.min(0, targetPanX));
    const clampedTargetPanY = targetScale <= 1.0 ? 0 : Math.max(minPanY, Math.min(0, targetPanY));

    const startTime = performance.now();
    this.isAnimating = true;

    // Cubic ease-in-out
    const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const ease = easeInOut(progress);

      this.scale = startScale + (targetScale - startScale) * ease;
      this.panX = startPanX + (clampedTargetPanX - startPanX) * ease;
      this.panY = startPanY + (clampedTargetPanY - startPanY) * ease;

      this.clampAndApply(false);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(tick);
      } else {
        this.isAnimating = false;
        this.scale = targetScale;
        this.panX = clampedTargetPanX;
        this.panY = clampedTargetPanY;
        this.clampAndApply(true);
        this.triggerSettle();
      }
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  /**
   * Reset zoom level back to 1.0x.
   */
  resetZoom(immediate = false): void {
    if (this.scale === 1.0 && this.panX === 0 && this.panY === 0) return;

    if (immediate) {
      cancelAnimationFrame(this.animationFrameId);
      cancelAnimationFrame(this.inertiaFrameId);
      this.scale = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.clampAndApply(true);
    } else {
      this.animateZoom(1.0);
    }
  }

  /**
   * Called on slide change. Resets to 1x if keepZoomOnSlideChange setting is false.
   */
  onSlideChange(): void {
    const settings = store.getState().settings;
    if (!settings.keepZoomOnSlideChange) {
      this.resetZoom(true);
    }
  }

  /**
   * Clamp panning so slide always covers the stage completely (no empty margin gaps).
   */
  private clampAndApply(showIndicator = false): void {
    const stageDims = layerManager.getDimensions();
    const w = stageDims.width;
    const h = stageDims.height;

    if (this.scale <= 1.001) {
      this.scale = 1.0;
      this.panX = 0;
      this.panY = 0;
    } else {
      // Boundaries: content covers stage: panX in [(1 - scale) * w, 0], panY in [(1 - scale) * h, 0]
      const minPanX = (1 - this.scale) * w;
      const minPanY = (1 - this.scale) * h;
      this.panX = Math.max(minPanX, Math.min(0, this.panX));
      this.panY = Math.max(minPanY, Math.min(0, this.panY));
    }

    if (!this.zoomRoot) {
      this.zoomRoot = document.getElementById('zoomRoot');
    }

    if (this.zoomRoot) {
      this.zoomRoot.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }

    // Reset button visibility
    if (this.btnResetChip) {
      if (this.scale > 1.05) {
        this.btnResetChip.classList.remove('hidden');
      } else {
        this.btnResetChip.classList.add('hidden');
      }
    }

    if (showIndicator && this.scale > 1.05) {
      this.showIndicator(`${this.scale.toFixed(1)}×`);
    }

    const t = this.getTransform();
    for (const cb of this.onTransformChangeCallbacks) {
      try {
        cb(t);
      } catch (e) {
        console.error('Error in onTransformChange callback:', e);
      }
    }

    this.debounceSettle();
  }

  private debounceSettle(): void {
    window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      this.triggerSettle();
    }, 150);
  }

  private triggerSettle(): void {
    const t = this.getTransform();
    for (const cb of this.onSettleCallbacks) {
      try {
        cb(t);
      } catch (e) {
        console.error('Error in onSettle callback:', e);
      }
    }
  }

  showIndicator(text: string): void {
    if (!this.zoomIndicator) {
      this.zoomIndicator = document.getElementById('zoomIndicator');
    }
    if (!this.zoomIndicator) return;

    this.zoomIndicator.textContent = text;
    this.zoomIndicator.classList.remove('hidden');
    this.zoomIndicator.style.opacity = '1';

    window.clearTimeout(this.indicatorTimer);
    this.indicatorTimer = window.setTimeout(() => {
      if (this.zoomIndicator) {
        this.zoomIndicator.style.opacity = '0';
        window.setTimeout(() => {
          if (this.zoomIndicator && this.zoomIndicator.style.opacity === '0') {
            this.zoomIndicator.classList.add('hidden');
          }
        }, 300);
      }
    }, 1500);
  }
}

export const zoomController = new ZoomController();
