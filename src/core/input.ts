import { store } from '../state/store';
// SSIRO-UPDATE: Import zoomController for zoom-aware input handling
import { zoomController } from '../zoom/zoomController';

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

  private onSwipeCallbacks: Array<(detail: SwipeEventDetails) => void> = [];
  private onDoubleTapCallbacks: Array<() => void> = [];

  constructor() {
    this.initGlobalListeners();
  }

  private initGlobalListeners(): void {
    const stage = document.getElementById('stage') as HTMLElement;
    if (!stage) return;

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
      const now = performance.now();
      const duration = now - this.touchStartTime;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const velocity = absX / Math.max(1, duration);

      const state = store.getState();
      // WELCOME-FIX: Touch gestures are inert in welcome state
      if (state.appState === 'welcome') return;
      // SSIRO-UPDATE: While zoomed, swipe navigation is disabled per C6 spec
      const isZoomed = zoomController.getScale() > 1.05;
      const allowSwipe = !isZoomed && (state.activeTool === 'select' || this.touchCount >= 2);

      // Swipe detection: horizontal swipe with threshold > 60px and velocity > 0.3 px/ms
      if (allowSwipe && absX > 60 && absX > absY * 1.5 && velocity > 0.3) {
        const direction = deltaX < 0 ? 'right' : 'left'; // swiping left moves to next slide (right direction)
        this.fireSwipe({ direction, distance: absX, velocity });
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
