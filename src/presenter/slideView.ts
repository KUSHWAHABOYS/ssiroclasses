import { store } from '../state/store';
import { deckLoader } from './loader';
import { slideRenderer } from './renderer';
import { navigationController } from './navigation';
import { layerManager } from '../core/layers';
import { fullscreenService } from '../core/fullscreen';

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
      this.reRenderCurrentSlide();
    });

    // SSIRO-UPDATE: Listen for files received via OS launchQueue
    window.addEventListener('app-open-files', async (e: any) => {
      const files = e.detail?.files;
      if (files && files.length > 0) {
        await this.handleIncomingFiles(files);
      }
    });

    // Load initial sample deck so user immediately sees crisp 4K content
    this.loadInitialDeck();
  }

  private bindHeader(): void {
    const btnOpen = document.getElementById('btnOpenFile');
    btnOpen?.addEventListener('click', () => {
      this.fileInputDeck.click();
    });

    const btnZen = document.getElementById('btnZenToggle');
    btnZen?.addEventListener('click', () => {
      fullscreenService.toggleZen();
    });
  }

  private bindChevronsAndEdges(): void {
    const btnLeft = document.getElementById('chevronLeft');
    const btnRight = document.getElementById('chevronRight');

    btnLeft?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigationController.prevPage();
    });

    btnRight?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigationController.nextPage();
    });

    // Outer 8% edge zone clicks (for mouse users per B4.2)
    const zoneLeft = document.getElementById('navLeftZone');
    const zoneRight = document.getElementById('navRightZone');

    zoneLeft?.addEventListener('click', (e) => {
      // If clicking directly on zone (outside chevron), still navigate
      if (e.target === zoneLeft) {
        navigationController.prevPage();
      }
    });

    zoneRight?.addEventListener('click', (e) => {
      if (e.target === zoneRight) {
        navigationController.nextPage();
      }
    });
  }

  private bindDropAndFilePicker(): void {
    const stage = document.getElementById('stage')!;

    // Drag-and-drop on PC
    stage.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    });

    stage.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        await this.handleIncomingFiles(Array.from(e.dataTransfer.files));
      }
    });

    // File input picker
    this.fileInputDeck.addEventListener('change', async () => {
      if (this.fileInputDeck.files && this.fileInputDeck.files.length > 0) {
        await this.handleIncomingFiles(Array.from(this.fileInputDeck.files));
        this.fileInputDeck.value = '';
      }
    });
  }

  private async handleIncomingFiles(files: File[]): Promise<void> {
    const pdfFile = files.find(f => f.name.toLowerCase().endsWith('.pdf'));
    const pptxFile = files.find(f => f.name.toLowerCase().endsWith('.pptx'));
    const imageFiles = files.filter(f => /\.(jpe?g|png|webp)$/i.test(f.name));

    if (pdfFile) {
      this.showToast(`Loading PDF: ${pdfFile.name}...`);
      try {
        const deck = await deckLoader.loadPDF(pdfFile, pdfFile.name);
        this.applyDeck(deck);
      } catch (err: any) {
        console.error('PDF Load Error:', err);
        this.showToast(`Error loading PDF: ${err.message}`, true);
      }
    } else if (pptxFile) {
      // PPTX guidance dialog per B3.4
      this.showPPTXGuidanceDialog(pptxFile);
    } else if (imageFiles.length > 0) {
      this.showToast(`Loading ${imageFiles.length} images...`);
      try {
        const deck = await deckLoader.loadImages(imageFiles);
        this.applyDeck(deck);
      } catch (err: any) {
        console.error('Image Deck Error:', err);
        this.showToast(`Error loading images: ${err.message}`, true);
      }
    }
  }

  private showPPTXGuidanceDialog(file: File): void {
    const msg = `PowerPoint (.pptx) फ़ाइलें ब्राउज़र में सीधे 100% शुद्धता के साथ रेंडर नहीं हो सकती हैं।\n\nसर्वोत्तम और तीक्ष्ण 4K प्रस्तुति के लिए, कृपया PowerPoint या Google Slides में 'Save As PDF' या 'Export PDF' करें और PDF फ़ाइल यहाँ अपलोड करें।`;
    alert(msg);
  }

  loadInitialDeck(): void {
    const deck = deckLoader.createSampleDeck();
    this.applyDeck(deck);
  }

  applyDeck(deck: any): void {
    slideRenderer.clearCache();
    store.setState({
      currentDeck: deck,
      currentPage: 1,
      totalPages: deck.totalPages
    });

    this.fileNameEl.textContent = deck.name;
    this.pageCounterEl.textContent = `1 / ${deck.totalPages}`;

    const page = deck.pages[0];
    if (page) {
      slideRenderer.renderSlide(page);
      slideRenderer.preRenderAdjacent(deck.pages, 1);
    }
  }

  private reRenderCurrentSlide(): void {
    const state = store.getState();
    if (state.currentDeck && !state.isBoardMode) {
      const page = state.currentDeck.pages[state.currentPage - 1];
      if (page) {
        slideRenderer.renderSlide(page);
      }
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

      if (state.settings.fitMode !== prev.settings.fitMode || state.settings.renderQuality !== prev.settings.renderQuality) {
        slideRenderer.clearCache();
        this.reRenderCurrentSlide();
      }
    });
  }

  private showToast(msg: string, isError = false): void {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: msg, isError } }));
  }
}

export const slideView = new SlideView();
