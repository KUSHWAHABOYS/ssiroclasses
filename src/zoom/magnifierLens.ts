// SSIRO-UPDATE: Magnifier Lens Controller (Follow & Pin, 4K crisp, Spotlight)
import { store } from '../state/store';
import { layerManager } from '../core/layers';
import { slideRenderer } from '../presenter/renderer';
import { zoomController } from './zoomController';

export interface PinnedLens {
  id: string;
  stageX: number;
  stageY: number;
  slideX: number;
  slideY: number;
  size: number;
  zoom: number;
  isCircle: boolean;
  mode: 'glass' | 'fixed'; // glass shows what is under ring; fixed freezes original slide point
  containerEl: HTMLElement;
  canvasEl: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export class MagnifierLensController {
  private lensCanvas: HTMLCanvasElement | null = null;
  private lensCtx: CanvasRenderingContext2D | null = null;
  private spotlightLayer: HTMLElement | null = null;
  private spotlightCanvas: HTMLCanvasElement | null = null;
  private spotlightCtx: CanvasRenderingContext2D | null = null;

  // Follow lens state
  private isFollowActive = false;
  private isFollowVisible = false;
  private followTargetX = 0; // Where user is pointing/touching
  private followTargetY = 0;
  private followDisplayX = 0; // Where lens center eases to
  private followDisplayY = 0;
  private followScale = 0.6; // For pop-in spring animation
  private followOpacity = 0;
  private touchFadeTimer = 0;
  private longPressTimer = 0;
  private isTouching = false;
  private isHovering = false;

  // Pinned lenses (max 3)
  private pinnedLenses: PinnedLens[] = [];

  // Animation & Rendering loop
  private animFrameId = 0;
  private isRunning = false;
  private needsRedraw = true;

  init(): void {
    this.lensCanvas = document.getElementById('lensCanvas') as HTMLCanvasElement;
    if (this.lensCanvas) {
      this.lensCtx = this.lensCanvas.getContext('2d', { alpha: true });
    }

    this.spotlightLayer = document.getElementById('spotlightLayer');
    if (this.spotlightLayer) {
      this.initSpotlightCanvas();
    }

    this.bindPointerEvents();
    this.bindKeyboardAndWheel();

    // Resize handling
    layerManager.onResize(() => {
      this.updateCanvasDimensions();
      this.needsRedraw = true;
    });

    // Store listener for tool changes
    store.subscribe((state, prev) => {
      if (state.activeTool === 'magnifier' && prev.activeTool !== 'magnifier') {
        this.activate();
      } else if (state.activeTool !== 'magnifier' && prev.activeTool === 'magnifier') {
        this.deactivateFollow();
      }

      if (state.currentPage !== prev.currentPage || state.isBoardMode !== prev.isBoardMode) {
        this.onSlideChange();
      }

      if (state.settings.magnifierSpotlight !== prev.settings.magnifierSpotlight) {
        this.needsRedraw = true;
      }
    });

    // Zoom transform updates
    zoomController.onTransformChange(() => {
      this.needsRedraw = true;
    });

    this.updateCanvasDimensions();
    this.startLoop();
  }

  private initSpotlightCanvas(): void {
    if (!this.spotlightLayer) return;
    this.spotlightLayer.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.pointerEvents = 'none';
    this.spotlightLayer.appendChild(canvas);
    this.spotlightCanvas = canvas;
    this.spotlightCtx = canvas.getContext('2d', { alpha: true });
  }

  private updateCanvasDimensions(): void {
    const dims = layerManager.getDimensions();
    if (this.lensCanvas) {
      this.lensCanvas.width = dims.width;
      this.lensCanvas.height = dims.height;
      this.lensCanvas.style.width = `${dims.width}px`;
      this.lensCanvas.style.height = `${dims.height}px`;
    }

    if (this.spotlightCanvas) {
      this.spotlightCanvas.width = dims.width;
      this.spotlightCanvas.height = dims.height;
    }
  }

  private activate(): void {
    this.isFollowActive = true;
    this.isFollowVisible = false;
    this.followScale = 0.6;
    this.followOpacity = 0;
    this.needsRedraw = true;
  }

  private deactivateFollow(): void {
    this.isFollowActive = false;
    this.isFollowVisible = false;
    this.needsRedraw = true;
    if (this.lensCtx && this.lensCanvas) {
      this.lensCtx.clearRect(0, 0, this.lensCanvas.width, this.lensCanvas.height);
    }
    this.clearSpotlight();
  }

  onSlideChange(): void {
    const settings = store.getState().settings;
    if (!settings.keepLensOnSlideChange) {
      this.clearAllPinnedLenses();
    }
    this.needsRedraw = true;
  }

  clearAllPinnedLenses(): void {
    for (const lens of this.pinnedLenses) {
      lens.containerEl.remove();
    }
    this.pinnedLenses = [];
    this.needsRedraw = true;
  }

  private bindPointerEvents(): void {
    const stage = layerManager.stageEl;

    stage.addEventListener('pointermove', (e: PointerEvent) => {
      const state = store.getState();
      if (state.activeTool !== 'magnifier') return;

      const stageCoords = layerManager.toStageCoords(e.clientX, e.clientY);
      this.handlePointerPosition(stageCoords.x, stageCoords.y, e.pointerType);
    }, { passive: true });

    stage.addEventListener('pointerdown', (e: PointerEvent) => {
      const state = store.getState();
      if (state.activeTool !== 'magnifier') return;

      // Don't act if clicked on toolbar, popovers or pinned lens controls
      if ((e.target as HTMLElement).closest('.toolbar-container, .popover, .pinned-lens-container, .header, .settings-modal')) {
        return;
      }

      window.clearTimeout(this.touchFadeTimer);
      const stageCoords = layerManager.toStageCoords(e.clientX, e.clientY);
      this.isTouching = true;
      this.isFollowVisible = true;

      // Initial position jump if opening freshly
      if (this.followOpacity < 0.1) {
        this.followTargetX = stageCoords.x;
        this.followTargetY = stageCoords.y;
        this.followDisplayX = stageCoords.x;
        this.followDisplayY = stageCoords.y;
      }

      this.handlePointerPosition(stageCoords.x, stageCoords.y, e.pointerType);

      // Long press (500ms) or Alt+click to pin lens
      window.clearTimeout(this.longPressTimer);
      if (e.altKey || state.settings.magnifierMode === 'pin') {
        this.pinLensAt(stageCoords.x, stageCoords.y);
      } else {
        this.longPressTimer = window.setTimeout(() => {
          if (this.isTouching && this.isFollowActive) {
            this.pinLensAt(this.followTargetX, this.followTargetY);
            // Haptic feedback if available
            if ('vibrate' in navigator) navigator.vibrate(40);
          }
        }, 500);
      }
    });

    stage.addEventListener('pointerup', (e: PointerEvent) => {
      window.clearTimeout(this.longPressTimer);
      this.isTouching = false;

      if (e.pointerType === 'touch') {
        // Finger: fades out 250 ms after release unless pinned
        this.touchFadeTimer = window.setTimeout(() => {
          this.isFollowVisible = false;
          this.needsRedraw = true;
        }, 250);
      }
    });

    stage.addEventListener('pointercancel', () => {
      window.clearTimeout(this.longPressTimer);
      this.isTouching = false;
      this.isFollowVisible = false;
      this.needsRedraw = true;
    });

    stage.addEventListener('pointerleave', () => {
      if (!this.isTouching) {
        this.isFollowVisible = false;
        this.needsRedraw = true;
      }
    });
  }

  private handlePointerPosition(stageX: number, stageY: number, pointerType: string): void {
    this.followTargetX = stageX;
    this.followTargetY = stageY;
    this.isFollowVisible = true;

    const settings = store.getState().settings;
    const size = this.getEffectiveSize();
    const radius = size / 2;

    // Calculate ideal display center
    let dispX = stageX;
    let dispY = stageY;

    if (pointerType === 'touch' && settings.magnifierTouchPos === 'above') {
      // Touch: lens sits above the fingertip (offset radius + 24 px, flipping below near top edge)
      dispY = stageY - (radius + 24);
      if (dispY - radius < 10) {
        dispY = stageY + (radius + 24); // Flip below
      }
    }

    // Clamp display center inside stage
    const dims = layerManager.getDimensions();
    dispX = Math.max(radius, Math.min(dims.width - radius, dispX));
    dispY = Math.max(radius, Math.min(dims.height - radius, dispY));

    this.followTargetDisplayX = dispX;
    this.followTargetDisplayY = dispY;
    this.needsRedraw = true;
  }

  private followTargetDisplayX = 0;
  private followTargetDisplayY = 0;

  private bindKeyboardAndWheel(): void {
    // Wheel changes magnification (0.25x), Shift+wheel changes size
    window.addEventListener('wheel', (e: WheelEvent) => {
      const state = store.getState();
      if (state.activeTool !== 'magnifier' || !this.isFollowVisible) return;

      e.preventDefault();
      const settings = state.settings;

      if (e.shiftKey) {
        // Change size
        const step = e.deltaY < 0 ? 20 : -20;
        const newSize = Math.max(120, Math.min(600, (settings.magnifierSize || 280) + step));
        store.updateSettings({ magnifierSize: newSize });
      } else {
        // Change magnification
        const step = e.deltaY < 0 ? 0.25 : -0.25;
        const newZoom = Math.max(1.5, Math.min(8.0, (settings.magnifierZoom || 3.0) + step));
        store.updateSettings({ magnifierZoom: Number(newZoom.toFixed(2)) });
        zoomController.showIndicator(`${newZoom.toFixed(1)}×`);
      }
      this.needsRedraw = true;
    }, { passive: false });

    // Keyboard shortcuts: M toggles magnifier, Esc closes
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.key === 'm' || e.key === 'M') {
        const state = store.getState();
        if (state.activeTool === 'magnifier') {
          store.setState({ activeTool: 'select' });
        } else {
          store.setState({ activeTool: 'magnifier' });
        }
      } else if (e.key === 'Escape') {
        if (store.getState().activeTool === 'magnifier') {
          store.setState({ activeTool: 'select' });
        }
      }
    });
  }

  private getEffectiveSize(): number {
    const settings = store.getState().settings;
    if (settings.magnifierSize) return settings.magnifierSize;
    const dims = layerManager.getDimensions();
    return dims.width > 1800 ? 280 : 220;
  }

  /**
   * Pin a lens at the given stage coordinates (maximum 3, 4th replaces oldest).
   */
  pinLensAt(stageX: number, stageY: number): void {
    if (this.pinnedLenses.length >= 3) {
      // Remove oldest
      const oldest = this.pinnedLenses.shift();
      oldest?.containerEl.remove();
    }

    const id = `lens_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const settings = store.getState().settings;
    const size = this.getEffectiveSize();
    const zoom = settings.magnifierZoom || 3.0;
    const isCircle = (settings.magnifierShape || 'circle') === 'circle';

    // Slide coordinates for fixed mode
    const slideCoords = zoomController.toSlideCoords(
      stageX + layerManager.stageEl.getBoundingClientRect().left,
      stageY + layerManager.stageEl.getBoundingClientRect().top
    );

    const container = document.createElement('div');
    container.className = `pinned-lens-container ${isCircle ? 'is-circle' : 'is-rect'}`;
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.left = `${stageX - size / 2}px`;
    container.style.top = `${stageY - size / 2}px`;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.className = 'pinned-lens-canvas';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: true })!;

    // Overlay controls bar (close, zoom +/-, mode toggle)
    const controls = document.createElement('div');
    controls.className = 'pinned-lens-controls';
    controls.innerHTML = `
      <button class="lens-ctrl-btn btn-mode" title="Toggle Fixed/Glass">🔍</button>
      <button class="lens-ctrl-btn btn-zoom-in" title="Zoom In">+</button>
      <button class="lens-ctrl-btn btn-zoom-out" title="Zoom Out">−</button>
      <button class="lens-ctrl-btn btn-close" title="Close">✕</button>
    `;
    container.appendChild(controls);

    // Corner resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'pinned-lens-resize-handle';
    container.appendChild(resizeHandle);

    document.getElementById('stage')?.appendChild(container);

    const lens: PinnedLens = {
      id,
      stageX,
      stageY,
      slideX: slideCoords.x,
      slideY: slideCoords.y,
      size,
      zoom,
      isCircle,
      mode: 'glass',
      containerEl: container,
      canvasEl: canvas,
      ctx
    };

    this.bindPinnedLensEvents(lens);
    this.pinnedLenses.push(lens);
    this.needsRedraw = true;

    // Toast
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message: `लेंस टिकाया गया (Lens Pinned: ${this.pinnedLenses.length}/3)` }
    }));
  }

  private bindPinnedLensEvents(lens: PinnedLens): void {
    const container = lens.containerEl;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let lensStartX = 0;
    let lensStartY = 0;

    // Drag by ring
    container.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.lens-ctrl-btn, .pinned-lens-resize-handle')) return;
      e.stopPropagation();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      lensStartX = lens.stageX;
      lensStartY = lens.stageY;
      container.setPointerCapture(e.pointerId);
    });

    container.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isDragging) return;
      e.stopPropagation();
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      lens.stageX = lensStartX + dx;
      lens.stageY = lensStartY + dy;
      container.style.left = `${lens.stageX - lens.size / 2}px`;
      container.style.top = `${lens.stageY - lens.size / 2}px`;
      this.needsRedraw = true;
    });

    const stopDrag = (e: PointerEvent) => {
      if (isDragging) {
        isDragging = false;
        try { container.releasePointerCapture(e.pointerId); } catch {}
        this.needsRedraw = true;
      }
    };
    container.addEventListener('pointerup', stopDrag);
    container.addEventListener('pointercancel', stopDrag);

    // Controls
    const btnMode = container.querySelector('.btn-mode') as HTMLElement;
    btnMode?.addEventListener('click', (e) => {
      e.stopPropagation();
      lens.mode = lens.mode === 'glass' ? 'fixed' : 'glass';
      btnMode.textContent = lens.mode === 'fixed' ? '🔒' : '🔍';
      this.needsRedraw = true;
    });

    const btnZoomIn = container.querySelector('.btn-zoom-in') as HTMLElement;
    btnZoomIn?.addEventListener('click', (e) => {
      e.stopPropagation();
      lens.zoom = Math.min(8.0, lens.zoom + 0.5);
      this.needsRedraw = true;
    });

    const btnZoomOut = container.querySelector('.btn-zoom-out') as HTMLElement;
    btnZoomOut?.addEventListener('click', (e) => {
      e.stopPropagation();
      lens.zoom = Math.max(1.5, lens.zoom - 0.5);
      this.needsRedraw = true;
    });

    const btnClose = container.querySelector('.btn-close') as HTMLElement;
    btnClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removePinnedLens(lens.id);
    });

    // Resize handle
    const resizeHandle = container.querySelector('.pinned-lens-resize-handle') as HTMLElement;
    let isResizing = false;
    let resizeStartDist = 0;
    let initialLensSize = 0;

    resizeHandle?.addEventListener('pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
      isResizing = true;
      resizeHandle.setPointerCapture(e.pointerId);
      initialLensSize = lens.size;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      resizeStartDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    });

    resizeHandle?.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isResizing) return;
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const currentDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      const ratio = currentDist / Math.max(1, resizeStartDist);
      const newSize = Math.max(120, Math.min(600, Math.round(initialLensSize * ratio)));

      lens.size = newSize;
      container.style.width = `${newSize}px`;
      container.style.height = `${newSize}px`;
      container.style.left = `${lens.stageX - newSize / 2}px`;
      container.style.top = `${lens.stageY - newSize / 2}px`;
      lens.canvasEl.width = newSize;
      lens.canvasEl.height = newSize;
      this.needsRedraw = true;
    });

    const stopResize = (e: PointerEvent) => {
      if (isResizing) {
        isResizing = false;
        try { resizeHandle.releasePointerCapture(e.pointerId); } catch {}
        this.needsRedraw = true;
      }
    };
    resizeHandle?.addEventListener('pointerup', stopResize);
    resizeHandle?.addEventListener('pointercancel', stopResize);
  }

  removePinnedLens(id: string): void {
    const idx = this.pinnedLenses.findIndex(l => l.id === id);
    if (idx !== -1) {
      this.pinnedLenses[idx].containerEl.remove();
      this.pinnedLenses.splice(idx, 1);
      this.needsRedraw = true;
    }
  }

  private startLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const tick = () => {
      this.updateFollowPosition();
      if (this.needsRedraw || this.isFollowVisible || this.pinnedLenses.length > 0) {
        this.renderAll();
      }
      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private updateFollowPosition(): void {
    if (!this.isFollowActive || !this.isFollowVisible) {
      if (this.followOpacity > 0) {
        this.followOpacity = Math.max(0, this.followOpacity - 0.15);
        this.needsRedraw = true;
      }
      return;
    }

    // Easing toward pointer (lerp 0.35 per frame in rAF per spec C3)
    const lerp = 0.35;
    const dx = this.followTargetDisplayX - this.followDisplayX;
    const dy = this.followTargetDisplayY - this.followDisplayY;

    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      this.followDisplayX += dx * lerp;
      this.followDisplayY += dy * lerp;
      this.needsRedraw = true;
    } else {
      this.followDisplayX = this.followTargetDisplayX;
      this.followDisplayY = this.followTargetDisplayY;
    }

    // Spring appearance scale 0.6 -> 1.0 with soft overshoot (C5)
    if (this.followScale < 1.0) {
      this.followScale += (1.05 - this.followScale) * 0.25;
      if (this.followScale >= 1.0) this.followScale = 1.0;
      this.needsRedraw = true;
    }
    if (this.followOpacity < 1.0) {
      this.followOpacity = Math.min(1.0, this.followOpacity + 0.2);
      this.needsRedraw = true;
    }
  }

  private renderAll(): void {
    const dims = layerManager.getDimensions();
    const settings = store.getState().settings;

    // 1. Render spotlight dim layer
    if (settings.magnifierSpotlight && (this.isFollowVisible || this.pinnedLenses.length > 0)) {
      this.renderSpotlight(dims.width, dims.height);
    } else {
      this.clearSpotlight();
    }

    // 2. Render pinned lenses
    for (const lens of this.pinnedLenses) {
      this.renderLensToContext(
        lens.ctx,
        lens.mode === 'fixed' ? lens.slideX : null,
        lens.mode === 'fixed' ? lens.slideY : null,
        lens.stageX,
        lens.stageY,
        lens.size,
        lens.zoom,
        lens.isCircle,
        1.0
      );
    }

    // 3. Render follow lens on #lensCanvas
    if (this.lensCtx && this.lensCanvas) {
      this.lensCtx.clearRect(0, 0, dims.width, dims.height);

      if (this.isFollowActive && this.isFollowVisible && this.followOpacity > 0.01) {
        const size = this.getEffectiveSize();
        const zoom = settings.magnifierZoom || 3.0;
        const isCircle = (settings.magnifierShape || 'circle') === 'circle';

        this.lensCtx.save();
        this.lensCtx.translate(this.followDisplayX, this.followDisplayY);
        this.lensCtx.scale(this.followScale, this.followScale);
        this.lensCtx.globalAlpha = this.followOpacity;

        this.renderLensToContext(
          this.lensCtx,
          null, // follow target uses actual pointer target
          null,
          this.followTargetX,
          this.followTargetY,
          size,
          zoom,
          isCircle,
          this.followScale,
          -size / 2,
          -size / 2
        );

        this.lensCtx.restore();
      }
    }

    this.needsRedraw = false;
  }

  private renderLensToContext(
    ctx: CanvasRenderingContext2D,
    fixedSlideX: number | null,
    fixedSlideY: number | null,
    targetStageX: number,
    targetStageY: number,
    size: number,
    zoom: number,
    isCircle: boolean,
    scaleAnim = 1.0,
    destOffsetX = 0,
    destOffsetY = 0
  ): void {
    ctx.save();

    // 1. Clip path for lens shape
    ctx.beginPath();
    if (isCircle) {
      ctx.arc(destOffsetX + size / 2, destOffsetY + size / 2, size / 2 - 2, 0, Math.PI * 2);
    } else {
      const radius = 16;
      const x = destOffsetX + 2;
      const y = destOffsetY + 2;
      const w = size - 4;
      const h = size - 4;
      ctx.roundRect ? ctx.roundRect(x, y, w, h, radius) : ctx.rect(x, y, w, h);
    }
    ctx.clip();

    // 2. Fill background with dominant slide edge color
    const metrics = slideRenderer.getCurrentMetrics();
    ctx.fillStyle = metrics.dominantColor || '#000000';
    ctx.fillRect(destOffsetX, destOffsetY, size, size);

    // 3. Determine center point in slide space
    let centerSlideX = 0;
    let centerSlideY = 0;

    if (fixedSlideX !== null && fixedSlideY !== null) {
      centerSlideX = fixedSlideX;
      centerSlideY = fixedSlideY;
    } else {
      const stageRect = layerManager.stageEl.getBoundingClientRect();
      const slidePt = zoomController.toSlideCoords(stageRect.left + targetStageX, stageRect.top + targetStageY);
      centerSlideX = slidePt.x;
      centerSlideY = slidePt.y;
    }

    const sw = size / zoom;
    const sh = size / zoom;
    const sx = centerSlideX - sw / 2;
    const sy = centerSlideY - sh / 2;

    // 4. Draw crisp high-resolution 3x bitmap (or blackboard)
    const isBoard = store.getState().isBoardMode;
    if (isBoard) {
      // Draw from slideCanvas
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        layerManager.slideCanvas,
        sx, sy, sw, sh,
        destOffsetX, destOffsetY, size, size
      );
    } else {
      const bitmap = slideRenderer.getCurrentBitmap();
      if (bitmap) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Map from slide coordinate to bitmap coordinates
        const scaleX = bitmap.width / Math.max(1, metrics.destWidth);
        const scaleY = bitmap.height / Math.max(1, metrics.destHeight);
        const bitmapSx = (sx - metrics.destX) * scaleX;
        const bitmapSy = (sy - metrics.destY) * scaleY;
        const bitmapSw = sw * scaleX;
        const bitmapSh = sh * scaleY;

        ctx.drawImage(
          bitmap,
          bitmapSx, bitmapSy, bitmapSw, bitmapSh,
          destOffsetX, destOffsetY, size, size
        );
      }
    }

    // 5. Draw Annotation Ink inside lens
    const dpr = window.devicePixelRatio || 1;
    ctx.drawImage(
      layerManager.annotationCanvas,
      sx * dpr, sy * dpr, sw * dpr, sh * dpr,
      destOffsetX, destOffsetY, size, size
    );

    // 6. Faint curved glass reflection arc (~12% opacity per spec C5)
    if (isCircle) {
      ctx.save();
      const grad = ctx.createLinearGradient(destOffsetX, destOffsetY, destOffsetX + size, destOffsetY + size);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(
        destOffsetX + size * 0.35,
        destOffsetY + size * 0.28,
        size * 0.3,
        size * 0.15,
        -Math.PI / 6,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // 7. Gold Ring, Inner Highlight & Soft Glow Shadow (spec C5)
    ctx.save();
    const ringGrad = ctx.createLinearGradient(
      destOffsetX, destOffsetY,
      destOffsetX + size, destOffsetY + size
    );
    ringGrad.addColorStop(0, '#FFD76A');
    ringGrad.addColorStop(1, '#E8890C');

    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    if (isCircle) {
      ctx.arc(destOffsetX + size / 2, destOffsetY + size / 2, size / 2 - 2, 0, Math.PI * 2);
    } else {
      const radius = 16;
      const x = destOffsetX + 2;
      const y = destOffsetY + 2;
      const w = size - 4;
      const h = size - 4;
      ctx.roundRect ? ctx.roundRect(x, y, w, h, radius) : ctx.rect(x, y, w, h);
    }
    ctx.stroke();
    ctx.restore();
  }

  private renderSpotlight(stageW: number, stageH: number): void {
    if (!this.spotlightCtx || !this.spotlightCanvas) return;
    const ctx = this.spotlightCtx;
    ctx.clearRect(0, 0, stageW, stageH);

    // Dim background: 45% black
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, stageW, stageH);

    // Cut out following lens
    ctx.globalCompositeOperation = 'destination-out';

    if (this.isFollowActive && this.isFollowVisible && this.followOpacity > 0.05) {
      const size = this.getEffectiveSize();
      const isCircle = (store.getState().settings.magnifierShape || 'circle') === 'circle';
      ctx.beginPath();
      if (isCircle) {
        ctx.arc(this.followDisplayX, this.followDisplayY, (size / 2) * this.followScale, 0, Math.PI * 2);
      } else {
        const half = (size / 2) * this.followScale;
        ctx.rect(this.followDisplayX - half, this.followDisplayY - half, size * this.followScale, size * this.followScale);
      }
      ctx.fill();
    }

    // Cut out pinned lenses
    for (const lens of this.pinnedLenses) {
      ctx.beginPath();
      if (lens.isCircle) {
        ctx.arc(lens.stageX, lens.stageY, lens.size / 2, 0, Math.PI * 2);
      } else {
        ctx.rect(lens.stageX - lens.size / 2, lens.stageY - lens.size / 2, lens.size, lens.size);
      }
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  private clearSpotlight(): void {
    if (this.spotlightCtx && this.spotlightCanvas) {
      this.spotlightCtx.clearRect(0, 0, this.spotlightCanvas.width, this.spotlightCanvas.height);
    }
  }
}

export const magnifierLensController = new MagnifierLensController();
