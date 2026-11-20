import { store } from '../state/store';
// MIC-AI: Import micController
import { micController } from '../voice/micController';
// AUDIT-FIX: BUG-006 - Central gesture watchdog
import { gestureWatchdog } from '../core/gestureWatchdog';

export class PopoverManager {
  private activePopover: HTMLElement | null = null;
  private idleTimer: number = 0;
  // AUDIT-FIX: BUG-002 - Track outside listener to prevent listener leaks
  private outsideListener: ((e: any) => void) | null = null;

  isOpen(): boolean {
    return this.activePopover !== null;
  }

  private getHost(): HTMLElement {
    // Crucial for Full View: #stage is the fullscreen element.
    // Appending to document.body puts popovers outside fullscreen top-layer, making them invisible!
    return document.getElementById('stage') || document.body;
  }

  showPenPopover(anchorEl: HTMLElement): void {
    this.close();
    const state = store.getState();

    const popover = document.createElement('div');
    popover.className = 'popover pen-popover';
    popover.innerHTML = `
      <div class="popover-header">
        <span>✏️ Pen Options</span>
      </div>
      <div class="popover-row">
        <label>
          <span>Quick Size</span>
        </label>
        <div class="popover-presets" id="penQuickPresets">
          <button type="button" class="popover-preset-btn ${state.penSize === 3 ? 'active' : ''}" data-size="3">3px Fine</button>
          <button type="button" class="popover-preset-btn ${state.penSize === 6 ? 'active' : ''}" data-size="6">6px Standard</button>
          <button type="button" class="popover-preset-btn ${state.penSize === 12 ? 'active' : ''}" data-size="12">12px Bold</button>
          <button type="button" class="popover-preset-btn ${state.penSize === 20 ? 'active' : ''}" data-size="20">20px Marker</button>
        </div>
      </div>
      <div class="popover-row">
        <label>
          <span>Size</span>
          <span id="penSizeVal">${state.penSize}px</span>
        </label>
        <input type="range" class="popover-slider" id="penSizeSlider" min="1" max="40" value="${state.penSize}" />
      </div>
      <div class="popover-row">
        <label>
          <span>Opacity</span>
          <span id="penAlphaVal">${Math.round(state.penAlpha * 100)}%</span>
        </label>
        <input type="range" class="popover-slider" id="penAlphaSlider" min="20" max="100" value="${Math.round(state.penAlpha * 100)}" />
      </div>
      <div class="brush-preview">
        <div class="brush-dot" id="penPreviewDot" style="width: ${state.penSize}px; height: ${state.penSize}px; background-color: ${state.activeColor}; opacity: ${state.penAlpha}"></div>
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    this.getHost().appendChild(popover);
    this.activePopover = popover;

    const sizeSlider = popover.querySelector('#penSizeSlider') as HTMLInputElement;
    const alphaSlider = popover.querySelector('#penAlphaSlider') as HTMLInputElement;
    const dot = popover.querySelector('#penPreviewDot') as HTMLElement;
    const sizeVal = popover.querySelector('#penSizeVal') as HTMLElement;
    const alphaVal = popover.querySelector('#penAlphaVal') as HTMLElement;

    const updateSize = (sz: number) => {
      sizeVal.textContent = `${sz}px`;
      dot.style.width = `${sz}px`;
      dot.style.height = `${sz}px`;
      store.setState({ penSize: sz });
      this.resetIdleTimer();
    };

    sizeSlider.addEventListener('input', () => {
      const sz = Number(sizeSlider.value);
      popover.querySelectorAll('#penQuickPresets .popover-preset-btn').forEach(b => b.classList.remove('active'));
      updateSize(sz);
    });

    popover.querySelectorAll('#penQuickPresets .popover-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sz = Number(btn.getAttribute('data-size'));
        sizeSlider.value = String(sz);
        popover.querySelectorAll('#penQuickPresets .popover-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateSize(sz);
      });
    });

    alphaSlider.addEventListener('input', () => {
      const a = Number(alphaSlider.value) / 100;
      alphaVal.textContent = `${Math.round(a * 100)}%`;
      dot.style.opacity = `${a}`;
      store.setState({ penAlpha: a });
      this.resetIdleTimer();
    });

    this.bindOutsideAndIdle(popover, anchorEl);
  }

  showHighlighterPopover(anchorEl: HTMLElement): void {
    this.close();
    const state = store.getState();

    const popover = document.createElement('div');
    popover.className = 'popover hl-popover';
    popover.innerHTML = `
      <div class="popover-header">
        <span>🖍️ Highlighter Options</span>
      </div>
      <div class="popover-row">
        <label>
          <span>Quick Width</span>
        </label>
        <div class="popover-presets" id="hlQuickPresets">
          <button type="button" class="popover-preset-btn ${state.highlighterWidth === 16 ? 'active' : ''}" data-width="16">16px Fine</button>
          <button type="button" class="popover-preset-btn ${state.highlighterWidth === 28 ? 'active' : ''}" data-width="28">28px Standard</button>
          <button type="button" class="popover-preset-btn ${state.highlighterWidth === 44 ? 'active' : ''}" data-width="44">44px Wide</button>
          <button type="button" class="popover-preset-btn ${state.highlighterWidth === 64 ? 'active' : ''}" data-width="64">64px Thick</button>
        </div>
      </div>
      <div class="popover-row">
        <label>
          <span>Width</span>
          <span id="hlWidthVal">${state.highlighterWidth}px</span>
        </label>
        <input type="range" class="popover-slider" id="hlWidthSlider" min="10" max="80" value="${state.highlighterWidth}" />
      </div>
      <div class="popover-row">
        <label>
          <span>Density</span>
          <span id="hlAlphaVal">${Math.round(state.highlighterAlpha * 100)}%</span>
        </label>
        <input type="range" class="popover-slider" id="hlAlphaSlider" min="10" max="60" value="${Math.round(state.highlighterAlpha * 100)}" />
      </div>
      <div class="brush-preview" style="background: #ffffff;">
        <div id="hlPreviewBar" style="width: 80%; height: ${state.highlighterWidth / 2}px; background-color: ${state.activeColor}; opacity: ${state.highlighterAlpha}; border-radius: 2px;"></div>
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    this.getHost().appendChild(popover);
    this.activePopover = popover;

    const widthSlider = popover.querySelector('#hlWidthSlider') as HTMLInputElement;
    const alphaSlider = popover.querySelector('#hlAlphaSlider') as HTMLInputElement;
    const widthVal = popover.querySelector('#hlWidthVal') as HTMLElement;
    const alphaVal = popover.querySelector('#hlAlphaVal') as HTMLElement;
    const previewBar = popover.querySelector('#hlPreviewBar') as HTMLElement;

    const updateWidth = (w: number) => {
      widthVal.textContent = `${w}px`;
      if (previewBar) previewBar.style.height = `${w / 2}px`;
      store.setState({ highlighterWidth: w });
      this.resetIdleTimer();
    };

    widthSlider.addEventListener('input', () => {
      const w = Number(widthSlider.value);
      popover.querySelectorAll('#hlQuickPresets .popover-preset-btn').forEach(b => b.classList.remove('active'));
      updateWidth(w);
    });

    popover.querySelectorAll('#hlQuickPresets .popover-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const w = Number(btn.getAttribute('data-width'));
        widthSlider.value = String(w);
        popover.querySelectorAll('#hlQuickPresets .popover-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateWidth(w);
      });
    });

    alphaSlider.addEventListener('input', () => {
      const a = Number(alphaSlider.value) / 100;
      alphaVal.textContent = `${Math.round(a * 100)}%`;
      if (previewBar) previewBar.style.opacity = `${a}`;
      store.setState({ highlighterAlpha: a });
      this.resetIdleTimer();
    });

    this.bindOutsideAndIdle(popover, anchorEl);
  }

  showEraserPopover(anchorEl: HTMLElement): void {
    this.close();
    const state = store.getState();

    const popover = document.createElement('div');
    popover.className = 'popover eraser-popover';
    popover.innerHTML = `
      <div class="popover-header">
        <span>🧹 Eraser Options</span>
      </div>
      <div class="popover-row">
        <label>
          <span>Eraser Mode</span>
        </label>
        <div class="toggle-group">
          <button class="toggle-btn ${state.eraserMode === 'pixel' ? 'active' : ''}" id="btnModePixel">Pixel</button>
          <button class="toggle-btn ${state.eraserMode === 'stroke' ? 'active' : ''}" id="btnModeStroke">Stroke</button>
        </div>
      </div>
      <div class="popover-row">
        <label>
          <span>Quick Size</span>
        </label>
        <div class="popover-presets" id="eraserQuickPresets">
          <button type="button" class="popover-preset-btn ${state.eraserSize === 20 ? 'active' : ''}" data-size="20">20px Small</button>
          <button type="button" class="popover-preset-btn ${state.eraserSize === 40 ? 'active' : ''}" data-size="40">40px Medium</button>
          <button type="button" class="popover-preset-btn ${state.eraserSize === 80 ? 'active' : ''}" data-size="80">80px Large</button>
          <button type="button" class="popover-preset-btn ${state.eraserSize === 120 ? 'active' : ''}" data-size="120">120px Huge</button>
        </div>
      </div>
      <div class="popover-row">
        <label>
          <span>Size</span>
          <span id="eraserSizeVal">${state.eraserSize}px</span>
        </label>
        <input type="range" class="popover-slider" id="eraserSizeSlider" min="10" max="150" value="${state.eraserSize}" />
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    this.getHost().appendChild(popover);
    this.activePopover = popover;

    const sizeSlider = popover.querySelector('#eraserSizeSlider') as HTMLInputElement;
    const sizeVal = popover.querySelector('#eraserSizeVal') as HTMLElement;
    const btnPixel = popover.querySelector('#btnModePixel') as HTMLElement;
    const btnStroke = popover.querySelector('#btnModeStroke') as HTMLElement;

    const updateEraserSize = (s: number) => {
      sizeVal.textContent = `${s}px`;
      store.setState({ eraserSize: s });
      this.resetIdleTimer();
    };

    sizeSlider.addEventListener('input', () => {
      const s = Number(sizeSlider.value);
      popover.querySelectorAll('#eraserQuickPresets .popover-preset-btn').forEach(b => b.classList.remove('active'));
      updateEraserSize(s);
    });

    popover.querySelectorAll('#eraserQuickPresets .popover-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = Number(btn.getAttribute('data-size'));
        sizeSlider.value = String(s);
        popover.querySelectorAll('#eraserQuickPresets .popover-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateEraserSize(s);
      });
    });

    btnPixel.addEventListener('click', () => {
      btnPixel.classList.add('active');
      btnStroke.classList.remove('active');
      store.setState({ eraserMode: 'pixel' });
      this.resetIdleTimer();
    });

    btnStroke.addEventListener('click', () => {
      btnStroke.classList.add('active');
      btnPixel.classList.remove('active');
      store.setState({ eraserMode: 'stroke' });
      this.resetIdleTimer();
    });

    this.bindOutsideAndIdle(popover, anchorEl);
  }

  // MIC-AI: Mic settings and status popover on long-press or second tap
  showMicPopover(anchorEl: HTMLElement): void {
    this.close();
    const settings = store.getState().settings;
    const isListening = micController.getState() === 'listening';

    const popover = document.createElement('div');
    popover.className = 'popover mic-popover';
    popover.style.minWidth = '240px';
    popover.innerHTML = `
      <div class="popover-header">
        <span>🎙️ Mic Menu</span>
      </div>
      <div class="popover-row" style="justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 13px; font-weight: 600;">Status</span>
        <button id="popoverToggleMic" class="header-btn" style="padding: 4px 10px; font-size: 12px; background: ${isListening ? '#ef4444' : '#333'}; color: #fff;">
          ${isListening ? 'Mic ON' : 'Mic OFF'}
        </button>
      </div>
      <div class="popover-row" style="flex-direction: column; align-items: stretch; gap: 4px; margin-bottom: 8px;">
        <span style="font-size: 12px; color: var(--text-muted);">Language</span>
        <select id="popoverVoiceLang" class="header-btn" style="background:#111; font-size: 12px; padding: 4px 8px;">
          <option value="hi-IN" ${settings.voiceLang === 'hi-IN' ? 'selected' : ''}>Hindi (hi-IN)</option>
          <option value="en-IN" ${settings.voiceLang === 'en-IN' ? 'selected' : ''}>English (India - en-IN)</option>
        </select>
      </div>
      <div class="popover-row" style="flex-direction: column; align-items: stretch; gap: 4px; margin-bottom: 8px;">
        <span style="font-size: 12px; color: var(--text-muted);">Auto-off after</span>
        <select id="popoverMicAutoOff" class="header-btn" style="background:#111; font-size: 12px; padding: 4px 8px;">
          <option value="0" ${settings.micAutoOffMinutes === 0 ? 'selected' : ''}>Off / Never</option>
          <option value="5" ${settings.micAutoOffMinutes === 5 ? 'selected' : ''}>5 minutes</option>
          <option value="10" ${settings.micAutoOffMinutes === 10 ? 'selected' : ''}>10 minutes (Default)</option>
          <option value="30" ${settings.micAutoOffMinutes === 30 ? 'selected' : ''}>30 minutes</option>
        </select>
      </div>
      <div class="popover-row" style="justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: var(--text-muted);">Push-to-talk</span>
        <input type="checkbox" id="popoverPushToTalk" ${settings.pushToTalk ? 'checked' : ''} style="accent-color: var(--primary-accent); width: 16px; height: 16px;" />
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    this.getHost().appendChild(popover);
    this.activePopover = popover;

    popover.querySelector('#popoverToggleMic')?.addEventListener('click', () => {
      micController.toggle();
      this.close();
    });

    const langSelect = popover.querySelector('#popoverVoiceLang') as HTMLSelectElement;
    langSelect?.addEventListener('change', () => {
      store.updateSettings({ voiceLang: langSelect.value as any });
      this.resetIdleTimer();
    });

    const autoOffSelect = popover.querySelector('#popoverMicAutoOff') as HTMLSelectElement;
    autoOffSelect?.addEventListener('change', () => {
      store.updateSettings({ micAutoOffMinutes: Number(autoOffSelect.value) });
      this.resetIdleTimer();
    });

    const pttCheck = popover.querySelector('#popoverPushToTalk') as HTMLInputElement;
    pttCheck?.addEventListener('change', () => {
      store.updateSettings({ pushToTalk: pttCheck.checked });
      this.resetIdleTimer();
    });

    this.bindOutsideAndIdle(popover, anchorEl);
  }

  private positionPopover(popover: HTMLElement, anchorEl: HTMLElement): void {
    const rect = anchorEl.getBoundingClientRect();
    const anchorCenter = rect.left + rect.width / 2;
    const anchorTop = rect.top;

    // AUDIT-FIX: BUG-003 - Clamp popover horizontally to stay entirely within viewport
    const estimatedHalfWidth = 140; // 280px / 2
    const minCenter = estimatedHalfWidth + 8;
    const maxCenter = Math.max(minCenter, window.innerWidth - estimatedHalfWidth - 8);
    const clampedCenter = Math.max(minCenter, Math.min(anchorCenter, maxCenter));

    // Default above anchor, flip below if not enough room (< 220px from top)
    if (anchorTop < 220) {
      popover.style.top = `${rect.bottom + 12}px`;
      popover.style.bottom = 'auto';
      popover.style.left = `${clampedCenter}px`;
      popover.style.transform = 'translateX(-50%)';
    } else {
      popover.style.bottom = `${window.innerHeight - anchorTop + 12}px`;
      popover.style.top = 'auto';
      popover.style.left = `${clampedCenter}px`;
      popover.style.transform = 'translateX(-50%)';
    }
  }

  private bindOutsideAndIdle(popover: HTMLElement, anchorEl: HTMLElement): void {
    this.resetIdleTimer();

    // AUDIT-FIX: BUG-002 - Clean up existing outside listener if already bound
    if (this.outsideListener) {
      document.removeEventListener('pointerdown', this.outsideListener);
      this.outsideListener = null;
    }

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!popover.contains(target) && !anchorEl.contains(target)) {
        this.close();
      }
    };

    this.outsideListener = handleOutside;
    setTimeout(() => {
      if (this.outsideListener === handleOutside) {
        document.addEventListener('pointerdown', handleOutside);
      }
    }, 50);

    // AUDIT-FIX: BUG-006 - Register active popover with gesture watchdog
    gestureWatchdog.registerGesture('popover', () => this.close());
  }

  private resetIdleTimer(): void {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.close();
    }, 5000); // 5s idle per B5.4
  }

  close(): void {
    window.clearTimeout(this.idleTimer);
    // AUDIT-FIX: BUG-002 - Remove outside listener cleanly on any close
    if (this.outsideListener) {
      document.removeEventListener('pointerdown', this.outsideListener);
      this.outsideListener = null;
    }
    // AUDIT-FIX: BUG-006 - Unregister gesture
    gestureWatchdog.unregisterGesture('popover');

    if (this.activePopover) {
      this.activePopover.remove();
      this.activePopover = null;
    }
  }
}

export const popoverManager = new PopoverManager();
