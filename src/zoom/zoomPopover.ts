// SSIRO-UPDATE: Magnifier & Zoom Popover
import { store } from '../state/store';
import { zoomController } from './zoomController';

export class ZoomPopoverManager {
  private activePopover: HTMLElement | null = null;
  private idleTimer: number = 0;

  showMagnifierPopover(anchorEl: HTMLElement): void {
    this.close();
    const settings = store.getState().settings;
    const isCircle = (settings.magnifierShape || 'circle') === 'circle';
    const isPinMode = settings.magnifierMode === 'pin';
    const isAbove = (settings.magnifierTouchPos || 'above') === 'above';

    const popover = document.createElement('div');
    popover.className = 'popover zoom-popover';
    popover.style.minWidth = '280px';
    popover.innerHTML = `
      <div class="popover-header">
        <span>मैग्नीफ़ायर सेटिंग्स (Magnifier)</span>
      </div>

      <!-- Size -->
      <div class="popover-row">
        <label>
          <span>आकार (Lens Size)</span>
          <span id="magSizeVal">${settings.magnifierSize || 280}px</span>
        </label>
        <input type="range" class="popover-slider" id="magSizeSlider" min="120" max="600" step="10" value="${settings.magnifierSize || 280}" />
      </div>

      <!-- Magnification -->
      <div class="popover-row">
        <label>
          <span>आवर्धन (Zoom)</span>
          <span id="magZoomVal">${settings.magnifierZoom || 3.0}×</span>
        </label>
        <input type="range" class="popover-slider" id="magZoomSlider" min="1.5" max="8" step="0.5" value="${settings.magnifierZoom || 3.0}" />
      </div>

      <!-- Shape -->
      <div class="popover-row">
        <label>
          <span>आकार शैली (Shape)</span>
        </label>
        <div style="display:flex; gap:8px;">
          <button id="btnShapeCircle" class="header-btn ${isCircle ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">वृत्त (Circle)</button>
          <button id="btnShapeRect" class="header-btn ${!isCircle ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">आयत (Rect)</button>
        </div>
      </div>

      <!-- Mode -->
      <div class="popover-row">
        <label>
          <span>मोड (Mode)</span>
        </label>
        <div style="display:flex; gap:8px;">
          <button id="btnModeFollow" class="header-btn ${!isPinMode ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Follow (पीछा करें)</button>
          <button id="btnModePin" class="header-btn ${isPinMode ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Pin-on-tap (टिकाएँ)</button>
        </div>
      </div>

      <!-- Spotlight -->
      <div class="popover-row">
        <label>
          <span>स्पॉटलाइट (Spotlight)</span>
          <input type="checkbox" id="chkSpotlight" ${settings.magnifierSpotlight ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary-accent);" />
        </label>
      </div>

      <!-- Touch Position -->
      <div class="popover-row">
        <label>
          <span>टच स्थिति (Touch Position)</span>
        </label>
        <div style="display:flex; gap:8px;">
          <button id="btnTouchAbove" class="header-btn ${isAbove ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Above (ऊपर)</button>
          <button id="btnTouchUnder" class="header-btn ${!isAbove ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Under (नीचे)</button>
        </div>
      </div>

      <!-- Reset Zoom -->
      <div class="popover-row" style="margin-top:4px;">
        <button id="btnPopoverResetZoom" class="header-btn" style="width:100%; height:38px; justify-content:center; background:rgba(232, 137, 12, 0.2); border-color:var(--primary-accent); color:var(--primary-accent); font-weight:600;">
          रीसेट 1× (Reset Whole-Slide Zoom)
        </button>
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    document.body.appendChild(popover);
    this.activePopover = popover;

    // Events
    const sizeSlider = popover.querySelector('#magSizeSlider') as HTMLInputElement;
    const sizeVal = popover.querySelector('#magSizeVal') as HTMLElement;
    sizeSlider?.addEventListener('input', () => {
      const v = Number(sizeSlider.value);
      sizeVal.textContent = `${v}px`;
      store.updateSettings({ magnifierSize: v });
      this.resetIdleTimer();
    });

    const zoomSlider = popover.querySelector('#magZoomSlider') as HTMLInputElement;
    const zoomVal = popover.querySelector('#magZoomVal') as HTMLElement;
    zoomSlider?.addEventListener('input', () => {
      const v = Number(zoomSlider.value);
      zoomVal.textContent = `${v}×`;
      store.updateSettings({ magnifierZoom: v });
      this.resetIdleTimer();
    });

    // Shape buttons
    const btnShapeCircle = popover.querySelector('#btnShapeCircle') as HTMLElement;
    const btnShapeRect = popover.querySelector('#btnShapeRect') as HTMLElement;
    btnShapeCircle?.addEventListener('click', () => {
      btnShapeCircle.classList.add('active');
      btnShapeRect.classList.remove('active');
      store.updateSettings({ magnifierShape: 'circle' });
      this.resetIdleTimer();
    });
    btnShapeRect?.addEventListener('click', () => {
      btnShapeRect.classList.add('active');
      btnShapeCircle.classList.remove('active');
      store.updateSettings({ magnifierShape: 'rect' });
      this.resetIdleTimer();
    });

    // Mode buttons
    const btnModeFollow = popover.querySelector('#btnModeFollow') as HTMLElement;
    const btnModePin = popover.querySelector('#btnModePin') as HTMLElement;
    btnModeFollow?.addEventListener('click', () => {
      btnModeFollow.classList.add('active');
      btnModePin.classList.remove('active');
      store.updateSettings({ magnifierMode: 'follow' });
      this.resetIdleTimer();
    });
    btnModePin?.addEventListener('click', () => {
      btnModePin.classList.add('active');
      btnModeFollow.classList.remove('active');
      store.updateSettings({ magnifierMode: 'pin' });
      this.resetIdleTimer();
    });

    // Spotlight
    const chkSpotlight = popover.querySelector('#chkSpotlight') as HTMLInputElement;
    chkSpotlight?.addEventListener('change', () => {
      store.updateSettings({ magnifierSpotlight: chkSpotlight.checked });
      this.resetIdleTimer();
    });

    // Touch pos buttons
    const btnTouchAbove = popover.querySelector('#btnTouchAbove') as HTMLElement;
    const btnTouchUnder = popover.querySelector('#btnTouchUnder') as HTMLElement;
    btnTouchAbove?.addEventListener('click', () => {
      btnTouchAbove.classList.add('active');
      btnTouchUnder.classList.remove('active');
      store.updateSettings({ magnifierTouchPos: 'above' });
      this.resetIdleTimer();
    });
    btnTouchUnder?.addEventListener('click', () => {
      btnTouchUnder.classList.add('active');
      btnTouchAbove.classList.remove('active');
      store.updateSettings({ magnifierTouchPos: 'under' });
      this.resetIdleTimer();
    });

    // Reset zoom button
    const btnReset = popover.querySelector('#btnPopoverResetZoom') as HTMLElement;
    btnReset?.addEventListener('click', () => {
      zoomController.resetZoom();
      this.close();
    });

    this.bindOutsideAndIdle(popover, anchorEl);
  }

  private positionPopover(popover: HTMLElement, anchorEl: HTMLElement): void {
    const rect = anchorEl.getBoundingClientRect();
    const anchorCenter = rect.left + rect.width / 2;
    const anchorTop = rect.top;

    if (anchorTop < 320) {
      popover.style.top = `${rect.bottom + 12}px`;
      popover.style.left = `${anchorCenter}px`;
      popover.style.transform = 'translateX(-50%)';
    } else {
      popover.style.bottom = `${window.innerHeight - anchorTop + 12}px`;
      popover.style.left = `${anchorCenter}px`;
      popover.style.transform = 'translateX(-50%)';
    }
  }

  private bindOutsideAndIdle(popover: HTMLElement, anchorEl: HTMLElement): void {
    this.resetIdleTimer();

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!popover.contains(target) && !anchorEl.contains(target)) {
        this.close();
        document.removeEventListener('pointerdown', handleOutside);
      }
    };

    setTimeout(() => {
      document.addEventListener('pointerdown', handleOutside);
    }, 50);
  }

  private resetIdleTimer(): void {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.close();
    }, 5000); // 5s idle per C2 spec
  }

  close(): void {
    window.clearTimeout(this.idleTimer);
    if (this.activePopover) {
      this.activePopover.remove();
      this.activePopover = null;
    }
  }
}

export const zoomPopoverManager = new ZoomPopoverManager();
