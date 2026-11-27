// SSIRO-UPDATE: Magnifier & Zoom Popover
import { store } from '../state/store';
import { zoomController } from './zoomController';
// AUDIT-FIX: BUG-006 - Central gesture watchdog
import { gestureWatchdog } from '../core/gestureWatchdog';

export class ZoomPopoverManager {
  private activePopover: HTMLElement | null = null;
  private idleTimer: number = 0;
  // AUDIT-FIX: BUG-002 - Track outside listener to prevent listener leaks
  private outsideListener: ((e: any) => void) | null = null;

  isOpen(): boolean {
    return this.activePopover !== null;
  }

  private getHost(): HTMLElement {
    return document.getElementById('stage') || document.body;
  }

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
        <span>🔍 Magnifier Settings</span>
      </div>

      <!-- Quick Zoom presets (1.0x to 4x) -->
      <div class="popover-row">
        <label><span>Quick Zoom</span></label>
        <div class="popover-presets" id="magQuickPresets">
          <button type="button" class="popover-preset-btn ${(settings.magnifierZoom || 2.0) === 1.0 ? 'active' : ''}" data-zoom="1.0">1.0× Frame</button>
          <button type="button" class="popover-preset-btn ${(settings.magnifierZoom || 2.0) === 1.2 ? 'active' : ''}" data-zoom="1.2">1.2× Wide</button>
          <button type="button" class="popover-preset-btn ${(settings.magnifierZoom || 2.0) === 1.5 ? 'active' : ''}" data-zoom="1.5">1.5×</button>
          <button type="button" class="popover-preset-btn ${(settings.magnifierZoom || 2.0) === 2.0 ? 'active' : ''}" data-zoom="2.0">2× Clear</button>
          <button type="button" class="popover-preset-btn ${(settings.magnifierZoom || 2.0) === 3.0 ? 'active' : ''}" data-zoom="3.0">3× Deep</button>
        </div>
      </div>

      <!-- Size -->
      <div class="popover-row">
        <label>
          <span>Lens Size</span>
          <span id="magSizeVal">${settings.magnifierSize || 280}px</span>
        </label>
        <input type="range" class="popover-slider" id="magSizeSlider" min="120" max="600" step="10" value="${settings.magnifierSize || 280}" />
      </div>

      <!-- Magnification (Down to 1.0x prevents side text cutoff) -->
      <div class="popover-row">
        <label>
          <span>Zoom</span>
          <span id="magZoomVal">${(settings.magnifierZoom || 2.0).toFixed(1)}×</span>
        </label>
        <input type="range" class="popover-slider" id="magZoomSlider" min="1.0" max="8.0" step="0.1" value="${settings.magnifierZoom || 2.0}" />
      </div>

      <!-- Shape -->
      <div class="popover-row">
        <label>
          <span>Shape</span>
        </label>
        <div style="display:flex; gap:8px;">
          <button id="btnShapeCircle" class="header-btn ${isCircle ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Circle</button>
          <button id="btnShapeRect" class="header-btn ${!isCircle ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Rect</button>
        </div>
      </div>

      <!-- Mode -->
      <div class="popover-row">
        <label>
          <span>Mode</span>
        </label>
        <div style="display:flex; gap:8px;">
          <button id="btnModeFollow" class="header-btn ${!isPinMode ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Follow</button>
          <button id="btnModePin" class="header-btn ${isPinMode ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Pin-on-tap</button>
        </div>
      </div>

      <!-- Spotlight -->
      <div class="popover-row">
        <label>
          <span>Spotlight Dimming</span>
          <input type="checkbox" id="chkSpotlight" ${settings.magnifierSpotlight ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary-accent);" />
        </label>
      </div>

      <!-- Touch Position -->
      <div class="popover-row">
        <label>
          <span>Touch Position</span>
        </label>
        <div style="display:flex; gap:8px;">
          <button id="btnTouchAbove" class="header-btn ${isAbove ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Above Touch</button>
          <button id="btnTouchUnder" class="header-btn ${!isAbove ? 'active' : ''}" style="flex:1; height:36px; font-size:12px;">Under Touch</button>
        </div>
      </div>

      <!-- Reset Zoom -->
      <div class="popover-row" style="margin-top:4px;">
        <button id="btnPopoverResetZoom" class="header-btn" style="width:100%; height:38px; justify-content:center; background:rgba(232, 137, 12, 0.2); border-color:var(--primary-accent); color:var(--primary-accent); font-weight:600;">
          Reset Whole-Slide Zoom (1×)
        </button>
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    this.getHost().appendChild(popover);
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
    const updateZoom = (v: number) => {
      zoomVal.textContent = `${v}×`;
      store.updateSettings({ magnifierZoom: v });
      this.resetIdleTimer();
    };

    zoomSlider?.addEventListener('input', () => {
      const v = Number(zoomSlider.value);
      popover.querySelectorAll('#magQuickPresets .popover-preset-btn').forEach(b => b.classList.remove('active'));
      updateZoom(v);
    });

    popover.querySelectorAll('#magQuickPresets .popover-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const z = Number(btn.getAttribute('data-zoom'));
        if (zoomSlider) zoomSlider.value = String(z);
        popover.querySelectorAll('#magQuickPresets .popover-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateZoom(z);
      });
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

    // AUDIT-FIX: BUG-003 - Clamp popover horizontally so it stays inside viewport
    const estimatedHalfWidth = 150; // 300px / 2
    const minCenter = estimatedHalfWidth + 8;
    const maxCenter = Math.max(minCenter, window.innerWidth - estimatedHalfWidth - 8);
    const clampedCenter = Math.max(minCenter, Math.min(anchorCenter, maxCenter));

    if (anchorTop < 320) {
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
    gestureWatchdog.registerGesture('zoom-popover', () => this.close());
  }

  private resetIdleTimer(): void {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.close();
    }, 5000); // 5s idle per C2 spec
  }

  close(): void {
    window.clearTimeout(this.idleTimer);
    // AUDIT-FIX: BUG-002 - Remove outside listener cleanly on any close
    if (this.outsideListener) {
      document.removeEventListener('pointerdown', this.outsideListener);
      this.outsideListener = null;
    }
    // AUDIT-FIX: BUG-006 - Unregister gesture
    gestureWatchdog.unregisterGesture('zoom-popover');

    if (this.activePopover) {
      this.activePopover.remove();
      this.activePopover = null;
    }
  }
}

export const zoomPopoverManager = new ZoomPopoverManager();
