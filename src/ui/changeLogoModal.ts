// AUDIT-FIX: BUG-007 - Change Logo & Organisation Branding Modal per WEL-6
import { store } from '../state/store';
import { WELCOME_LINE_2 } from '../brand';

export function sanitizeSvg(svgText: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    // Remove script tags
    const scripts = doc.querySelectorAll('script');
    scripts.forEach((s) => s.remove());
    // Strip inline event listeners & javascript: URIs
    const elements = doc.querySelectorAll('*');
    for (const el of Array.from(elements)) {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.toLowerCase().startsWith('on') || attr.value.toLowerCase().includes('javascript:')) {
          el.removeAttribute(attr.name);
        }
      }
    }
    return new XMLSerializer().serializeToString(doc.documentElement);
  } catch {
    return '';
  }
}

export class ChangeLogoModal {
  private modalEl: HTMLElement | null = null;
  private previewCanvas: HTMLCanvasElement | null = null;
  private croppedDataUrl: string = '';

  show(): void {
    this.close();

    const state = store.getState();
    const settings = state.settings;
    const currentOrg = settings.channelName || settings.welcomeLine2 || WELCOME_LINE_2;

    const modal = document.createElement('div');
    modal.className = 'settings-modal z-modal';
    modal.id = 'changeLogoModal';
    modal.style.maxWidth = '540px';
    modal.innerHTML = `
      <div class="settings-content" style="max-height:85vh; overflow-y:auto; padding:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:12px;">
          <h2 style="font-size:18px; font-weight:700; color:#FFD76A; margin:0;">
            🎨 Change Logo &amp; Brand
          </h2>
          <button id="btnCloseLogoModal" class="header-btn" style="width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center;">✕</button>
        </div>

        <!-- Organisation Name Field -->
        <div class="setting-item" style="flex-direction:column; align-items:flex-start; gap:8px; margin-bottom:16px;">
          <label style="font-weight:600; font-size:14px; color:#fff;">Organisation / Channel Name:</label>
          <input type="text" id="inputOrgName" class="gemini-input" style="width:100%; font-size:15px; padding:10px 14px;" value="${currentOrg}" placeholder="e.g. SSIRO Classes" />
        </div>

        <!-- Logo Picker & Square Crop -->
        <div class="setting-item" style="flex-direction:column; align-items:flex-start; gap:12px; margin-bottom:20px;">
          <label style="font-weight:600; font-size:14px; color:#fff;">Pick Image / SVG:</label>
          <input type="file" id="filePickerLogo" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="color:#aaa; font-size:13px;" />
          
          <div style="width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.4); border:1px dashed rgba(255,255,255,0.2); border-radius:12px; padding:16px;">
            <canvas id="logoCropCanvas" width="160" height="160" style="width:160px; height:160px; border-radius:12px; background:#111; box-shadow:0 4px 12px rgba(0,0,0,0.5);"></canvas>
            <span style="font-size:12px; color:#888; margin-top:8px;">1:1 Square Crop Preview</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px;">
          <button id="btnResetDefaultLogo" class="header-btn" style="background:rgba(239,68,68,0.15); color:#fca5a5; border-color:rgba(239,68,68,0.4); height:42px; padding:0 16px;">
            ↺ Reset Defaults
          </button>
          <button id="btnApplyLogo" class="header-btn" style="background:#E8890C; color:#fff; border-color:#FFD76A; font-weight:700; height:42px; padding:0 24px;">
            ✓ Apply
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    this.modalEl = modal;
    this.previewCanvas = modal.querySelector('#logoCropCanvas');

    // Draw initial state on canvas
    this.renderCurrentLogoToCanvas(settings.customLogo);

    this.bindEvents();
  }

  private renderCurrentLogoToCanvas(customLogoUrl?: string): void {
    if (!this.previewCanvas) return;
    const ctx = this.previewCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 160, 160);

    if (customLogoUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 160, 160);
      };
      img.src = customLogoUrl;
      this.croppedDataUrl = customLogoUrl;
    } else {
      // Draw placeholder or current default lotus logo
      ctx.fillStyle = '#14306B';
      ctx.fillRect(0, 0, 160, 160);
      ctx.fillStyle = '#FFD76A';
      ctx.font = '700 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SSIRO', 80, 80);
    }
  }

  private bindEvents(): void {
    if (!this.modalEl) return;

    this.modalEl.querySelector('#btnCloseLogoModal')?.addEventListener('click', () => {
      this.close();
    });

    const fileInput = this.modalEl.querySelector('#filePickerLogo') as HTMLInputElement;
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      if (file.type === 'image/svg+xml') {
        const text = await file.text();
        const cleanSvg = sanitizeSvg(text);
        const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        this.cropSquareImage(url);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result) this.cropSquareImage(result);
        };
        reader.readAsDataURL(file);
      }
    });

    // Apply button
    this.modalEl.querySelector('#btnApplyLogo')?.addEventListener('click', () => {
      const inputOrg = this.modalEl?.querySelector('#inputOrgName') as HTMLInputElement;
      const orgName = (inputOrg?.value || '').trim() || WELCOME_LINE_2;

      store.updateSettings({
        channelName: orgName,
        welcomeLine2: orgName,
        customLogo: this.croppedDataUrl
      });

      this.updateDOMBranding(orgName, this.croppedDataUrl);

      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: `✅ Logo & branding updated (${orgName})` }
        })
      );

      this.close();
    });

    // Reset button
    this.modalEl.querySelector('#btnResetDefaultLogo')?.addEventListener('click', () => {
      store.updateSettings({
        channelName: 'SSIRO Classes',
        welcomeLine2: 'SSIRO Classes',
        customLogo: ''
      });

      this.updateDOMBranding('SSIRO Classes', '');

      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: '↺ Default SSIRO logo & branding restored' }
        })
      );

      this.close();
    });
  }

  private cropSquareImage(srcUrl: string): void {
    const img = new Image();
    img.onload = () => {
      if (!this.previewCanvas) return;
      const ctx = this.previewCanvas.getContext('2d');
      if (!ctx) return;

      // Calculate square center crop
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const srcX = (img.naturalWidth - size) / 2;
      const srcY = (img.naturalHeight - size) / 2;

      ctx.clearRect(0, 0, 160, 160);
      ctx.drawImage(img, srcX, srcY, size, size, 0, 0, 160, 160);

      this.croppedDataUrl = this.previewCanvas.toDataURL('image/png');
    };
    img.src = srcUrl;
  }

  private updateDOMBranding(orgName: string, logoDataUrl: string): void {
    // Update welcome screen title
    const line2 = document.querySelector('.welcome-line-2');
    if (line2) line2.textContent = orgName;

    // Update channel badge in header
    const badge = document.getElementById('channelName');
    if (badge) badge.textContent = orgName;

    // Update welcome logo container
    const logoContainer = document.querySelector('.welcome-logo-container') as HTMLElement;
    if (logoContainer) {
      if (logoDataUrl) {
        logoContainer.innerHTML = `<img src="${logoDataUrl}" style="width:100%; height:100%; object-fit:contain; border-radius:24px;" alt="${orgName} Logo" />`;
      } else {
        // Restore default SVG logo
        logoContainer.innerHTML = `
          <svg class="welcome-logo" viewBox="0 0 512 512" width="100%" height="100%">
            <defs>
              <linearGradient id="wl_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14306B"/><stop offset="1" stop-color="#0A1633"/></linearGradient>
              <linearGradient id="wl_gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD76A"/><stop offset="1" stop-color="#E8890C"/></linearGradient>
              <radialGradient id="wl_glass" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#2A4A94"/><stop offset="1" stop-color="#0F2150"/></radialGradient>
              <linearGradient id="wl_petalC" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF9A2E"/><stop offset="1" stop-color="#FFE08A"/></linearGradient>
              <linearGradient id="wl_petalS" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFE9B8"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
            </defs>
            <rect width="512" height="512" rx="112" fill="url(#wl_bg)"/>
            <g transform="translate(-12 -8)">
              <line x1="330" y1="322" x2="418" y2="410" stroke="url(#wl_gold)" stroke-width="40" stroke-linecap="round"/>
              <circle cx="240" cy="232" r="130" fill="url(#wl_glass)" stroke="url(#wl_gold)" stroke-width="26"/>
              <path d="M240 195 C264 222 264 262 240 290 C216 262 216 222 240 195 Z" fill="url(#wl_petalS)" opacity="0.85" transform="rotate(-68 240 290)"/>
              <path d="M240 195 C264 222 264 262 240 290 C216 262 216 222 240 195 Z" fill="url(#wl_petalS)" opacity="0.85" transform="rotate(68 240 290)"/>
              <path d="M240 160 C272 195 272 255 240 290 C208 255 208 195 240 160 Z" fill="url(#wl_petalS)" transform="rotate(-36 240 290)"/>
              <path d="M240 160 C272 195 272 255 240 290 C208 255 208 195 240 160 Z" fill="url(#wl_petalS)" transform="rotate(36 240 290)"/>
              <path d="M240 160 C272 195 272 255 240 290 C208 255 208 195 240 160 Z" fill="url(#wl_petalC)"/>
              <path d="M150 190 A100 100 0 0 1 215 130" fill="none" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="10" stroke-linecap="round"/>
            </g>
          </svg>
        `;
      }
    }
  }

  close(): void {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
      this.previewCanvas = null;
    }
  }
}

export const changeLogoModal = new ChangeLogoModal();
