// WELCOME-FIX: Persistent Welcome Home Screen Controller ("Welcome to SSIRO Classes")
import { store } from '../state/store';
import { WELCOME_LINE_1, WELCOME_LINE_2 } from '../brand';

export class WelcomeScreen {
  private element: HTMLElement | null = null;
  private openDeckBtn: HTMLElement | null = null;
  private isBound = false;

  show(): void {
    this.element = document.getElementById('welcomeScreen');
    if (!this.element) return;

    const settings = store.getState().settings;

    // Update dynamic text lines from settings or brand constants
    const line1El = this.element.querySelector('.welcome-line-1');
    const line2El = this.element.querySelector('.welcome-line-2');
    if (line1El) line1El.textContent = settings.welcomeLine1 || WELCOME_LINE_1;
    if (line2El) line2El.textContent = settings.welcomeLine2 || WELCOME_LINE_2;

    // If "Show welcome screen" is turned off, use compact version per requirement 9
    if (settings.showWelcomeScreen === false) {
      this.element.classList.add('is-compact');
    } else {
      this.element.classList.remove('is-compact');
    }

    this.element.classList.remove('hidden', 'fade-out');

    if (!this.isBound) {
      this.bindEvents();
      this.isBound = true;
    }

    this.preWarmServices();
  }

  private bindEvents(): void {
    if (!this.element) return;

    // Open Deck Button inside Welcome Screen
    this.openDeckBtn = this.element.querySelector('#btnWelcomeOpenDeck');
    this.openDeckBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
      fileInput?.click();
    });

    // Drag and drop onto the welcome screen
    this.element.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    this.element.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        window.dispatchEvent(new CustomEvent('app-open-files', { detail: { files } }));
      }
    });

    // Requirement 3 & 5: Stray taps and clicks on the welcome screen must do nothing
    this.element.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.welcome-open-btn, .header-btn')) return;
      e.stopPropagation();
    });
  }

  dismiss(): void {
    if (!this.element) {
      this.element = document.getElementById('welcomeScreen');
    }
    if (!this.element) return;

    // Fade out over 300ms into the slide view
    this.element.classList.add('fade-out');
    window.setTimeout(() => {
      if (this.element && this.element.classList.contains('fade-out')) {
        this.element.classList.add('hidden');
      }
    }, 300);
  }

  // Silently pre-warm fonts and pdf.js worker in background
  private preWarmServices(): void {
    try {
      if ('fonts' in document) {
        (document as any).fonts.load('800 64px Inter').catch(() => {});
        (document as any).fonts.load('800 64px "Noto Sans Devanagari"').catch(() => {});
      }
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = '/pdf.worker.min.mjs';
      document.head.appendChild(link);
    } catch {}
  }
}

export const welcomeScreen = new WelcomeScreen();
