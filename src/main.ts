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
// TEACHER-SUITE: Import Classroom Tools
import { timerController, curtainController, spotlightController } from './tools/teachingTools';
// SSIRO-UPDATE: Zoom and Magnifier subsystems
import { zoomController } from './zoom/zoomController';
import { magnifierLensController } from './zoom/magnifierLens';
import { zoomGestureHandler } from './zoom/zoomGestures';
// MIC-AI: Import micController
import { micController } from './voice/micController';
// INKFIX: Import Smart Ink and Voice Write controllers
import { smartInkController } from './smartink/smartInkController';
import { voiceWriteManager } from './voice/writeCommand';
// ECON: Import optional WebMCP agent manager
import { webMcpManager } from './ai/webMcp';
// AUDIT-FIX: BUG-006 - Import and init central gesture watchdog
import { gestureWatchdog } from './core/gestureWatchdog';
import { deckLoader } from './presenter/loader';
import { annotationStore } from './draw/annotationStore';
import { keyVault } from './ai/keyVault';
// AI-TRANSLATE: Import translator overlay and card managers
import { translatorOverlayManager } from './ui/translatorOverlay';
import { translatorCardManager } from './ui/translatorCard';
import { pwaInstallManager } from './core/pwaInstall';
import { libraryModal } from './ui/libraryModal';

// NETLIFY-KILLER: Eradicate Netlify Badge / Watermark Completely
function eradicateNetlifyBadges(): void {
  try {
    const selectors = [
      '[id*="netlify" i]',
      '[class*="netlify" i]',
      'a[href*="netlify" i]',
      'iframe[src*="netlify" i]',
      'netlify-badge',
      '.netlify-badge',
      '#netlify-badge'
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    });

    if (document.body) {
      Array.from(document.body.children).forEach((k) => {
        if (k.id !== 'stage' && k.id !== 'app' && k.tagName !== 'SCRIPT' && k.tagName !== 'STYLE') {
          const txt = (k.textContent || '').toLowerCase();
          if (txt.includes('netlify') || (k.querySelector && k.querySelector('a[href*="netlify" i]'))) {
            k.remove();
          }
        }
      });
    }
  } catch {}
}

eradicateNetlifyBadges();
if (typeof MutationObserver !== 'undefined') {
  new MutationObserver(eradicateNetlifyBadges).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}
setInterval(eradicateNetlifyBadges, 300);

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
              detail: { message: 'New version available — Reload to update' }
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

// WELCOME-CLEANUP: Minimal invisible accidental drop guard preventing browser navigation
window.addEventListener('dragover', (e: DragEvent) => e.preventDefault());
window.addEventListener('drop', (e: DragEvent) => e.preventDefault());

class SmartStudioApp {
  init(): void {
    console.log('🚀 Initializing Smart Studio Presenter Pro (SSIRO Classes)...');

    // WELCOME-FIX: Initial state is always 'welcome'
    document.body.classList.remove('state-deck', 'state-board');
    document.body.classList.add('state-welcome');

    // SSIRO-UPDATE: Launch Welcome Screen immediately
    welcomeScreen.show();

    // PWA: Initialize install prompt manager
    pwaInstallManager.init();
    // Initialize core layers and presentation view
    // AUDIT-FIX: BUG-006 - Init gesture watchdog
    gestureWatchdog.init();
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
    // ECON: Initialize optional WebMCP agent layer
    webMcpManager.init();

    // SSIRO-UPDATE: Initialize Zoom and Magnifier subsystems
    zoomController.init();
    magnifierLensController.init();
    zoomGestureHandler.init();
    // AI-TRANSLATE: Initialize Translator Overlay Manager
    translatorOverlayManager.init();
    // STUDIO-LIBRARY: Initialize Studio Library modal (in-device persistent storage)
    libraryModal.init();
    // TEACHER-SUITE: Initialize Classroom Tools Suite
    timerController.init();
    curtainController.init();
    spotlightController.init();

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

    // AUDIT: Expose test globals for automated Playwright E2E verification
    const w = window as any;
    w.__SMART_STUDIO_STORE__ = store;
    w.__SMART_STUDIO_SLIDE_VIEW__ = slideView;
    w.__SMART_STUDIO_LOADER__ = deckLoader;
    w.__SMART_STUDIO_SETTINGS_PANEL__ = settingsPanel;
    w.__SMART_STUDIO_TOOLBAR__ = toolbar;
    w.__SMART_STUDIO_ANNOTATION_STORE__ = annotationStore;
    w.__SMART_STUDIO_BLACKBOARD__ = blackboardStudio;
    w.__SMART_STUDIO_ZOOM__ = zoomController;
    w.__SMART_STUDIO_LENS__ = magnifierLensController;
    w.__SMART_STUDIO_MEDIA_MANAGER__ = overlayManager;
    w.__SMART_STUDIO_KEY_VAULT__ = keyVault;
    w.__SMART_STUDIO_MIC__ = micController;
    w.__SMART_STUDIO_VOICE__ = voiceCommandService;
    w.__SMART_STUDIO_DRAW_ENGINE__ = drawingEngine;
    w.__SMART_STUDIO_TRANSLATOR_OVERLAY__ = translatorOverlayManager;
    w.__SMART_STUDIO_TRANSLATOR_CARD__ = translatorCardManager;
    w.__SMART_STUDIO_LIBRARY_MODAL__ = libraryModal;

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
    shortcutManager.register('layout', () => {
      const current = store.getState().settings.fitMode;
      const nextMode = current === 'fill' ? 'stretch' : current === 'stretch' ? 'fit' : 'fill';
      store.updateSettings({ fitMode: nextMode });
      const labels: Record<string, string> = {
        fill: 'Layout: Fullscreen (Fill 100%)',
        stretch: 'Layout: Full Board Stretch (100%)',
        fit: 'Layout: Original Aspect Ratio (Fit)'
      };
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: `📐 ${labels[nextMode] || nextMode}` }
        })
      );
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
      translatorCardManager.close();
      if (state.activeTool === 'translate') {
        store.setState({ activeTool: 'pen' });
      }
    });

    window.addEventListener('close-all-overlays', () => {
      settingsPanel.close();
      geminiPanel.close();
      webOverlay.close();
      translatorCardManager.close();
      if (store.getState().activeTool === 'translate') {
        store.setState({ activeTool: 'pen' });
      }
    });
  }

  private wireToastSystem(): void {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    window.addEventListener('app-toast', (e: any) => {
      // In deck mode (presenting PPT), ZERO popups allowed per teacher requirement: "Zero intrusive popups in deck mode"
      if (store.getState().appState === 'deck') {
        return;
      }

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
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  app.init();
}
