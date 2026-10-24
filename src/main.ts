import { layerManager } from './core/layers';
import { slideView } from './presenter/slideView';
import { drawingEngine } from './draw/engine';
import { toolbar } from './ui/toolbar';
import { blackboardStudio } from './board/board';
import { overlayManager } from './media/overlayManager';
import { handwritingCoordinator } from './draw/handwriting';
import { webOverlay } from './browser/webOverlay';
import { geminiPanel } from './ui/geminiPanel';
import { settingsPanel } from './ui/settingsPanel';
import { voiceCommandService } from './voice/commands';
import { shortcutManager } from './core/shortcuts';
import { inputCoordinator } from './core/input';
import { navigationController } from './presenter/navigation';
import { fullscreenService } from './core/fullscreen';
import { store } from './state/store';
// SSIRO-UPDATE: Welcome Screen
import { welcomeScreen } from './ui/welcomeScreen';
// SSIRO-UPDATE: Zoom and Magnifier subsystems
import { zoomController } from './zoom/zoomController';
import { magnifierLensController } from './zoom/magnifierLens';
import { zoomGestureHandler } from './zoom/zoomGestures';
// MIC-AI: Import micController
import { micController } from './voice/micController';
// INKFIX: Import Smart Ink and Voice Write controllers
import { smartInkController } from './smartink/smartInkController';
import { voiceWriteManager } from './voice/writeCommand';

// PWA auto-updater
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('New Smart Studio update available.');
          // SSIRO-UPDATE: Show reload toast on new version ready
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { message: 'नया संस्करण उपलब्ध है — पुनः लोड करें (New version ready — Reload)' }
            })
          );
        },
        onOfflineReady() {
          console.log('Smart Studio is 100% offline ready.');
        }
      });
    })
    .catch(() => {});
}

// SSIRO-UPDATE: OS File Handler launchQueue
if ('launchQueue' in window && 'files' in (window as any).LaunchParams.prototype) {
  (window as any).launchQueue.setConsumer(async (launchParams: any) => {
    if (!launchParams.files || launchParams.files.length === 0) return;
    const fileHandles = launchParams.files;
    const files: File[] = [];
    for (const handle of fileHandles) {
      files.push(await handle.getFile());
    }
    // WELCOME-FIX: Directly dispatch app-open-files to load user deck
    window.dispatchEvent(new CustomEvent('app-open-files', { detail: { files } }));
  });
}

class SmartStudioApp {
  init(): void {
    console.log('🚀 Initializing Smart Studio Presenter Pro (SSIRO Classes)...');

    // WELCOME-FIX: Initial state is always 'welcome'
    document.body.classList.remove('state-deck', 'state-board');
    document.body.classList.add('state-welcome');

    // SSIRO-UPDATE: Launch Welcome Screen immediately
    welcomeScreen.show();

    // Initialize core layers and presentation view
    layerManager.updateDimensions();
    slideView.init();
    drawingEngine.init();
    toolbar.init();
    blackboardStudio.init();
    overlayManager.init();
    handwritingCoordinator.init();
    webOverlay.init();
    geminiPanel.init();
    settingsPanel.init();
    voiceCommandService.init();
    // MIC-AI: Initialize central mic controller (default: off)
    micController.init();
    // INKFIX: Initialize Smart Ink and Voice Write controllers
    smartInkController.init();
    voiceWriteManager.init();

    // SSIRO-UPDATE: Initialize Zoom and Magnifier subsystems
    zoomController.init();
    magnifierLensController.init();
    zoomGestureHandler.init();

    // SSIRO-UPDATE: touch-action:none on stage while Magnifier/Zoom are active per C7
    store.subscribe((state, prev) => {
      const isZoomOrMag = state.activeTool === 'magnifier' || state.activeTool === 'zoom';
      const wasZoomOrMag = prev.activeTool === 'magnifier' || prev.activeTool === 'zoom';
      if (isZoomOrMag !== wasZoomOrMag) {
        layerManager.stageEl.style.touchAction = isZoomOrMag ? 'none' : '';
      }

      // WELCOME-FIX: Sync body class with appState ('welcome' | 'deck' | 'board')
      if (state.appState !== prev.appState) {
        document.body.classList.remove('state-welcome', 'state-deck', 'state-board');
        document.body.classList.add(`state-${state.appState}`);
      }
    });

    this.wireGesturesAndShortcuts();
    this.wireToastSystem();

    console.log('✅ Smart Studio Presenter Pro ready.');
  }

  private wireGesturesAndShortcuts(): void {
    // INKFIX: Smart Ink auto-beautification hook
    drawingEngine.onStrokeFinished((stroke) => {
      smartInkController.onNewStroke(stroke);
    });

    // Touch swipe navigation
    inputCoordinator.onSwipe((detail) => {
      const state = store.getState();
      // WELCOME-FIX: Swipe navigation is inert in welcome and board states
      if (state.appState !== 'deck') return;
      if (detail.direction === 'right') {
        navigationController.nextPage();
      } else {
        navigationController.prevPage();
      }
    });

    // Double-tap anywhere to toggle toolbar visibility in Zen mode
    inputCoordinator.onDoubleTap(() => {
      const state = store.getState();
      // WELCOME-FIX: Double-tap is inert in welcome state
      if (state.appState !== 'deck') return;
      if (state.isZen) {
        store.setState({ isToolbarVisibleInZen: !state.isToolbarVisibleInZen });
      }
    });

    // Keyboard shortcuts
    shortcutManager.register('next', () => navigationController.nextPage());
    shortcutManager.register('prev', () => navigationController.prevPage());
    shortcutManager.register('first', () => navigationController.firstPage());
    shortcutManager.register('last', () => navigationController.lastPage());
    shortcutManager.register('board', () => blackboardStudio.toggleBoard());
    shortcutManager.register('openDeck', () => {
      const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
      fileInput?.click();
    });
    // MIC-AI: Register V shortcut for mic toggle or push-to-talk
    shortcutManager.register('mic', () => {
      const s = store.getState().settings;
      if (s.pushToTalk) {
        micController.handlePushToTalkDown();
      } else {
        micController.toggle();
      }
    });

    window.addEventListener('mic-ptt-up', () => {
      micController.handlePushToTalkUp();
    });
    shortcutManager.register('closeOverlay', () => {
      const state = store.getState();
      if (state.isSettingsOpen) settingsPanel.close();
      if (state.isGeminiOpen) geminiPanel.close();
      if (state.isWebOverlayOpen) webOverlay.close();
      if (state.isBoardMode) blackboardStudio.closeBoard();
    });

    window.addEventListener('close-all-overlays', () => {
      settingsPanel.close();
      geminiPanel.close();
      webOverlay.close();
    });
  }

  private wireToastSystem(): void {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    window.addEventListener('app-toast', (e: any) => {
      const { message, isError } = e.detail || {};
      if (!message) return;

      const toast = document.createElement('div');
      toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
      toast.textContent = message;

      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 200ms ease-out';
        setTimeout(() => toast.remove(), 250);
      }, 3500);
    });
  }
}

// Start application
const app = new SmartStudioApp();
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
