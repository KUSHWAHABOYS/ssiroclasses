import { ActiveTool, BoardThemeId, ShapeType, store } from '../state/store';
import { annotationStore } from '../draw/annotationStore';
import { popoverManager } from './popovers';
import { fullscreenService } from '../core/fullscreen';
// SSIRO-UPDATE: Magnifier Popover
import { zoomPopoverManager } from '../zoom/zoomPopover';
// MIC-AI: Import micController
import { micController, MicState } from '../voice/micController';

export class Toolbar {
  private containerEl!: HTMLElement;
  private tier1El!: HTMLElement;
  private tier2El!: HTMLElement;
  private dragHandleEl!: HTMLElement;
  private resizeHandleEl!: HTMLElement;
  private btnTierToggleEl!: HTMLButtonElement;

  private idleDimTimer: number = 0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialToolbarLeft = 0;
  private initialToolbarTop = 0;
  private preExpandLeft: number | null = null;

  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private initialScale = 1.0;
  private unscaledWidth = 0;
  private toolbarScale = 1.0;

  private swatches = [
    '#f59e0b', // Decoding Indology saffron / gold
    '#ffffff', // Pure white
    '#38bdf8', // Sky cyan
    '#10b981', // Emerald green
    '#ef4444', // Ruby red
    '#a855f7'  // Royal purple
  ];

  init(): void {
    this.containerEl = document.getElementById('toolbarContainer') as HTMLElement;
    this.renderToolbar();
    this.bindDragging();
    this.bindResizing();
    this.bindGhostMode();
    this.bindEvents();
    this.bindStore();
    this.restorePositionAndScale();
  }

  private renderToolbar(): void {
    this.containerEl.innerHTML = `
      <div class="toolbar-content" id="toolbarContent">
        <!-- Tier 1: Main Drawing & Swatches -->
        <div class="toolbar-tier toolbar-tier-1" id="toolbarTier1">
          <div class="drag-handle" id="dragHandle" title="Drag Toolbar (360°)">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
          </div>

          <button class="tool-btn active" id="btnToolSelect" data-tool="select" title="Select / Move Media & Shapes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 3 7 18 3-7 7-3L3 3z"/></svg>
            <span class="btn-label">Select</span>
          </button>

          <button class="tool-btn" id="btnToolPen" data-tool="pen" title="Pen (Tap again for size & opacity)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            <span class="btn-label">Pen</span>
          </button>

          <button class="tool-btn" id="btnToolHighlighter" data-tool="highlighter" title="Highlighter (Translucent marker)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
            <span class="btn-label">Marker</span>
          </button>

          <button class="tool-btn" id="btnToolEraser" data-tool="eraser" title="Eraser (Pixel / Stroke)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
            <span class="btn-label">Eraser</span>
          </button>

          <!-- SSIRO-UPDATE: Magnifier Button in Tier 1 next to Eraser -->
          <button class="tool-btn" id="btnToolMagnifier" data-tool="magnifier" title="Magnifier Lens (🔍 Tap again for settings)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span class="btn-label">Lens</span>
          </button>

          <div class="swatch-group" id="swatchGroup">
            ${this.swatches
              .map(
                (c, i) =>
                  `<div class="color-swatch ${i === 0 ? 'active' : ''}" style="background-color: ${c};" data-color="${c}"></div>`
              )
              .join('')}
          </div>

          <button class="tool-btn" id="btnUndo" title="Undo (Ctrl+Z)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            <span class="btn-label">Undo</span>
          </button>

          <button class="tool-btn" id="btnClearAll" title="Clear All Ink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            <span class="btn-label">Clear</span>
          </button>

          <!-- MIC-AI: 🎙 Mic Button in Tier 1 -->
          <button class="tool-btn mic-btn mic-off" id="btnToolMic" title="माइक चालू / बंद (Mic ON/OFF • V • दबाकर रखें मेनू के लिए)">
            <div class="mic-icon-wrapper">
              <svg class="mic-icon-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <svg class="mic-icon-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <span class="mic-error-badge">!</span>
            </div>
            <div class="mic-level-meter" id="micLevelMeter">
              <span class="mic-bar bar-1"></span>
              <span class="mic-bar bar-2"></span>
              <span class="mic-bar bar-3"></span>
            </div>
            <span class="btn-label">माइक / Mic</span>
          </button>

          <!-- More / Less Button -->
          <button class="tool-btn" id="btnTierToggle" title="More Tools (+)">
            <svg id="tierToggleIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
            <span class="btn-label" id="tierToggleLabel">More</span>
          </button>
        </div>

        <!-- Inline Tier 2: Shapes, Arrow, Zoom, Aa, Media, Browser, AI, Board, Settings, Zen -->
        <div class="toolbar-tier toolbar-tier-2 toolbar-extra-tools collapsed" id="toolbarTier2">
          <!-- Shape: Box / Rect -->
          <button class="tool-btn" id="btnToolRect" data-tool="shape" data-shape="rect" title="Rectangle / Box (चौकोर)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            <span class="btn-label">Shape</span>
          </button>

          <!-- Shape: Circle / Ellipse -->
          <button class="tool-btn" id="btnToolCircle" data-tool="shape" data-shape="circle" title="Circle (गोला/अंडाकार)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
            <span class="btn-label">Circle</span>
          </button>

          <!-- Shape: Triangle -->
          <button class="tool-btn" id="btnToolTriangle" data-tool="shape" data-shape="triangle" title="Triangle (त्रिभुज)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 3 21 20 3 20"/></svg>
            <span class="btn-label">Triangle</span>
          </button>

          <!-- Shape: Straight Line -->
          <button class="tool-btn" id="btnToolLine" data-tool="shape" data-shape="line" title="Straight Line (सीधी रेखा)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/></svg>
            <span class="btn-label">Line</span>
          </button>

          <!-- Shape: Arrow -->
          <button class="tool-btn" id="btnToolArrow" data-tool="arrow" title="Smart Arrow (तीर)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            <span class="btn-label">Arrow</span>
          </button>

          <!-- Whole-slide Zoom button -->
          <button class="tool-btn" id="btnToolZoom" data-tool="zoom" title="Whole-Slide Zoom & Pan (Z)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <span class="btn-label">Zoom</span>
          </button>

          <!-- Handwriting ✍ ➔ Aa button -->
          <button class="tool-btn" id="btnToolHandwriting" title="✍ ➔ Aa Handwriting-to-Text">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 2 4 4-12 12H6v-4L18 2z"/><path d="M14 6l4 4"/><path d="M4 22h16"/></svg>
            <span class="btn-label">✍ ➔ Aa</span>
          </button>

          <!-- Media button -->
          <button class="tool-btn" id="btnMediaOverlay" title="Add Video / Image Window">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            <span class="btn-label">Media</span>
          </button>

          <!-- Browser button -->
          <button class="tool-btn" id="btnBrowserOverlay" title="In-App Browser">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span class="btn-label">Browser</span>
          </button>

          <!-- Gemini button -->
          <button class="tool-btn" id="btnGemini" title="Gemini AI Teaching Assistant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>
            <span class="btn-label">Gemini</span>
          </button>

          <!-- Board button -->
          <button class="tool-btn" id="btnBoard" title="Universal Blackboard Studio (B)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span class="btn-label">Board</span>
          </button>

          <!-- Settings button -->
          <button class="tool-btn" id="btnSettings" title="Studio Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span class="btn-label">Settings</span>
          </button>

          <!-- Fullscreen Zen button -->
          <button class="tool-btn" id="btnFullscreen" title="Fullscreen Zen Mode (F)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            <span class="btn-label">Zen</span>
          </button>
        </div>
      </div>

      <!-- Resize Handle (Corner grip, >= 44px touch target) -->
      <div class="toolbar-resize-handle" id="toolbarResizeHandle" title="Resize Toolbar (खींचकर आकार बदलें)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="20" y1="8" x2="8" y2="20"/>
          <line x1="20" y1="13" x2="13" y2="20"/>
          <line x1="20" y1="18" x2="18" y2="20"/>
        </svg>
      </div>
    `;

    this.tier1El = document.getElementById('toolbarTier1')!;
    this.tier2El = document.getElementById('toolbarTier2')!;
    this.dragHandleEl = document.getElementById('dragHandle')!;
    this.resizeHandleEl = document.getElementById('toolbarResizeHandle')!;
    this.btnTierToggleEl = document.getElementById('btnTierToggle') as HTMLButtonElement;
  }

  private bindDragging(): void {
    const handle = this.dragHandleEl;

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      this.isDragging = true;
      handle.setPointerCapture(e.pointerId);
      this.containerEl.classList.add('is-dragging');
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const rect = this.containerEl.getBoundingClientRect();
      this.initialToolbarLeft = rect.left;
      this.initialToolbarTop = rect.top;

      this.wakeFromGhost();
    });

    handle.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      let newLeft = this.initialToolbarLeft + dx;
      let newTop = this.initialToolbarTop + dy;

      // Clamp to viewport so toolbar is never dragged off-screen
      const rect = this.containerEl.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width - 8;
      const maxTop = window.innerHeight - rect.height - 8;

      newLeft = Math.max(8, Math.min(newLeft, maxLeft));
      newTop = Math.max(8, Math.min(newTop, maxTop));

      this.containerEl.style.left = `${newLeft}px`;
      this.containerEl.style.top = `${newTop}px`;
      this.containerEl.style.transform = 'scale(var(--toolbar-scale, 1))';
      this.preExpandLeft = newLeft;
    });

    handle.addEventListener('pointerup', (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.containerEl.classList.remove('is-dragging');
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {}

      // Persist position
      const rect = this.containerEl.getBoundingClientRect();
      store.updateSettings({
        toolbarPos: { x: Math.round(rect.left), y: Math.round(rect.top) }
      });
    });
  }

  private bindResizing(): void {
    const handle = this.resizeHandleEl;
    if (!handle) return;

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
      this.isResizing = true;
      handle.setPointerCapture(e.pointerId);
      this.containerEl.classList.add('is-dragging');
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;
      this.initialScale = this.toolbarScale;

      const rect = this.containerEl.getBoundingClientRect();
      this.unscaledWidth = rect.width / this.toolbarScale;

      this.wakeFromGhost();
    });

    handle.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isResizing) return;

      const dx = e.clientX - this.resizeStartX;
      const dy = e.clientY - this.resizeStartY;
      const delta = (dx + dy) / 2;

      const currentWidth = this.unscaledWidth * this.initialScale;
      const targetWidth = currentWidth + delta;
      const newScale = targetWidth / this.unscaledWidth;

      this.applyScale(newScale, false);
    });

    handle.addEventListener('pointerup', (e: PointerEvent) => {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.containerEl.classList.remove('is-dragging');
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {}

      this.applyScale(this.toolbarScale, true);
      this.clampToViewport();
    });
  }

  private applyScale(scale: number, saveToStore = false): void {
    const clamped = Math.max(0.60, Math.min(1.60, Math.round(scale * 100) / 100));
    this.toolbarScale = clamped;
    this.containerEl.style.setProperty('--toolbar-scale', String(clamped));
    this.containerEl.style.transform = 'scale(var(--toolbar-scale, 1))';
    this.containerEl.style.transformOrigin = 'top left';

    if (saveToStore) {
      store.updateSettings({ toolbarScale: clamped });
    }
  }

  private clampToViewport(): void {
    const rect = this.containerEl.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    let curLeft = rect.left;
    let curTop = rect.top;

    curLeft = Math.max(8, Math.min(curLeft, maxLeft));
    curTop = Math.max(8, Math.min(curTop, maxTop));

    this.containerEl.style.left = `${curLeft}px`;
    this.containerEl.style.top = `${curTop}px`;
    this.preExpandLeft = curLeft;
    store.updateSettings({
      toolbarPos: { x: Math.round(curLeft), y: Math.round(curTop) }
    });
  }

  private restorePositionAndScale(): void {
    const s = store.getState().settings;
    this.applyScale(s.toolbarScale || 1.0, false);

    const pos = s.toolbarPos;
    if (pos) {
      const maxLeft = window.innerWidth - 300;
      const maxTop = window.innerHeight - 80;
      const x = Math.max(8, Math.min(pos.x, maxLeft));
      const y = Math.max(8, Math.min(pos.y, maxTop));

      this.containerEl.style.left = `${x}px`;
      this.containerEl.style.top = `${y}px`;
      this.containerEl.style.transform = 'scale(var(--toolbar-scale, 1))';
      this.preExpandLeft = x;
    }
  }

  private bindGhostMode(): void {
    const resetTimer = () => {
      this.wakeFromGhost();
      window.clearTimeout(this.idleDimTimer);
      const idleSec = store.getState().settings.toolbarIdleSeconds || 4;
      this.idleDimTimer = window.setTimeout(() => {
        this.containerEl.classList.add('dimmed');
      }, idleSec * 1000);
    };

    // Any interaction with container or window pointer movement
    this.containerEl.addEventListener('pointerdown', resetTimer, { passive: true });
    this.containerEl.addEventListener('pointermove', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });

    resetTimer();
  }

  private wakeFromGhost(): void {
    this.containerEl.classList.remove('dimmed');
  }

  private toggleTier2(): void {
    const isExpanded = !store.getState().isTier2Expanded;
    this.syncTier2State(isExpanded);
    store.setState({ isTier2Expanded: isExpanded });
  }

  private syncTier2State(expanded: boolean): void {
    const iconEl = document.getElementById('tierToggleIcon');
    const labelEl = document.getElementById('tierToggleLabel');

    if (expanded) {
      const rect = this.containerEl.getBoundingClientRect();
      this.preExpandLeft = rect.left;

      this.tier2El.classList.remove('collapsed');
      this.btnTierToggleEl.classList.add('active');

      if (labelEl) labelEl.textContent = 'Less';
      if (iconEl) {
        iconEl.innerHTML = '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>';
      }
      this.btnTierToggleEl.title = 'Fewer Tools (−)';

      // Check right overflow and smoothly shift left if needed
      requestAnimationFrame(() => {
        const expandedRect = this.containerEl.getBoundingClientRect();
        if (expandedRect.right > window.innerWidth - 16) {
          const shift = expandedRect.right - (window.innerWidth - 16);
          const newLeft = Math.max(16, expandedRect.left - shift);
          this.containerEl.style.left = `${newLeft}px`;
        }
      });
    } else {
      this.tier2El.classList.add('collapsed');
      this.btnTierToggleEl.classList.remove('active');

      if (labelEl) labelEl.textContent = 'More';
      if (iconEl) {
        iconEl.innerHTML = '<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>';
      }
      this.btnTierToggleEl.title = 'More Tools (+)';

      // Restore left position if shifted
      if (this.preExpandLeft !== null) {
        const collapsedRect = this.containerEl.getBoundingClientRect();
        const maxLeft = window.innerWidth - collapsedRect.width - 16;
        const targetLeft = Math.max(8, Math.min(this.preExpandLeft, maxLeft));
        this.containerEl.style.left = `${targetLeft}px`;
      }
    }
  }

  private bindEvents(): void {
    // Tool buttons (including individual shapes)
    const toolBtns = this.containerEl.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tool = btn.getAttribute('data-tool') as ActiveTool;
        const shape = btn.getAttribute('data-shape') as ShapeType | null;
        const currentTool = store.getState().activeTool;
        const currentShape = store.getState().activeShape;

        if (tool === 'shape' && shape) {
          popoverManager.close();
          zoomPopoverManager.close();
          store.setState({ activeTool: 'shape', activeShape: shape });
          return;
        }

        if (tool === currentTool) {
          // Centered in-place popover for Pen, Highlighter, Eraser, Magnifier per spec
          if (tool === 'pen') {
            popoverManager.showPenPopover(btn);
          } else if (tool === 'highlighter') {
            popoverManager.showHighlighterPopover(btn);
          } else if (tool === 'eraser') {
            popoverManager.showEraserPopover(btn);
          } else if (tool === 'magnifier') {
            // SSIRO-UPDATE: Open Magnifier Settings Popover directly above button
            zoomPopoverManager.showMagnifierPopover(btn);
          }
        } else {
          popoverManager.close();
          zoomPopoverManager.close();
          store.setState({ activeTool: tool });
        }
      });
    });

    // Swatches
    const swatchEls = this.containerEl.querySelectorAll<HTMLElement>('.color-swatch');
    swatchEls.forEach((sw) => {
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = sw.getAttribute('data-color')!;
        swatchEls.forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        store.setState({ activeColor: color });
      });
    });

    // Undo & Clear All
    document.getElementById('btnUndo')?.addEventListener('click', () => {
      annotationStore.undo();
    });

    document.getElementById('btnClearAll')?.addEventListener('click', () => {
      annotationStore.clearAll();
    });

    // MIC-AI: Wire Mic button and top-bar mirror button
    const btnMic = document.getElementById('btnToolMic');
    const btnMicHeader = document.getElementById('btnMicHeader');
    const micZenDot = document.getElementById('micZenDot');
    let pressTimer: number | null = null;
    let didLongPress = false;

    const handleMicPointerDown = (e: PointerEvent) => {
      const s = store.getState().settings;
      didLongPress = false;

      if (s.pushToTalk) {
        micController.handlePushToTalkDown();
      } else {
        pressTimer = window.setTimeout(() => {
          didLongPress = true;
          if (btnMic) popoverManager.showMicPopover(btnMic);
        }, 500);
      }
    };

    const handleMicPointerUp = (e: PointerEvent) => {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      const s = store.getState().settings;
      if (s.pushToTalk) {
        micController.handlePushToTalkUp();
      } else if (!didLongPress) {
        micController.toggle();
      }
    };

    btnMic?.addEventListener('pointerdown', handleMicPointerDown);
    btnMic?.addEventListener('pointerup', handleMicPointerUp);
    btnMic?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (btnMic) popoverManager.showMicPopover(btnMic);
    });

    btnMicHeader?.addEventListener('click', () => {
      micController.toggle();
    });

    // Sync UI with Mic state
    const syncMicUI = (state: MicState) => {
      const isListening = state === 'listening';

      // Toolbar button
      if (btnMic) {
        btnMic.classList.remove('mic-off', 'mic-listening', 'mic-error');
        btnMic.classList.add(`mic-${state}`);

        const iconOff = btnMic.querySelector('.mic-icon-off') as HTMLElement;
        const iconOn = btnMic.querySelector('.mic-icon-on') as HTMLElement;
        if (iconOff) iconOff.style.display = isListening ? 'none' : 'block';
        if (iconOn) iconOn.style.display = isListening ? 'block' : 'none';
      }

      // Top bar mirror button
      if (btnMicHeader) {
        btnMicHeader.classList.remove('mic-off', 'mic-listening', 'mic-error');
        btnMicHeader.classList.add(`mic-${state}`);

        const hIconOff = btnMicHeader.querySelector('.mic-icon-off') as HTMLElement;
        const hIconOn = btnMicHeader.querySelector('.mic-icon-on') as HTMLElement;
        if (hIconOff) hIconOff.style.display = isListening ? 'none' : 'block';
        if (hIconOn) hIconOn.style.display = isListening ? 'block' : 'none';
      }

      // Zen red indicator dot
      if (micZenDot) {
        const showInZen = store.getState().settings.showMicDotInZen !== false;
        if (isListening && showInZen) {
          micZenDot.classList.remove('hidden');
        } else {
          micZenDot.classList.add('hidden');
        }
      }
    };

    micController.onStateChange(syncMicUI);

    // Sync live input level bars
    micController.onLevelChange((level) => {
      if (btnMic) {
        btnMic.setAttribute('data-level', String(level));
      }
    });

    syncMicUI(micController.getState());

    // Tier 2 toggle (More / Less)
    this.btnTierToggleEl?.addEventListener('click', () => {
      this.toggleTier2();
    });

    // Handwriting ✍ ➔ Aa toggle
    const btnHw = document.getElementById('btnToolHandwriting');
    if (btnHw) {
      btnHw.classList.toggle('active', store.getState().isHandwritingEnabled); // INKFIX: initialize state
    }
    btnHw?.addEventListener('click', (e) => {
      const active = !store.getState().isHandwritingEnabled;
      store.setState({ isHandwritingEnabled: active });
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active', active);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message: active
              ? 'हस्तलेखन रूपांतरण सक्रिय (Handwriting-to-Text ON)'
              : 'हस्तलेखन रूपांतरण निष्क्रिय (OFF)'
          }
        })
      );
    });

    // Media overlay button
    document.getElementById('btnMediaOverlay')?.addEventListener('click', () => {
      const fileInput = document.getElementById('fileInputMedia') as HTMLInputElement;
      fileInput.click();
    });

    // Browser overlay button
    document.getElementById('btnBrowserOverlay')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('toggle-web-overlay'));
    });

    // Gemini AI button
    document.getElementById('btnGemini')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('toggle-gemini'));
    });

    // Board button
    document.getElementById('btnBoard')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('toggle-board'));
    });

    // Settings button
    document.getElementById('btnSettings')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('toggle-settings'));
    });

    // Fullscreen button
    document.getElementById('btnFullscreen')?.addEventListener('click', () => {
      fullscreenService.toggleZen();
    });
  }

  private bindStore(): void {
    store.subscribe((state, prev) => {
      // Active tool and shape update
      if (state.activeTool !== prev.activeTool || state.activeShape !== prev.activeShape) {
        const toolBtns = this.containerEl.querySelectorAll<HTMLButtonElement>('[data-tool]');
        toolBtns.forEach((btn) => {
          const t = btn.getAttribute('data-tool');
          const sh = btn.getAttribute('data-shape');
          if (t === 'shape') {
            btn.classList.toggle('active', state.activeTool === 'shape' && state.activeShape === sh);
          } else {
            btn.classList.toggle('active', t === state.activeTool);
          }
        });
      }

      // Tier 2 collapse / expand
      if (state.isTier2Expanded !== prev.isTier2Expanded) {
        this.syncTier2State(state.isTier2Expanded);
      }

      // Toolbar scale update
      if (state.settings.toolbarScale !== prev.settings.toolbarScale) {
        this.applyScale(state.settings.toolbarScale || 1.0, false);
      }

      // Zen mode toolbar visibility
      if (state.isZen !== prev.isZen || state.isToolbarVisibleInZen !== prev.isToolbarVisibleInZen) {
        if (state.isZen && !state.isToolbarVisibleInZen) {
          this.containerEl.classList.add('zen-hidden');
        } else {
          this.containerEl.classList.remove('zen-hidden');
        }
      }

      // Board mode: hide floating toolbar because bottom dock is used
      if (state.isBoardMode !== prev.isBoardMode) {
        if (state.isBoardMode) {
          this.containerEl.classList.add('hidden');
        } else {
          this.containerEl.classList.remove('hidden');
        }
      }
    });
  }
}

export const toolbar = new Toolbar();
