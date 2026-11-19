import { store } from '../state/store';
// SSIRO-UPDATE: Import zoomController for zoom-aware input handling
import { zoomController } from '../zoom/zoomController';
import { drawingEngine } from '../draw/engine';

export interface SwipeEventDetails {
  direction: 'left' | 'right';
  distance: number;
  velocity: number;
}

export class InputCoordinator {
  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;

  // Touch swipe tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private touchCount = 0;

  // Pointer swipe tracking & pen immunity
  private lastPointerType: string = 'touch';
  private lastSwipeFiredTime = 0;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartTime = 0;

  private onSwipeCallbacks: Array<(detail: SwipeEventDetails) => void> = [];
  private onDoubleTapCallbacks: Array<() => void> = [];

  constructor() {
    this.initGlobalListeners();
  }

  private initGlobalListeners(): void {
    const stage = document.getElementById('stage') as HTMLElement;
    if (!stage) return;

    // Track pointer type and pointer-based swipe gestures for Windows OPS digital boards
    stage.addEventListener('pointerdown', (e: PointerEvent) => {
      this.lastPointerType = e.pointerType;
      if (e.pointerType === 'pen') {
        this.touchStartTime = 0;
        this.pointerStartTime = 0;
        return;
      }
      if (e.pointerType === 'touch' && e.isPrimary) {
        const target = e.target as HTMLElement;
        if (target?.closest('.toolbar-container, .board-dock, .header, .web-overlay, .gemini-panel, .settings-modal, .welcome-screen, .popover, .pinned-lens-container, .translation-card, .translator-overlay, .pinned-translation-note, .media-window, #mediaLayer')) {
          this.pointerStartTime = 0;
          return;
        }
        this.pointerStartX = e.clientX;
        this.pointerStartY = e.clientY;
        this.pointerStartTime = performance.now();
      }
    }, { passive: true });

    stage.addEventListener('pointerup', (e: PointerEvent) => {
      const state = store.getState();
      if (state.activeTool !== 'select') return;
      if (e.pointerType === 'pen') return;
      if (e.pointerType === 'touch' && this.pointerStartTime > 0) {
        const now = performance.now();
        const duration = now - this.pointerStartTime;
        this.pointerStartTime = 0;

        // WRITING IMMUNITY: Never swipe if user was drawing ink or finished a stroke recently
        if (drawingEngine.isStrokeInProgress() || drawingEngine.wasStrokeJustCommitted(450)) {
          return;
        }

        const deltaX = e.clientX - this.pointerStartX;
        const deltaY = e.clientY - this.pointerStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const velocity = absX / Math.max(1, duration);

        const state = store.getState();
        if (state.appState !== 'deck') return;
        const isZoomed = zoomController.getScale() > 1.05;
        if (isZoomed) return;

        const isQuickFlick = absX > 50 && absX > absY * 1.4 && velocity > 0.2;
        const isWideSwipe = absX > 85 && absX > absY * 1.3;

        if ((isQuickFlick || isWideSwipe) && (now - this.lastSwipeFiredTime > 300)) {
          this.lastSwipeFiredTime = now;
          const direction = deltaX < 0 ? 'right' : 'left';
          this.fireSwipe({ direction, distance: absX, velocity });
        }
      }
    }, { passive: true });

    // Double-click for mouse
    stage.addEventListener('dblclick', (e) => {
      // Don't trigger if clicked on an active control button or inputs
      if ((e.target as HTMLElement).closest('.toolbar-container, .board-dock, .header, .web-overlay, .gemini-panel, .settings-modal, .welcome-screen')) {
        return;
      }
      // WELCOME-FIX: Double-click is inert in welcome state
      if (store.getState().appState === 'welcome') return;
      this.fireDoubleTap();
    });

    // Touch gesture tracking for double-tap and swipe
    stage.addEventListener('touchstart', (e: TouchEvent) => {
      // Don't track gestures if touch originated on toolbar, header, modals, media windows or controls
      const target = e.target as HTMLElement;
      if (target?.closest('.toolbar-container, .board-dock, .header, .web-overlay, .gemini-panel, .settings-modal, .welcome-screen, .popover, .pinned-lens-container, .translation-card, .translator-overlay, .pinned-translation-note, .media-window, #mediaLayer')) {
        this.touchCount = 0;
        this.touchStartTime = 0;
        return;
      }

      this.touchCount = e.touches.length;
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = performance.now();
      } else if (e.touches.length === 2) {
        // Two finger swipe start
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        this.touchStartX = (t1.clientX + t2.clientX) / 2;
        this.touchStartY = (t1.clientY + t2.clientY) / 2;
        this.touchStartTime = performance.now();
      }
    }, { passive: true });

    stage.addEventListener('touchend', (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest('.toolbar-container, .board-dock, .header, .web-overlay, .gemini-panel, .settings-modal, .welcome-screen, .popover, .pinned-lens-container, .translation-card, .translator-overlay, .pinned-translation-note, .media-window, #mediaLayer')) {
        return;
      }
      if (this.touchStartTime === 0) return;

      const now = performance.now();
      const duration = now - this.touchStartTime;
      const touch = e.changedTouches[0];
      if (!touch) return;

      // WRITING IMMUNITY: Never swipe if pointer was pen, drawing is active, or stroke was just committed
      if (this.lastPointerType === 'pen' || drawingEngine.isStrokeInProgress() || drawingEngine.wasStrokeJustCommitted(450)) {
        this.touchStartTime = 0;
        return;
      }

      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const velocity = absX / Math.max(1, duration);

      const state = store.getState();
      // WELCOME-FIX: Touch gestures are inert in welcome state
      if (state.appState === 'welcome') return;
      // While zoomed, swipe navigation is disabled
      const isZoomed = zoomController.getScale() > 1.05;

      // RULE: When in Pen / Drawing mode (pen, highlighter, eraser, shape, arrow):
      // Single finger/pen touch is strictly for INKING and drawing.
      // Swipe navigation is only allowed via TWO fingers (or when Select tool is active).
      const allowSwipe = !isZoomed && state.appState === 'deck' && (state.activeTool === 'select' || this.touchCount >= 2);

      // Swipe detection: supports both quick flick and wide digital board swipe
      const isQuickFlick = absX > 50 && absX > absY * 1.4 && velocity > 0.2;
      const isWideSwipe = absX > 85 && absX > absY * 1.3;

      if (allowSwipe && (isQuickFlick || isWideSwipe)) {
        if (now - this.lastSwipeFiredTime > 300) {
          this.lastSwipeFiredTime = now;
          const direction = deltaX < 0 ? 'right' : 'left'; // swiping left moves to next slide (right direction)
          this.fireSwipe({ direction, distance: absX, velocity });
        }
        return;
      }

      // Double-tap detection: window 300ms, tolerance 30px
      // SSIRO-UPDATE: Conflict rule: when Zoom tool active, double-tap is reserved for zoom toggle
      const isSelectOrHidden = (state.activeTool === 'select' || !state.isToolbarVisibleInZen) && state.activeTool !== 'zoom';
      if (isSelectOrHidden && absX < 30 && absY < 30) {
        const tapInterval = now - this.lastTapTime;
        const tapDist = Math.hypot(touch.clientX - this.lastTapX, touch.clientY - this.lastTapY);

        if (tapInterval > 0 && tapInterval < 300 && tapDist < 30) {
          this.fireDoubleTap();
          this.lastTapTime = 0;
          return;
        }

        this.lastTapTime = now;
        this.lastTapX = touch.clientX;
        this.lastTapY = touch.clientY;
      }
    }, { passive: true });

    // Chevron fade timer in Zen mode
    this.initChevronIdleFade();
  }

  private initChevronIdleFade(): void {
    const leftBtn = document.getElementById('chevronLeft');
    const rightBtn = document.getElementById('chevronRight');
    let idleTimer: number;

    const wakeChevrons = () => {
      leftBtn?.classList.remove('idle-faded');
      rightBtn?.classList.remove('idle-faded');
      window.clearTimeout(idleTimer);

      const state = store.getState();
      if (state.isZen) {
        idleTimer = window.setTimeout(() => {
          leftBtn?.classList.add('idle-faded');
          rightBtn?.classList.add('idle-faded');
        }, 2000);
      }
    };

    window.addEventListener('pointermove', (e) => {
      // Wake up if moving near the edges (< 15% width) or any movement
      wakeChevrons();
    }, { passive: true });

    store.subscribe((state, prev) => {
      if (state.isZen !== prev.isZen) {
        wakeChevrons();
      }
    });
  }

  onSwipe(cb: (detail: SwipeEventDetails) => void): void {
    this.onSwipeCallbacks.push(cb);
  }

  onDoubleTap(cb: () => void): void {
    this.onDoubleTapCallbacks.push(cb);
  }

  private fireSwipe(detail: SwipeEventDetails): void {
    for (const cb of this.onSwipeCallbacks) {
      cb(detail);
    }
  }

  private fireDoubleTap(): void {
    for (const cb of this.onDoubleTapCallbacks) {
      cb();
    }
  }
}

export const inputCoordinator = new InputCoordinator();
