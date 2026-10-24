import { store } from '../state/store';

export class WebOverlay {
  private overlayEl!: HTMLElement;
  private inputUrl!: HTMLInputElement;
  private frameEl!: HTMLIFrameElement;
  private fallbackEl!: HTMLElement;
  private timeoutTimer: number = 0;

  init(): void {
    this.overlayEl = document.getElementById('webOverlay') as HTMLElement;
    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.overlayEl.innerHTML = `
      <div class="web-overlay-bar">
        <input type="text" class="web-overlay-input" id="webUrlInput" placeholder="URL या खोज दर्ज करें (e.g. en.m.wikipedia.org or topic)..." value="https://en.m.wikipedia.org" />
        <button class="header-btn" id="btnWebGo">खोजें / Go</button>
        <button class="web-overlay-close" id="btnWebClose" title="Close Browser (Return to Slide)">✕</button>
      </div>
      <div class="web-frame-container">
        <iframe id="webIframe" class="web-frame" src="https://en.m.wikipedia.org" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
        <div id="webFallbackCard" class="web-fallback-card hidden">
          <h3>यह साइट इस बॉक्स में सीधे नहीं खुल सकती</h3>
          <p>सुरक्षा नीतियों (X-Frame-Options) के कारण गूगल या बाहरी साइटें इन-ऐप फ़्रेम में अवरुद्ध हैं।</p>
          <p>कृपया इसे नई विंडो में खोलें और OBS / StreamYard में Window Capture का उपयोग करें।</p>
          <button class="header-btn" id="btnOpenNewWindow" style="background: var(--primary-accent); color: #000; font-weight: 700; margin-top: 12px;">
            नई विंडो में खोलें (Open in New Tab)
          </button>
        </div>
      </div>
    `;

    this.inputUrl = this.overlayEl.querySelector('#webUrlInput') as HTMLInputElement;
    this.frameEl = this.overlayEl.querySelector('#webIframe') as HTMLIFrameElement;
    this.fallbackEl = this.overlayEl.querySelector('#webFallbackCard') as HTMLElement;
  }

  private bindEvents(): void {
    const btnClose = this.overlayEl.querySelector('#btnWebClose');
    btnClose?.addEventListener('click', () => {
      this.close();
    });

    const btnGo = this.overlayEl.querySelector('#btnWebGo');
    btnGo?.addEventListener('click', () => {
      this.navigate();
    });

    this.inputUrl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.navigate();
      }
    });

    const btnNewWin = this.overlayEl.querySelector('#btnOpenNewWindow');
    btnNewWin?.addEventListener('click', () => {
      const url = this.getNormalizedUrl(this.inputUrl.value);
      window.open(url, '_blank');
    });

    window.addEventListener('toggle-web-overlay', () => {
      this.toggle();
    });
  }

  private navigate(): void {
    let target = this.inputUrl.value.trim();
    if (!target) return;

    // If not a full URL or looks like search terms, direct to Wikipedia or Google
    if (!/^https?:\/\//i.test(target)) {
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        // Search term
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
        // Google forbids iframes, so immediately show fallback or open in new window
        this.fallbackEl.classList.remove('hidden');
        window.open(searchUrl, '_blank');
        return;
      }
    }

    this.fallbackEl.classList.add('hidden');
    this.frameEl.src = target;

    // Detect iframe load failure after 3 seconds per B10.1
    window.clearTimeout(this.timeoutTimer);
    this.timeoutTimer = window.setTimeout(() => {
      try {
        // Test cross-origin security block
        if (!this.frameEl.contentDocument || this.frameEl.contentDocument.body.innerHTML === '') {
          this.fallbackEl.classList.remove('hidden');
        }
      } catch {
        // Cross-origin restriction is normal, but if blank error page is shown:
      }
    }, 3000);
  }

  private getNormalizedUrl(raw: string): string {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes('.') && !trimmed.includes(' ')) return `https://${trimmed}`;
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  open(): void {
    store.setState({ isWebOverlayOpen: true });
    this.overlayEl.classList.remove('hidden');
  }

  close(): void {
    store.setState({ isWebOverlayOpen: false });
    this.overlayEl.classList.add('hidden');
    window.clearTimeout(this.timeoutTimer);
  }

  toggle(): void {
    if (store.getState().isWebOverlayOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

export const webOverlay = new WebOverlay();
