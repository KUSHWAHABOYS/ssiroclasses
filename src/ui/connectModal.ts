// SSIRO-UPDATE: Android Board & Mobile Connect Modal with Live QR Code
import QRCode from 'qrcode';

export class ConnectModal {
  private element: HTMLElement | null = null;
  private isBound = false;
  private cachedIp: string = '192.168.31.18';
  private cachedPort: number = 5173;

  async init(): Promise<void> {
    this.ensureElement();
    await this.fetchNetworkInfo();
  }

  private ensureElement(): void {
    if (this.element) return;

    let el = document.getElementById('connectBoardModal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'connectBoardModal';
      el.className = 'connect-modal-backdrop hidden';
      el.innerHTML = `
        <div class="connect-modal-card" role="dialog" aria-modal="true" aria-labelledby="connectModalTitle">
          <button class="connect-modal-close" id="btnCloseConnectModal" aria-label="Close modal">✕</button>
          
          <div class="connect-modal-header">
            <div class="connect-icon-pulse">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
            </div>
            <div>
              <h2 id="connectModalTitle" class="connect-title">Android Digital Board & Mobile Connect</h2>
              <p class="connect-subtitle">डिजिटल बोर्ड या मोबाइल में स्मार्ट स्टूडियो कैसे खोलें</p>
            </div>
          </div>

          <div class="connect-modal-body">
            <div class="connect-qr-section">
              <div class="connect-qr-frame">
                <canvas id="connectQrCanvas" class="connect-qr-canvas"></canvas>
              </div>
              <span class="connect-qr-caption">📷 कैमरा से स्कैन करें (Scan with Phone)</span>
            </div>

            <div class="connect-info-section">
              <div class="connect-url-box">
                <label class="connect-label">बोर्ड / मोबाइल के Browser में यह URL डालें:</label>
                <div class="connect-input-group">
                  <input type="text" id="connectUrlInput" readonly class="connect-url-field" value="http://192.168.31.18:5173" />
                  <button id="btnCopyConnectUrl" class="btn-copy-url" title="कॉपी करें (Copy URL)">
                    <span id="copyBtnText">Copy</span>
                  </button>
                </div>
              </div>

              <div class="connect-notice-card alert-warning">
                <div class="notice-icon">⚠️</div>
                <div class="notice-text">
                  <strong>महत्वपूर्ण सूचना (Do NOT enter 'localhost'):</strong><br/>
                  Android Board में <code>localhost</code> नहीं डालना है! <code>localhost</code> केवल उसी डिवाइस का पता होता है। Android Board के Browser में ऊपर दिया गया IP <strong><span class="highlight-ip">192.168.31.18:5173</span></strong> ही डालें।
                </div>
              </div>

              <div class="connect-steps-list">
                <div class="connect-step">
                  <div class="step-num">1</div>
                  <div class="step-desc">
                    <strong>एक ही Wi-Fi या LAN:</strong> आपका PC और Digital Board दोनों एक ही Wi-Fi / Router नेटवर्क से जुड़े होने चाहिए।
                  </div>
                </div>
                <div class="connect-step">
                  <div class="step-num">2</div>
                  <div class="step-desc">
                    <strong>Browser में URL खोलें:</strong> Digital Board के Chrome या Browser में <code>http://<span class="step-ip">192.168.31.18:5173</span></code> खोलें।
                  </div>
                </div>
                <div class="connect-step">
                  <div class="step-num">3</div>
                  <div class="step-desc">
                    <strong>Fullscreen App बनाएं:</strong> Browser के मेनू (⋮) में जाकर <em>"Add to Home screen"</em> या <em>"Install App"</em> दबाएँ।
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="connect-modal-footer">
            <span class="connect-footer-note">✨ SSIRO Classes Smart Studio Pro • 100% Offline LAN Mode</span>
            <button class="btn-done-connect" id="btnDoneConnect">समझ गया (Got it)</button>
          </div>
        </div>
      `;
      document.body.appendChild(el);
    }
    this.element = el;

    if (!this.isBound) {
      this.bindEvents();
      this.isBound = true;
    }
  }

  private async fetchNetworkInfo(): Promise<void> {
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const data = await res.json();
        if (data.ip && data.ip !== 'localhost' && data.ip !== '127.0.0.1') {
          this.cachedIp = data.ip;
        } else if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          this.cachedIp = window.location.hostname;
        }
        if (data.port) {
          this.cachedPort = data.port;
        }
      }
    } catch {
      if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        this.cachedIp = window.location.hostname;
      }
    }
  }

  private getConnectUrl(): string {
    const port = window.location.port || String(this.cachedPort);
    const host = (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? window.location.hostname
      : this.cachedIp;
    return `http://${host}:${port}/`;
  }

  async show(): Promise<void> {
    this.ensureElement();
    await this.fetchNetworkInfo();

    const connectUrl = this.getConnectUrl();
    const urlInput = this.element?.querySelector('#connectUrlInput') as HTMLInputElement | null;
    if (urlInput) {
      urlInput.value = connectUrl;
    }

    const highlightIps = this.element?.querySelectorAll('.highlight-ip, .step-ip');
    highlightIps?.forEach((el) => {
      el.textContent = connectUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    });

    const canvas = this.element?.querySelector('#connectQrCanvas') as HTMLCanvasElement | null;
    if (canvas) {
      try {
        await QRCode.toCanvas(canvas, connectUrl, {
          width: 200,
          margin: 1,
          color: {
            dark: '#0A1633',
            light: '#FFFFFF'
          }
        });
      } catch (err) {
        console.error('Failed to render QR Code', err);
      }
    }

    this.element?.classList.remove('hidden');
  }

  hide(): void {
    this.element?.classList.add('hidden');
  }

  private bindEvents(): void {
    if (!this.element) return;

    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.hide();
      }
    });

    const closeBtn = this.element.querySelector('#btnCloseConnectModal');
    closeBtn?.addEventListener('click', () => this.hide());

    const doneBtn = this.element.querySelector('#btnDoneConnect');
    doneBtn?.addEventListener('click', () => this.hide());

    const copyBtn = this.element.querySelector('#btnCopyConnectUrl');
    copyBtn?.addEventListener('click', async () => {
      const urlInput = this.element?.querySelector('#connectUrlInput') as HTMLInputElement | null;
      if (!urlInput) return;
      try {
        await navigator.clipboard.writeText(urlInput.value);
        const copyBtnText = this.element?.querySelector('#copyBtnText');
        if (copyBtnText) copyBtnText.textContent = '✓ Copied!';
        window.setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'Copy';
        }, 2000);
      } catch {
        urlInput.select();
        document.execCommand('copy');
      }
    });
  }
}

export const connectModal = new ConnectModal();
