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
  width: number;
  height: number;
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
    this.isFollowActive = false;
    this.isFollowVisible = false;
    this.followOpacity = 0;
    this.clearSpotlight();
    if (this.lensCtx && this.lensCanvas) {
      this.lensCtx.clearRect(0, 0, this.lensCanvas.width, this.lensCanvas.height);
    }
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
    const baseSize = this.getEffectiveSize();
    const zoom = settings.magnifierZoom || 3.0;
    const isCircle = (settings.magnifierShape || 'circle') === 'circle';

    // Width & height: Circle is symmetric, Rectangle defaults to freeform aspect ratio
    const width = isCircle ? baseSize : Math.round(baseSize * 1.25);
    const height = isCircle ? baseSize : Math.round(baseSize * 0.85);

    // Slide coordinates for fixed mode
    const slideCoords = zoomController.toSlideCoords(
      stageX + layerManager.stageEl.getBoundingClientRect().left,
      stageY + layerManager.stageEl.getBoundingClientRect().top
    );

    const container = document.createElement('div');
    container.className = `pinned-lens-container ${isCircle ? 'is-circle' : 'is-rect'}`;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.left = `${stageX - width / 2}px`;
    container.style.top = `${stageY - height / 2}px`;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.className = 'pinned-lens-canvas';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: true })!;

    // Overlay controls bar (close, zoom +/-, mode toggle)
    const controls = document.createElement('div');
    controls.className = 'pinned-lens-controls';
    controls.innerHTML = `
      <button class="lens-ctrl-btn btn-mode" title="Toggle Glass (Follows Content) / Lock (Frozen Snapshot)">
        <svg class="icon-glass" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <svg class="icon-lock" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" style="display:none;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </button>
      <div class="lens-ctrl-sep"></div>
      <button class="lens-ctrl-btn btn-zoom-out" title="Zoom Out (−)">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <span class="lens-ctrl-badge" id="zoomBadge_${id}">${zoom.toFixed(1)}×</span>
      <button class="lens-ctrl-btn btn-zoom-in" title="Zoom In (+)">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <div class="lens-ctrl-sep"></div>
      <button class="lens-ctrl-btn btn-close" title="Close Lens">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(controls);

    // Freeform Resize Handles (Corners and Edges) with Touch & Stylus Optimization
    // 1. Bottom-Right Corner (SE) - backward compatible alias 'pinned-lens-resize-handle'
    const handleSE = document.createElement('div');
    handleSE.className = 'pinned-lens-handle corner-handle handle-se pinned-lens-resize-handle';
    handleSE.setAttribute('data-handle', 'se');
    handleSE.title = 'Resize';
    container.appendChild(handleSE);

    // 2. Bottom-Left Corner (SW)
    const handleSW = document.createElement('div');
    handleSW.className = 'pinned-lens-handle corner-handle handle-sw';
    handleSW.setAttribute('data-handle', 'sw');
    container.appendChild(handleSW);

    // 3. Top-Right Corner (NE)
    const handleNE = document.createElement('div');
    handleNE.className = 'pinned-lens-handle corner-handle handle-ne';
    handleNE.setAttribute('data-handle', 'ne');
    container.appendChild(handleNE);

    // 4. Top-Left Corner (NW)
    const handleNW = document.createElement('div');
    handleNW.className = 'pinned-lens-handle corner-handle handle-nw';
    handleNW.setAttribute('data-handle', 'nw');
    container.appendChild(handleNW);

    // 5. Right Edge (E) - Horizontal width adjust
    const handleE = document.createElement('div');
    handleE.className = 'pinned-lens-handle edge-handle handle-e';
    handleE.setAttribute('data-handle', 'e');
    handleE.title = 'Width';
    container.appendChild(handleE);

    // 6. Left Edge (W) - Horizontal width adjust
    const handleW = document.createElement('div');
    handleW.className = 'pinned-lens-handle edge-handle handle-w';
    handleW.setAttribute('data-handle', 'w');
    container.appendChild(handleW);

    // 7. Bottom Edge (S) - Vertical height adjust (vertical banner)
    const handleS = document.createElement('div');
    handleS.className = 'pinned-lens-handle edge-handle handle-s';
    handleS.setAttribute('data-handle', 's');
    handleS.title = 'Height';
    container.appendChild(handleS);

    // 8. Top Edge (N) - Vertical height adjust
    const handleN = document.createElement('div');
    handleN.className = 'pinned-lens-handle edge-handle handle-n';
    handleN.setAttribute('data-handle', 'n');
    container.appendChild(handleN);

    document.getElementById('stage')?.appendChild(container);

    const lens: PinnedLens = {
      id,
      stageX,
      stageY,
      slideX: slideCoords.x,
      slideY: slideCoords.y,
      width,
      height,
      size: Math.max(width, height),
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
      detail: { message: `Lens Pinned: ${this.pinnedLenses.length}/3` }
    }));
  }

  private bindPinnedLensEvents(lens: PinnedLens): void {
    const container = lens.containerEl;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let lensStartX = 0;
    let lensStartY = 0;

    const updateControlsPlacement = () => {
      const controls = container.querySelector('.pinned-lens-controls') as HTMLElement;
      if (!controls) return;
      if (lens.stageY - lens.height / 2 < 48) {
        controls.style.top = 'auto';
        controls.style.bottom = '-40px';
      } else {
        controls.style.top = '-40px';
        controls.style.bottom = 'auto';
      }
    };

    // 1. Move Dragging on container body
    container.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.lens-ctrl-btn, .pinned-lens-handle')) return;
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
      container.style.left = `${lens.stageX - lens.width / 2}px`;
      container.style.top = `${lens.stageY - lens.height / 2}px`;
      updateControlsPlacement();
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

    // 2. Controls buttons (Mode, Zoom In, Zoom Out, Close)
    const btnMode = container.querySelector('.btn-mode') as HTMLElement;
    const iconGlass = container.querySelector('.icon-glass') as HTMLElement;
    const iconLock = container.querySelector('.icon-lock') as HTMLElement;
    btnMode?.addEventListener('click', (e) => {
      e.stopPropagation();
      lens.mode = lens.mode === 'glass' ? 'fixed' : 'glass';
      if (iconGlass && iconLock) {
        iconGlass.style.display = lens.mode === 'fixed' ? 'none' : 'block';
        iconLock.style.display = lens.mode === 'fixed' ? 'block' : 'none';
      }
      btnMode.classList.toggle('active', lens.mode === 'fixed');
      this.needsRedraw = true;
    });

    const zoomBadge = container.querySelector('.lens-ctrl-badge') as HTMLElement;
    const updateZoomBadge = () => {
      if (zoomBadge) zoomBadge.textContent = `${lens.zoom.toFixed(1)}×`;
    };

    const btnZoomIn = container.querySelector('.btn-zoom-in') as HTMLElement;
    btnZoomIn?.addEventListener('click', (e) => {
      e.stopPropagation();
      lens.zoom = Math.min(8.0, lens.zoom + 0.5);
      updateZoomBadge();
      this.needsRedraw = true;
    });

    const btnZoomOut = container.querySelector('.btn-zoom-out') as HTMLElement;
    btnZoomOut?.addEventListener('click', (e) => {
      e.stopPropagation();
      lens.zoom = Math.max(1.5, lens.zoom - 0.5);
      updateZoomBadge();
      this.needsRedraw = true;
    });

    const btnClose = container.querySelector('.btn-close') as HTMLElement;
    btnClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removePinnedLens(lens.id);
    });

    // 3. Freeform Resizing Handlers (for corners and edges)
    const handles = container.querySelectorAll<HTMLElement>('.pinned-lens-handle');
    handles.forEach((handle) => {
      let isResizing = false;
      let startW = 0;
      let startH = 0;
      let startX = 0;
      let startY = 0;
      let startClientX = 0;
      let startClientY = 0;
      const type = handle.getAttribute('data-handle') || 'se';

      handle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        handle.setPointerCapture(e.pointerId);
        startW = lens.width;
        startH = lens.height;
        startX = lens.stageX;
        startY = lens.stageY;
        startClientX = e.clientX;
        startClientY = e.clientY;
      });

      handle.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isResizing) return;
        e.stopPropagation();
        e.preventDefault();

        const dx = e.clientX - startClientX;
        const dy = e.clientY - startClientY;
        const minW = 100;
        const minH = 70;
        const dims = layerManager.getDimensions();
        const maxW = dims.width - 24;
        const maxH = dims.height - 24;

        let newW = startW;
        let newH = startH;
        let newStageX = startX;
        let newStageY = startY;

        if (lens.isCircle) {
          // Circle keeps uniform 1:1 aspect ratio
          let delta = 0;
          if (type === 'se') delta = Math.max(dx, dy);
          else if (type === 'sw') delta = Math.max(-dx, dy);
          else if (type === 'ne') delta = Math.max(dx, -dy);
          else if (type === 'nw') delta = Math.max(-dx, -dy);
          else if (type === 'e' || type === 'w') delta = type === 'e' ? dx : -dx;
          else if (type === 's' || type === 'n') delta = type === 's' ? dy : -dy;

          const size = Math.max(100, Math.min(800, startW + delta));
          newW = size;
          newH = size;
          if (type === 'se' || type === 'e' || type === 's') {
            newStageX = startX + (size - startW) / 2;
            newStageY = startY + (size - startH) / 2;
          } else if (type === 'sw' || type === 'w') {
            newStageX = startX - (size - startW) / 2;
            newStageY = startY + (size - startH) / 2;
          } else if (type === 'ne') {
            newStageX = startX + (size - startW) / 2;
            newStageY = startY - (size - startH) / 2;
          } else if (type === 'nw' || type === 'n') {
            newStageX = startX - (size - startW) / 2;
            newStageY = startY - (size - startH) / 2;
          }
        } else {
          // Freeform Rectangle: width and height adjust completely independently!
          switch (type) {
            case 'se': // Bottom-Right corner
              newW = Math.max(minW, Math.min(maxW, startW + dx));
              newH = Math.max(minH, Math.min(maxH, startH + dy));
              newStageX = startX + (newW - startW) / 2;
              newStageY = startY + (newH - startH) / 2;
              break;

            case 'sw': // Bottom-Left corner
              newW = Math.max(minW, Math.min(maxW, startW - dx));
              newH = Math.max(minH, Math.min(maxH, startH + dy));
              newStageX = startX - (newW - startW) / 2;
              newStageY = startY + (newH - startH) / 2;
              break;

            case 'ne': // Top-Right corner
              newW = Math.max(minW, Math.min(maxW, startW + dx));
              newH = Math.max(minH, Math.min(maxH, startH - dy));
              newStageX = startX + (newW - startW) / 2;
              newStageY = startY - (newH - startH) / 2;
              break;

            case 'nw': // Top-Left corner
              newW = Math.max(minW, Math.min(maxW, startW - dx));
              newH = Math.max(minH, Math.min(maxH, startH - dy));
              newStageX = startX - (newW - startW) / 2;
              newStageY = startY - (newH - startH) / 2;
              break;

            case 'e': // Right edge: horizontal width only
              newW = Math.max(minW, Math.min(maxW, startW + dx));
              newStageX = startX + (newW - startW) / 2;
              break;

            case 'w': // Left edge: horizontal width only
              newW = Math.max(minW, Math.min(maxW, startW - dx));
              newStageX = startX - (newW - startW) / 2;
              break;

            case 's': // Bottom edge: vertical height only (vertical banner)
              newH = Math.max(minH, Math.min(maxH, startH + dy));
              newStageY = startY + (newH - startH) / 2;
              break;

            case 'n': // Top edge: vertical height only
              newH = Math.max(minH, Math.min(maxH, startH - dy));
              newStageY = startY - (newH - startH) / 2;
              break;
          }
        }

        lens.width = newW;
        lens.height = newH;
        lens.size = Math.max(newW, newH);
        lens.stageX = newStageX;
        lens.stageY = newStageY;

        container.style.width = `${newW}px`;
        container.style.height = `${newH}px`;
        container.style.left = `${newStageX - newW / 2}px`;
        container.style.top = `${newStageY - newH / 2}px`;

        lens.canvasEl.width = newW;
        lens.canvasEl.height = newH;

        updateControlsPlacement();
        this.needsRedraw = true;
      });

      const stopHandleResize = (e: PointerEvent) => {
        if (isResizing) {
          isResizing = false;
          try { handle.releasePointerCapture(e.pointerId); } catch {}
          this.needsRedraw = true;
        }
      };

      handle.addEventListener('pointerup', stopHandleResize);
      handle.addEventListener('pointercancel', stopHandleResize);
    });
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
      lens.ctx.clearRect(0, 0, lens.canvasEl.width, lens.canvasEl.height);
      this.renderLensToContext(
        lens.ctx,
        lens.mode === 'fixed' ? lens.slideX : null,
        lens.mode === 'fixed' ? lens.slideY : null,
        lens.stageX,
        lens.stageY,
        lens.width,
        lens.height,
        lens.zoom,
        lens.isCircle,
        1.0,
        0,
        0
      );
    }

    // 3. Render follow lens on #lensCanvas
    if (this.lensCtx && this.lensCanvas) {
      this.lensCtx.clearRect(0, 0, dims.width, dims.height);

      if (this.isFollowActive && this.isFollowVisible && this.followOpacity > 0.01) {
        const isCircle = (settings.magnifierShape || 'circle') === 'circle';
        const effSize = this.getEffectiveSize();
        const width = isCircle ? effSize : Math.round(effSize * 1.25);
        const height = isCircle ? effSize : Math.round(effSize * 0.85);
        const zoom = settings.magnifierZoom || 3.0;

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
          width,
          height,
          zoom,
          isCircle,
          this.followScale,
          -width / 2,
          -height / 2
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
    width: number,
    height: number,
    zoom: number,
    isCircle: boolean,
    scaleAnim = 1.0,
    destOffsetX = 0,
    destOffsetY = 0
  ): void {
    // 0. Clean slate to prevent ANY frame accumulation or shadow smudge
    ctx.clearRect(destOffsetX, destOffsetY, width, height);

    ctx.save();

    // 1. Clip path for lens shape (smooth rounded rectangle or circle)
    ctx.beginPath();
    if (isCircle) {
      const radius = Math.min(width, height) / 2;
      ctx.arc(destOffsetX + width / 2, destOffsetY + height / 2, radius - 1, 0, Math.PI * 2);
    } else {
      const radius = Math.min(12, width / 4, height / 4);
      const x = destOffsetX + 1;
      const y = destOffsetY + 1;
      const w = width - 2;
      const h = height - 2;
      ctx.roundRect ? ctx.roundRect(x, y, w, h, radius) : ctx.rect(x, y, w, h);
    }
    ctx.clip();

    // 2. Fill background with dominant slide edge color (or crisp white for documents)
    const metrics = slideRenderer.getCurrentMetrics();
    ctx.fillStyle = metrics.dominantColor || '#ffffff';
    ctx.fillRect(destOffsetX, destOffsetY, width, height);

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

    const sw = width / zoom;
    const sh = height / zoom;
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
        destOffsetX, destOffsetY, width, height
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
          destOffsetX, destOffsetY, width, height
        );
      }
    }

    // 5. Draw Annotation Ink inside lens
    const dpr = window.devicePixelRatio || 1;
    ctx.drawImage(
      layerManager.annotationCanvas,
      sx * dpr, sy * dpr, sw * dpr, sh * dpr,
      destOffsetX, destOffsetY, width, height
    );

    // 6. Faint curved glass reflection arc (~12% opacity per spec C5) - circle only
    if (isCircle) {
      ctx.save();
      const grad = ctx.createLinearGradient(destOffsetX, destOffsetY, destOffsetX + width, destOffsetY + height);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(
        destOffsetX + width * 0.35,
        destOffsetY + height * 0.28,
        Math.min(width, height) * 0.3,
        Math.min(width, height) * 0.15,
        -Math.PI / 6,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // Restore clip

    // 7. Ultra-Sleek, Clean 1.5px Precision Optical Glass Bezel (Light, subtle, no clunky borders)
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 4;

    ctx.beginPath();
    if (isCircle) {
      const radius = Math.min(width, height) / 2;
      ctx.arc(destOffsetX + width / 2, destOffsetY + height / 2, radius - 0.75, 0, Math.PI * 2);
    } else {
      const radius = Math.min(10, width / 4, height / 4);
      const x = destOffsetX + 0.75;
      const y = destOffsetY + 0.75;
      const w = width - 1.5;
      const h = height - 1.5;
      ctx.roundRect ? ctx.roundRect(x, y, w, h, radius) : ctx.rect(x, y, w, h);
    }
    ctx.stroke();

    // Subtle delicate outer hairline rim
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.shadowBlur = 0;
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
      const isCircle = (store.getState().settings.magnifierShape || 'circle') === 'circle';
      const effSize = this.getEffectiveSize();
      const w = (isCircle ? effSize : Math.round(effSize * 1.25)) * this.followScale;
      const h = (isCircle ? effSize : Math.round(effSize * 0.85)) * this.followScale;
      ctx.beginPath();
      if (isCircle) {
        ctx.arc(this.followDisplayX, this.followDisplayY, Math.min(w, h) / 2, 0, Math.PI * 2);
      } else {
        const radius = Math.min(12, w / 4, h / 4);
        if (ctx.roundRect) {
          ctx.roundRect(this.followDisplayX - w / 2, this.followDisplayY - h / 2, w, h, radius);
        } else {
          ctx.rect(this.followDisplayX - w / 2, this.followDisplayY - h / 2, w, h);
        }
      }
      ctx.fill();
    }

    // Cut out pinned lenses
    for (const lens of this.pinnedLenses) {
      ctx.beginPath();
      if (lens.isCircle) {
        ctx.arc(lens.stageX, lens.stageY, Math.min(lens.width, lens.height) / 2, 0, Math.PI * 2);
      } else {
        const radius = Math.min(12, lens.width / 4, lens.height / 4);
        const x = lens.stageX - lens.width / 2;
        const y = lens.stageY - lens.height / 2;
        if (ctx.roundRect) {
          ctx.roundRect(x, y, lens.width, lens.height, radius);
        } else {
          ctx.rect(x, y, lens.width, lens.height);
        }
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

if (typeof window !== 'undefined') {
  (window as any).__SMART_STUDIO_LENS__ = magnifierLensController;
}
