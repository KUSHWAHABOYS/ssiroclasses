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
    if (line1El && settings.welcomeLine1) line1El.textContent = settings.welcomeLine1;
    if (line2El && settings.welcomeLine2) line2El.textContent = settings.welcomeLine2;

    // AUDIT-FIX: BUG-007 - Render custom logo if saved on device
    const logoImg = this.element.querySelector('#welcomeLogoImg') as HTMLImageElement;
    if (logoImg && settings.customLogo) {
      logoImg.src = settings.customLogo;
    }

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

    // AUDIT-FIX: BUG-007 - Click logo opens Change Logo modal per WEL-6
    const logoWrapper = this.element.querySelector('#welcomeLogoWrapper, .welcome-logo-container') as HTMLElement;
    logoWrapper?.addEventListener('click', (e) => {
      e.stopPropagation();
      import('./changeLogoModal').then(({ changeLogoModal }) => {
        changeLogoModal.show();
      });
    });
    if (logoWrapper) {
      logoWrapper.style.cursor = 'pointer';
      logoWrapper.title = 'Click to change logo & organisation name';
    }

    // Open Deck Button inside Welcome Screen with loading animation
    this.openDeckBtn = this.element.querySelector('#btnWelcomeOpenDeck');
    this.openDeckBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = this.openDeckBtn;
      if (btn) {
        const origContent = btn.innerHTML;
        btn.innerHTML = `
          <span class="material-symbols-outlined font-bold" style="animation: welcomeSpin 1s linear infinite;">sync</span>
          <span>Loading Decks...</span>
        `;
        setTimeout(() => {
          if (btn) btn.innerHTML = origContent;
        }, 1200);
      }
      const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
      fileInput?.click();
    });

    // Library button in Welcome Screen
    const libBtn = this.element.querySelector('#btnWelcomeLibrary');
    libBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('open-library-modal'));
    });

    // Help & Privacy link in Welcome footer opens Studio Settings
    const helpLink = this.element.querySelector('#btnWelcomeHelp');
    helpLink?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('toggle-settings'));
    });

    // Requirement 3 & 5: Stray taps and clicks on the welcome screen must do nothing
    this.element.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.welcome-open-btn, .header-btn, .welcome-logo-container, #welcomeLogoWrapper, .welcome-btn-secondary, .welcome-btn-tertiary, #btnWelcomeHelp')) return;
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
