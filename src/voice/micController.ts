// MIC-AI: Central Microphone Controller (Single source of truth for mic state)
import { store } from '../state/store';
import { voiceCommandService } from './commands';

export type MicState = 'off' | 'listening' | 'error';

export class MicController {
  private micState: MicState = 'off';
  private autoOffTimer: number | null = null;
  private blurTimer: number | null = null;
  private lastActivityTime = 0;
  private lastToastTime = 0;
  private lastToastType: 'on' | 'off' | '' = '';
  private isPushToTalkActive = false;
  private inputLevel = 0; // 0 to 3
  private listeners: Array<(state: MicState) => void> = [];
  private levelListeners: Array<(level: number) => void> = [];

  init(): void {
    // Default is strictly 'off' on every launch, reload, return from any mode.
    this.micState = 'off';
    this.updateState('off', false);

    this.bindWindowEvents();
    this.bindSlideAndBoardEvents();
  }

  getState(): MicState {
    return this.micState;
  }

  onStateChange(cb: (state: MicState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  onLevelChange(cb: (level: number) => void): () => void {
    this.levelListeners.push(cb);
    return () => {
      this.levelListeners = this.levelListeners.filter((l) => l !== cb);
    };
  }

  setInputLevel(level: number): void {
    this.inputLevel = Math.max(0, Math.min(3, Math.round(level)));
    for (const cb of this.levelListeners) {
      try {
        cb(this.inputLevel);
      } catch {}
    }
  }

  /**
   * Direct user action to turn mic ON
   */
  async turnOn(isPushToTalk = false): Promise<void> {
    if (this.micState === 'listening') return;

    this.isPushToTalkActive = isPushToTalk;
    this.lastActivityTime = Date.now();

    try {
      // Start voice command service (triggers browser/Android runtime permission if needed)
      const success = await voiceCommandService.startListening();
      if (success) {
        this.updateState('listening', true);
        this.startAutoOffCheck();
      } else {
        this.updateState('error', true);
      }
    } catch (err: any) {
      console.warn('Mic turn-on error:', err);
      this.updateState('error', true);
    }
  }

  /**
   * Turn mic OFF and truly release all resources
   */
  turnOff(isAutoOff = false): void {
    if (this.micState === 'off') return;

    this.stopAutoOffCheck();
    this.clearBlurTimer();
    this.setInputLevel(0);

    // Truly release microphone: abort recognition, detach listeners, stop all streams
    voiceCommandService.stopListening();

    this.updateState('off', true, isAutoOff);
  }

  toggle(): void {
    if (this.micState === 'listening') {
      this.turnOff();
    } else {
      this.turnOn();
    }
  }

  reportActivity(): void {
    this.lastActivityTime = Date.now();
  }

  reportError(msg?: string): void {
    this.stopAutoOffCheck();
    this.setInputLevel(0);
    voiceCommandService.stopListening();
    this.updateState('error', true);

    if (msg) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: msg, isError: true }
        })
      );
    }
  }

  // Push-to-talk handlers
  handlePushToTalkDown(): void {
    const s = store.getState().settings;
    if (!s.pushToTalk) {
      this.toggle();
      return;
    }
    if (this.micState !== 'listening') {
      this.turnOn(true);
    }
  }

  handlePushToTalkUp(): void {
    const s = store.getState().settings;
    if (s.pushToTalk && this.isPushToTalkActive) {
      this.isPushToTalkActive = false;
      this.turnOff();
    }
  }

  private updateState(newState: MicState, showToast = false, isAutoOff = false): void {
    const prev = this.micState;
    this.micState = newState;

    for (const cb of this.listeners) {
      try {
        cb(this.micState);
      } catch {}
    }

    // Debounced toast notifications
    if (showToast) {
      const now = Date.now();
      const debounceMs = 2000;

      if (newState === 'listening') {
        if (this.lastToastType !== 'on' || now - this.lastToastTime > debounceMs) {
          this.lastToastTime = now;
          this.lastToastType = 'on';
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { message: '🎙️ माइक चालू / Mic ON' }
            })
          );
        }
      } else if (newState === 'off') {
        if (isAutoOff) {
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { message: '⏱️ निष्क्रियता के कारण माइक बंद / Mic auto-off (idle)' }
            })
          );
        } else if (this.lastToastType !== 'off' || now - this.lastToastTime > debounceMs) {
          this.lastToastTime = now;
          this.lastToastType = 'off';
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { message: '🔇 माइक बंद / Mic OFF' }
            })
          );
        }
      } else if (newState === 'error') {
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: {
              message: '⚠️ माइक अवरुद्ध या अनुपलब्ध / Microphone blocked or unavailable',
              isError: true
            }
          })
        );
      }
    }
  }

  private bindWindowEvents(): void {
    // Visibilitychange: mute when app / tab is hidden or minimized
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.micState === 'listening') {
        console.log('App hidden, turning mic off');
        this.turnOff();
      }
    });

    // Window blur: if blurred for > 30s, turn off
    window.addEventListener('blur', () => {
      if (this.micState === 'listening') {
        this.clearBlurTimer();
        this.blurTimer = window.setTimeout(() => {
          if (this.micState === 'listening') {
            console.log('Window blur > 30s, turning mic off');
            this.turnOff();
          }
        }, 30000);
      }
    });

    window.addEventListener('focus', () => {
      this.clearBlurTimer();
    });

    // Page unload
    window.addEventListener('beforeunload', () => {
      this.turnOff();
    });
  }

  private bindSlideAndBoardEvents(): void {
    // Mute on slide change
    store.subscribe((state, prev) => {
      if (state.currentPage !== prev.currentPage && this.micState === 'listening') {
        console.log('Slide changed, turning mic off');
        this.turnOff();
      }

      // Mute on entering board if setting enabled
      if (state.isBoardMode && !prev.isBoardMode) {
        if (state.settings.muteMicOnBoard && this.micState === 'listening') {
          console.log('Entered Board mode with muteMicOnBoard enabled, turning mic off');
          this.turnOff();
        }
      }

      // Mute when returning from in-app browser or opening overlays
      if (state.isWebOverlayOpen !== prev.isWebOverlayOpen && this.micState === 'listening') {
        this.turnOff();
      }
    });
  }

  private startAutoOffCheck(): void {
    this.stopAutoOffCheck();
    this.lastActivityTime = Date.now();

    this.autoOffTimer = window.setInterval(() => {
      if (this.micState !== 'listening') {
        this.stopAutoOffCheck();
        return;
      }

      const s = store.getState().settings;
      const minutes = s.micAutoOffMinutes ?? 10;
      if (minutes <= 0) return; // 0 = off

      const elapsedMs = Date.now() - this.lastActivityTime;
      const maxMs = minutes * 60 * 1000;

      if (elapsedMs >= maxMs) {
        console.log(`Auto-off timer expired (${minutes} min idle), turning mic off`);
        this.turnOff(true);
      }
    }, 1000);
  }

  private stopAutoOffCheck(): void {
    if (this.autoOffTimer !== null) {
      clearInterval(this.autoOffTimer);
      this.autoOffTimer = null;
    }
  }

  private clearBlurTimer(): void {
    if (this.blurTimer !== null) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
  }
}

export const micController = new MicController();
