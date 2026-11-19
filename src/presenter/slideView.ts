import { store } from '../state/store';
import { deckLoader } from './loader';
import { slideRenderer } from './renderer';
import { navigationController } from './navigation';
import { layerManager } from '../core/layers';
import { fullscreenService } from '../core/fullscreen';
// WELCOME-FIX: imports for home/welcome state transitions & cleanup
import { welcomeScreen } from '../ui/welcomeScreen';
import { annotationStore } from '../draw/annotationStore';
import { zoomController } from '../zoom/zoomController';
import { magnifierLensController } from '../zoom/magnifierLens';
import { overlayManager } from '../media/overlayManager';

export class SlideView {
  private channelNameEl!: HTMLElement;
  private fileNameEl!: HTMLElement;
  private pageCounterEl!: HTMLElement;
  private fileInputDeck!: HTMLInputElement;

  init(): void {
    this.channelNameEl = document.getElementById('channelName') as HTMLElement;
    this.fileNameEl = document.getElementById('fileName') as HTMLElement;
    this.pageCounterEl = document.getElementById('pageCounter') as HTMLElement;
    this.fileInputDeck = document.getElementById('fileInputDeck') as HTMLInputElement;

    this.bindHeader();
    this.bindChevronsAndEdges();
    this.bindDropAndFilePicker();
    this.bindStore();

    // Listen for resize to re-render current slide sharply
    layerManager.onResize(() => {
      slideRenderer.clearCache();
      this.reRenderCurrentSlide();
    });

    // Listen for Full View (Zen Fullscreen) transitions to auto-adjust slide
    window.addEventListener('app-fullscreen-changed', () => {
      slideRenderer.clearCache();
      layerManager.updateDimensions();
      this.reRenderCurrentSlide();
    });

    // SSIRO-UPDATE: Listen for files received via OS launchQueue
    window.addEventListener('app-open-files', async (e: any) => {
      const files = e.detail?.files;
      if (files && files.length > 0) {
        await this.handleIncomingFiles(files);
      }
    });

    // WELCOME-FIX: No default deck is ever auto-loaded on startup.
    // The initial appState is always 'welcome' and persistent.
  }

  private bindHeader(): void {
    const btnOpen = document.getElementById('btnOpenFile');
    btnOpen?.addEventListener('click', () => {
      this.fileInputDeck.click();
    });

    // WELCOME-FIX: Close deck button in header
    const btnClose = document.getElementById('btnCloseDeckHeader');
    btnClose?.addEventListener('click', () => {
      this.closeDeck();
    });

    const btnZen = document.getElementById('btnZenToggle');
    btnZen?.addEventListener('click', () => {
      fullscreenService.toggleZen();
    });

    // Quick Fit / View Mode Toggle in Header
    const btnFitMode = document.getElementById('btnFitModeHeader');
    btnFitMode?.addEventListener('click', () => {
      this.toggleFitMode();
    });

    // WELCOME-CLEANUP: Removed btnConnectBoardHeader listener

    // AUDIT-FIX: BUG-008 - Page counter click jump per NAV-1
    this.pageCounterEl?.addEventListener('click', () => {
      const state = store.getState();
      if (state.appState !== 'deck' || !state.currentDeck) return;
      const input = window.prompt(`स्लाइड पर जाएं (Go to Slide 1–${state.totalPages}):`, String(state.currentPage));
      if (input !== null) {
        const pageNum = parseInt(input.trim(), 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= state.totalPages) {
          navigationController.goToPage(pageNum);
        }
      }
    });
    if (this.pageCounterEl) {
      this.pageCounterEl.style.cursor = 'pointer';
      this.pageCounterEl.title = 'स्लाइड पर सीधे जाने के लिए क्लिक करें (Click to jump to slide)';
    }
  }

  private bindChevronsAndEdges(): void {
    const btnLeft = document.getElementById('chevronLeft');
    const btnRight = document.getElementById('chevronRight');

    // ECON: Only explicit clicks directly on the chevron buttons move slides
    btnLeft?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigationController.prevPage();
    });

    btnRight?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigationController.nextPage();
    });

    // Edge clicks / touch taps for instant slide turning on digital board
    const stage = document.getElementById('stage');
    stage?.addEventListener('click', (e: MouseEvent) => {
      const state = store.getState();
      if (state.appState !== 'deck') return;
      // When in Pen / drawing modes, clicks/touches on stage must NEVER change the slide
      if (state.activeTool !== 'select') return;
      if ((e.target as HTMLElement).closest('.toolbar-container, .header, .chevron-btn, .popover, .media-window, .gemini-panel, .settings-modal, .translation-card')) return;
      const x = e.clientX;
      const edgeThreshold = 64; // 64px comfortable digital board edge zone
      if (x <= edgeThreshold) {
        navigationController.prevPage();
      } else if (x >= window.innerWidth - edgeThreshold) {
        navigationController.nextPage();
      }
    });
  }

  private bindDropAndFilePicker(): void {
    // WELCOME-CLEANUP: Removed stage drag-and-drop deck loading handlers; retained file input picker

    // File input picker
    this.fileInputDeck.addEventListener('change', async () => {
      if (this.fileInputDeck.files && this.fileInputDeck.files.length > 0) {
        await this.handleIncomingFiles(Array.from(this.fileInputDeck.files));
        this.fileInputDeck.value = '';
      }
    });
  }

  private async handleIncomingFiles(files: File[]): Promise<void> {
    const pdfFile = files.find(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    const pptxFile = files.find(f => /\.(pptx|ppt)$/i.test(f.name));
    const imageFiles = files.filter(f => /\.(jpe?g|png|webp)$/i.test(f.name));

    if (pdfFile) {
      this.showToast(`PDF लोड हो रहा है: ${pdfFile.name}...`);
      try {
        const deck = await deckLoader.loadPDF(pdfFile, pdfFile.name);
        this.applyDeck(deck);
        this.showToast(`PDF लोड हो गई: ${deck.totalPages} पेज`);
      } catch (err: any) {
        console.error('PDF Load Error:', err);
        alert(`PDF लोड करने में त्रुटि आई:\n${err.message || 'फाइल नहीं खुल सकी'}\n\nकृपया सुनिश्चित करें कि फाइल एक वैध PDF है।`);
        this.showToast(`त्रुटि: ${err.message || 'PDF लोड नहीं हो सकी'}`, true);
      }
    } else if (pptxFile) {
      this.showPPTXGuidanceDialog(pptxFile);
    } else if (imageFiles.length > 0) {
      this.showToast(`छवियां लोड हो रही हैं: ${imageFiles.length} स्लाइड...`);
      try {
        const deck = await deckLoader.loadImages(imageFiles);
        this.applyDeck(deck);
      } catch (err: any) {
        console.error('Image Deck Error:', err);
        this.showToast(`त्रुटि: ${err.message || 'इमेज लोड नहीं हो सकी'}`, true);
      }
    }
  }

  private showPPTXGuidanceDialog(file: File): void {
    const msg = `PowerPoint (${file.name}) को 4K स्मार्ट बोर्ड पर सबसे तेज़ और क्रिस्टल-क्लीयर चलाने के लिए इसे PDF रूप में लोड किया जाता है।\n\n📌 आसान तरीका:\n1. PowerPoint में इस फ़ाइल को खोलें और कीबोर्ड पर 'F12' दबाएँ।\n2. 'Save as type' में 'PDF (*.pdf)' चुनें और सेव कर दें।\n3. फिर उस PDF को Smart Studio में लोड करें!\n\n(💡 मैंने आपके डेस्कटॉप पर 'Convert-PPT-to-PDF' टूल भी बना दिया है, जिस पर PPT डालते ही वह तुरंत PDF बन जाती है!)`;
    alert(msg);
  }

  // AUDIT-FIX: BUG-001 - Removed loadInitialDeck per WEL-7

  loadDeck(deck: any): void {
    this.applyDeck(deck);
  }

  applyDeck(deck: any): void {
    slideRenderer.clearCache();
    // WELCOME-FIX: Transition appState to 'deck', dismiss welcome screen, and activate Pen tool ready for teaching
    store.setState({
      appState: 'deck',
      currentDeck: deck,
      currentPage: 1,
      totalPages: deck.totalPages,
      activeTool: 'pen'
    });

    this.fileNameEl.textContent = deck.name;
    this.pageCounterEl.textContent = `1 / ${deck.totalPages}`;

    const page = deck.pages[0];
    if (page) {
      slideRenderer.renderSlide(page);
      slideRenderer.preRenderAdjacent(deck.pages, 1);
    }

    welcomeScreen.dismiss();
  }

  // WELCOME-FIX: Return to home / close loaded deck
  closeDeck(skipConfirm = false): boolean {
    if (!skipConfirm && annotationStore.hasAnnotations()) {
      const confirmed = window.confirm(
        'डेक बंद करें? आपके सभी एनोटेशन साफ़ हो जाएंगे।\n\nClose deck? All annotations on this deck will be cleared.'
      );
      if (!confirmed) return false;
    }

    annotationStore.resetAll();
    zoomController.resetZoom(true);
    magnifierLensController.clearAllPinnedLenses();
    overlayManager.clearAll();

    // Clear slide canvas
    layerManager.slideCtx.clearRect(
      0,
      0,
      layerManager.slideCanvas.width,
      layerManager.slideCanvas.height
    );

    store.setState({
      appState: 'welcome',
      currentDeck: null,
      currentPage: 1,
      totalPages: 1
    });

    this.fileNameEl.textContent = '';
    this.pageCounterEl.textContent = '1 / 1';

    welcomeScreen.show();
    return true;
  }

  private reRenderCurrentSlide(): void {
    const state = store.getState();
    if (state.appState === 'deck' && state.currentDeck && !state.isBoardMode) {
      const page = state.currentDeck.pages[state.currentPage - 1];
      if (page) {
        slideRenderer.renderSlide(page);
      }
    }
  }

  toggleFitMode(): void {
    const current = store.getState().settings.fitMode;
    const nextMode = current === 'fill' ? 'fit' : 'fill';
    store.updateSettings({ fitMode: nextMode });
    this.updateFitModeUI(nextMode);
  }

  updateFitModeUI(mode: string): void {
    const btnText = document.getElementById('btnFitModeText');
    if (btnText) {
      btnText.textContent = mode === 'fill' ? 'Fill View' : 'Fit: 16:9';
    }
  }

  private bindStore(): void {
    store.subscribe((state, prev) => {
      if (state.currentPage !== prev.currentPage || state.totalPages !== prev.totalPages) {
        this.pageCounterEl.textContent = `${state.currentPage} / ${state.totalPages}`;
      }

      if (state.settings.channelName !== prev.settings.channelName) {
        this.channelNameEl.textContent = state.settings.channelName;
      }

      if (
        state.settings.fitMode !== prev.settings.fitMode ||
        state.settings.renderQuality !== prev.settings.renderQuality ||
        state.isZen !== prev.isZen
      ) {
        slideRenderer.clearCache();
        layerManager.updateDimensions();
        this.reRenderCurrentSlide();
        this.updateFitModeUI(state.settings.fitMode);
      }
    });
  }

  private showToast(msg: string, isError = false): void {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: msg, isError } }));
  }
}

export const slideView = new SlideView();
