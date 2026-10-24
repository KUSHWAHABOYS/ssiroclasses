import { store } from '../state/store';
import { fullscreenService } from './fullscreen';

// MIC-AI: Registered 'mic' shortcut action (V key)
export type ShortcutAction = 'next' | 'prev' | 'first' | 'last' | 'zen' | 'board' | 'closeOverlay' | 'openDeck' | 'mic';

export class ShortcutManager {
  private handlers: Map<ShortcutAction, () => void> = new Map();
  public isShiftDown = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  register(action: ShortcutAction, handler: () => void): void {
    this.handlers.set(action, handler);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.isShiftDown = true;
    }

    // Ignore keyboard shortcuts if user is typing into an input field or textarea
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    // WELCOME-FIX: In welcome state, slide navigation keys are completely inert
    const state = store.getState();
    if (state.appState === 'welcome') {
      if (['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        return;
      }
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ': // Space
        e.preventDefault();
        this.dispatch('next');
        break;

      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        this.dispatch('prev');
        break;

      case 'Home':
        e.preventDefault();
        this.dispatch('first');
        break;

      case 'End':
        e.preventDefault();
        this.dispatch('last');
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        fullscreenService.toggleZen();
        this.dispatch('zen');
        break;

      case 'b':
      case 'B':
        e.preventDefault();
        this.dispatch('board');
        break;

      case 'o':
      case 'O':
        e.preventDefault();
        this.dispatch('openDeck');
        break;

      // MIC-AI: V toggles mic (or push-to-talk down)
      case 'v':
      case 'V':
        e.preventDefault();
        this.dispatch('mic');
        break;

      case 'Escape':
        e.preventDefault();
        const state = store.getState();
        if (state.isWebOverlayOpen || state.isGeminiOpen || state.isSettingsOpen || state.isBoardMode) {
          this.dispatch('closeOverlay');
        } else if (state.isZen) {
          fullscreenService.exitZen();
        }
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.isShiftDown = false;
    }
    // MIC-AI: Release push-to-talk on V keyup
    if (e.key === 'v' || e.key === 'V') {
      window.dispatchEvent(new CustomEvent('mic-ptt-up'));
    }
  }

  private dispatch(action: ShortcutAction): void {
    const handler = this.handlers.get(action);
    if (handler) {
      try {
        handler();
      } catch (err) {
        console.error(`Error in shortcut action [${action}]:`, err);
      }
    }
  }
}

export const shortcutManager = new ShortcutManager();
