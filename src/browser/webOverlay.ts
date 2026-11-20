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
    const isElectron = typeof window !== 'undefined' && (
      !!(window as any).electron || 
      !!(window as any).process?.versions?.electron ||
      navigator.userAgent.toLowerCase().includes('electron')
    );

    this.overlayEl.innerHTML = `
      <div class="web-overlay-bar">
        <input type="text" class="web-overlay-input" id="webUrlInput" placeholder="Enter URL or search (e.g. google.com or topic)..." value="https://www.google.com" />
        <button class="header-btn" id="btnWebGo">Go</button>
        <button class="header-btn" id="btnOpenNewWindow" title="Open in New Tab" style="background: rgba(255,255,255,0.1); font-size:12px; margin-left:auto;">
          ⛶ New Tab
        </button>
        <button class="web-overlay-close" id="btnWebClose" title="Close Browser (Return to Slide)">✕</button>
      </div>
      <div class="web-frame-container" id="webFrameContainer">
        ${isElectron
          ? `<webview id="webIframe" class="web-frame" src="about:blank" style="width:100%;height:100%;border:none;"></webview>`
          : `<iframe id="webIframe" class="web-frame" src="about:blank" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe>`
        }
        <div id="webFallbackCard" class="web-fallback-card hidden">
          <h3>This website cannot be displayed directly in this frame</h3>
          <p>Due to security policies (X-Frame-Options), Google and external websites are blocked from displaying inside an iframe.</p>
          <p>Please open it in a new window and use Window Capture in OBS / StreamYard.</p>
          <button class="header-btn" id="btnCardOpenNewWindow" style="background: var(--primary-accent); color: #000; font-weight: 700; margin-top: 12px;">
            Open in New Tab
          </button>
        </div>
      </div>
    `;

    this.inputUrl = this.overlayEl.querySelector('#webUrlInput') as HTMLInputElement;
    this.frameEl = this.overlayEl.querySelector('#webIframe') as any;
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

    const btnCardNewWin = this.overlayEl.querySelector('#btnCardOpenNewWindow');
    btnCardNewWin?.addEventListener('click', () => {
      const url = this.getNormalizedUrl(this.inputUrl.value);
      window.open(url, '_blank');
    });

    window.addEventListener('toggle-web-overlay', () => {
      this.toggle();
    });
  }

  private navigate(): void {
    let raw = this.inputUrl.value.trim();
    if (!raw) raw = 'https://www.google.com';

    let target = raw;

    // Handle search query vs full URL
    if (!/^https?:\/\//i.test(target)) {
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        // Direct Google search query with embed-enabled igu=1
        target = `https://www.google.com/search?igu=1&q=${encodeURIComponent(target)}`;
      }
    }

    // Embed URL routing:
    // 1. Google uses official igu=1 parameter which returns X-Frame-Options: null
    // 2. Other external domains route via local proxy to strip X-Frame-Options and CSP headers
    let embedSrc = target;
    if (target.includes('google.com')) {
      embedSrc = target + (target.includes('?') ? '&' : '?') + 'igu=1';
    } else {
      embedSrc = `/api/proxy?url=${encodeURIComponent(target)}`;
    }

    this.fallbackEl.classList.add('hidden');
    this.frameEl.src = embedSrc;
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
    if (!this.inputUrl.value) {
      this.inputUrl.value = 'https://www.google.com';
    }
    if (!this.frameEl.src || this.frameEl.src === 'about:blank' || this.frameEl.src === window.location.href || this.frameEl.src.endsWith('/')) {
      this.navigate();
    }
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
