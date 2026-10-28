// AUDIT-FIX: BUG-006 - Central Gesture Watchdog & Cleanup Manager per Part C2
export interface ActiveGesture {
  id: string;
  cancelFn: () => void;
  pointerId?: number | null;
  startTime: number;
  lastMoveTime: number;
}

export class GestureWatchdog {
  private activeGestures = new Map<string, ActiveGesture>();
  private watchdogInterval: number | null = null;
  private isInitialized = false;

  init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Window blur: immediate force-reset all active gestures
    window.addEventListener('blur', () => {
      this.resetAllGestures('window-blur');
    });

    // Visibility change: hidden tab/app forces reset
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.resetAllGestures('visibility-hidden');
      }
    });

    // Fullscreen change forces gesture reset
    document.addEventListener('fullscreenchange', () => {
      this.resetAllGestures('fullscreenchange');
    });

    // Orientation change forces gesture reset
    window.addEventListener('orientationchange', () => {
      this.resetAllGestures('orientationchange');
    });

    // Watchdog check every 1 second
    this.watchdogInterval = window.setInterval(() => {
      this.checkStuckGestures();
    }, 1000);
  }

  registerGesture(id: string, cancelFn: () => void, pointerId?: number | null): void {
    const now = Date.now();
    this.activeGestures.set(id, {
      id,
      cancelFn,
      pointerId: pointerId ?? null,
      startTime: now,
      lastMoveTime: now
    });
  }

  recordActivity(id?: string): void {
    const now = Date.now();
    if (id && this.activeGestures.has(id)) {
      const g = this.activeGestures.get(id)!;
      g.lastMoveTime = now;
    } else {
      for (const g of this.activeGestures.values()) {
        g.lastMoveTime = now;
      }
    }
  }

  unregisterGesture(id: string): void {
    this.activeGestures.delete(id);
  }

  hasActiveGestures(): boolean {
    return this.activeGestures.size > 0;
  }

  getActiveGestureCount(): number {
    return this.activeGestures.size;
  }

  resetAllGestures(reason: string): void {
    if (this.activeGestures.size === 0) return;
    console.warn(`[GESTURE-WATCHDOG] Force-resetting all active gestures (${reason})`);
    for (const [id, gesture] of this.activeGestures.entries()) {
      try {
        gesture.cancelFn();
      } catch (err) {
        console.error(`[GESTURE-WATCHDOG] Error cancelling gesture ${id}:`, err);
      }
    }
    this.activeGestures.clear();
  }

  private checkStuckGestures(): void {
    const now = Date.now();
    const STUCK_TIMEOUT_MS = 30000; // 30s per Part C2 spec

    for (const [id, gesture] of this.activeGestures.entries()) {
      const idleDuration = now - gesture.lastMoveTime;
      if (idleDuration >= STUCK_TIMEOUT_MS) {
        console.warn(`[GESTURE-WATCHDOG] Force-resetting stuck gesture '${id}' (inactive for ${Math.round(idleDuration / 1000)}s)`);
        try {
          gesture.cancelFn();
        } catch (err) {
          console.error(`[GESTURE-WATCHDOG] Error resetting stuck gesture '${id}':`, err);
        }
        this.activeGestures.delete(id);
      }
    }
  }

  destroy(): void {
    if (this.watchdogInterval !== null) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    this.activeGestures.clear();
    this.isInitialized = false;
  }
}

export const gestureWatchdog = new GestureWatchdog();
