// SSIRO-UPDATE: Welcome Screen Controller ("Welcome to SSIRO Classes")
import { store } from '../state/store';
import { WELCOME_LINE_1, WELCOME_LINE_2 } from '../brand';

export class WelcomeScreen {
  private element: HTMLElement | null = null;
  private isDismissed = false;
  private canSkip = false;
  private skipTimer = 0;
  private autoDismissTimer = 0;
  private onFinishedCallbacks: Array<() => void> = [];

  show(onFinished?: () => void): void {
    if (onFinished) {
      this.onFinishedCallbacks.push(onFinished);
    }

    const settings = store.getState().settings;
    if (!settings.showWelcomeScreen) {
      this.finish();
      return;
    }

    this.element = document.getElementById('welcomeScreen');
    if (!this.element) {
      this.finish();
      return;
    }

    // Update dynamic text from settings or brand constants
    const line1El = this.element.querySelector('.welcome-line-1');
    const line2El = this.element.querySelector('.welcome-line-2');
    if (line1El) line1El.textContent = settings.welcomeLine1 || WELCOME_LINE_1;
    if (line2El) line2El.textContent = settings.welcomeLine2 || WELCOME_LINE_2;

    this.element.classList.remove('hidden', 'fade-out');

    // Tap/key skipping allowed after 800ms
    this.skipTimer = window.setTimeout(() => {
      this.canSkip = true;
    }, 800);

    // Auto dismiss after duration (default 2.8s)
    const durationMs = Math.max(1000, Math.min(5000, (settings.welcomeDuration || 2.8) * 1000));
    this.autoDismissTimer = window.setTimeout(() => {
      this.dismiss();
    }, durationMs);

    this.bindEvents();
    this.preWarmServices();
  }

  private bindEvents(): void {
    if (!this.element) return;

    const handleSkip = (e: Event) => {
      if (!this.canSkip || this.isDismissed) return;
      e.stopPropagation();
      this.dismiss();
    };

    this.element.addEventListener('pointerdown', handleSkip, { passive: true });
    window.addEventListener('keydown', handleSkip, { passive: true });
    window.addEventListener('touchstart', handleSkip, { passive: true });
  }

  dismiss(): void {
    if (this.isDismissed || !this.element) return;
    this.isDismissed = true;
    window.clearTimeout(this.skipTimer);
    window.clearTimeout(this.autoDismissTimer);

    // Cross-fade (300ms) into the home screen
    this.element.classList.add('fade-out');
    window.setTimeout(() => {
      if (this.element) {
        this.element.classList.add('hidden');
        this.element.remove();
      }
      this.finish();
    }, 300);
  }

  private finish(): void {
    for (const cb of this.onFinishedCallbacks) {
      try {
        cb();
      } catch (e) {
        console.error('Error in welcomeScreen onFinished callback:', e);
      }
    }
    this.onFinishedCallbacks = [];
  }

  // Silently pre-warm fonts, pdf.js worker, last-used settings in background
  private preWarmServices(): void {
    try {
      if ('fonts' in document) {
        (document as any).fonts.load('800 64px Inter').catch(() => {});
        (document as any).fonts.load('800 64px "Noto Sans Devanagari"').catch(() => {});
      }
      // Pre-warm local PDF worker
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = '/pdf.worker.min.mjs';
      document.head.appendChild(link);
    } catch {}
  }
}

export const welcomeScreen = new WelcomeScreen();
