import { ActiveTool, BoardThemeId, ShapeType, store } from '../state/store';
import { annotationStore } from '../draw/annotationStore';
import { popoverManager } from './popovers';
import { fullscreenService } from '../core/fullscreen';
// SSIRO-UPDATE: Magnifier Popover
import { zoomPopoverManager } from '../zoom/zoomPopover';
// MIC-AI: Import micController
import { micController, MicState } from '../voice/micController';
// AUDIT-FIX: BUG-006 - Central gesture watchdog integration
import { gestureWatchdog } from '../core/gestureWatchdog';

export class Toolbar {
  private containerEl!: HTMLElement;
  private contentEl!: HTMLElement;
  private tier1El!: HTMLElement;
  private tier2El!: HTMLElement;
  private dragHandleEl!: HTMLElement;
  private resizeHandleEl!: HTMLElement;
  private scaleBadgeEl: HTMLElement | null = null;
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

    // Ensure initial tool in UI matches store (Pen active by default)
    const initialTool = store.getState().activeTool || 'pen';
    const toolBtns = this.contentEl?.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolBtns?.forEach((btn) => {
      const t = btn.getAttribute('data-tool');
      btn.classList.toggle('active', t === initialTool);
    });

    // Prevent touch/swipe gestures on toolbar from bubbling to stage (so PPT slides don't change on toolbar swipe)
    this.containerEl.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    this.containerEl.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
    this.containerEl.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });

    // AUDIT-FIX: BUG-012 - Clamp toolbar on resize and orientationchange (TB-4, ZEN-4)
    window.addEventListener('resize', () => this.clampToViewport(), { passive: true });
    window.addEventListener('orientationchange', () => this.clampToViewport(), { passive: true });
  }

  private renderToolbar(): void {
    this.containerEl.innerHTML = `
      <div class="toolbar-content" id="toolbarContent">
        <!-- Tier 1: Main Drawing & Swatches -->
        <div class="toolbar-tier toolbar-tier-1" id="toolbarTier1">
          <div class="drag-handle" id="dragHandle" title="Drag Toolbar (360°)">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
          </div>

          <!-- AUTO-CORRECTION: Dedicated Auto-Straighten Toggle near Select & Pen -->
          <button class="tool-btn toggle-btn" id="btnToolAutoStraighten" title="Auto-Straighten [OFF]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 4l6 6L9 21H3v-6L14 4z"/>
              <line x1="2" y1="22" x2="22" y2="22" stroke-width="2.5"/>
              <path d="m6 15 3 3"/>
            </svg>
            <span class="btn-label">Auto</span>
          </button>

          <button class="tool-btn" id="btnToolSelect" data-tool="select" title="Select / Move Media & Shapes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 3 7 18 3-7 7-3L3 3z"/></svg>
            <span class="btn-label">Select</span>
          </button>

          <button class="tool-btn active" id="btnToolPen" data-tool="pen" data-has-sub="true" title="पेन (Pen • टैप या दबाकर रखें सेटिंग्स हेतु)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            <span class="btn-label">Pen <span class="tool-sub-indicator">▾</span></span>
          </button>

          <button class="tool-btn" id="btnToolHighlighter" data-tool="highlighter" data-has-sub="true" title="हाइलाइटर (Highlighter • टैप या दबाकर रखें सेटिंग्स हेतु)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
            <span class="btn-label">Marker <span class="tool-sub-indicator">▾</span></span>
          </button>

          <button class="tool-btn" id="btnToolEraser" data-tool="eraser" data-has-sub="true" title="इरेज़र (Eraser • टैप या दबाकर रखें सेटिंग्स हेतु)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
            <span class="btn-label">Eraser <span class="tool-sub-indicator">▾</span></span>
          </button>

          <!-- SSIRO-UPDATE: Magnifier Button in Tier 1 next to Eraser -->
          <button class="tool-btn" id="btnToolMagnifier" data-tool="magnifier" data-has-sub="true" title="मैग्नीफ़ायर लेंस (Magnifier Lens • टैप या दबाकर रखें सेटिंग्स हेतु)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span class="btn-label">Lens <span class="tool-sub-indicator">▾</span></span>
          </button>

          <!-- AI TRANSLATE LENS: Live Area Translation Tool -->
          <button class="tool-btn tool-ai-translate" id="btnToolTranslate" data-tool="translate" title="AI लाइव अनुवाद लेंस (English/Sanskrit/Pali ➔ Hindi)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span class="btn-label">AI अनुवाद</span>
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

          <!-- MIC-AI: Sleek Uniform Mic Button in Tier 1 -->
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
            </div>
            <span class="btn-label">Mic</span>
          </button>

          <!-- Slide Fit / Full View Quick Toggle (Single intuitive toggle in Tier 1) -->
          <button class="tool-btn" id="btnToolFitModeTier1" title="फुल स्क्रीन / फिट 16:9 दृश्य (Full Screen • L)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
            <span class="btn-label" id="btnToolFitModeTier1Label">फुल स्क्रीन</span>
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

          <!-- Deck / Open File button -->
          <button class="tool-btn" id="btnToolOpenDeck" title="Open PDF/PPT Deck (O)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span class="btn-label">Deck</span>
          </button>

          <!-- Settings button -->
          <button class="tool-btn" id="btnSettings" title="Studio Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span class="btn-label">Settings</span>
          </button>
        </div>
      </div>

      <!-- Scale feedback badge -->
      <div class="toolbar-scale-badge" id="toolbarScaleBadge">100%</div>

      <!-- Resize Handle (Corner grip, >= 44px touch target) -->
      <div class="toolbar-resize-handle" id="toolbarResizeHandle" title="टूलबार का आकार बदलें (Resize Toolbar • खींचकर छोटा-बड़ा करें • डबल-टैप से 100%)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="20" y1="6" x2="6" y2="20"/>
          <line x1="20" y1="12" x2="12" y2="20"/>
          <line x1="20" y1="18" x2="18" y2="20"/>
        </svg>
      </div>
    `;

    this.contentEl = document.getElementById('toolbarContent')!;
    this.tier1El = document.getElementById('toolbarTier1')!;
    this.tier2El = document.getElementById('toolbarTier2')!;
    this.dragHandleEl = document.getElementById('dragHandle')!;
    this.resizeHandleEl = document.getElementById('toolbarResizeHandle')!;
    this.scaleBadgeEl = document.getElementById('toolbarScaleBadge');
    this.btnTierToggleEl = document.getElementById('btnTierToggle') as HTMLButtonElement;
  }

  private bindDragging(): void {
    let pendingDrag = false;
    let pendingPointerId: number | null = null;
    let dragThresholdMet = false;

    const stopDrag = (e?: PointerEvent) => {
      if (!this.isDragging && !pendingDrag) return;

      const wasDragging = this.isDragging || dragThresholdMet;
      this.isDragging = false;
      pendingDrag = false;
      dragThresholdMet = false;
      this.containerEl.classList.remove('is-dragging');
      gestureWatchdog.unregisterGesture('toolbar-drag');

      if (pendingPointerId !== null) {
        try {
          this.containerEl.releasePointerCapture(pendingPointerId);
        } catch {}
      }
      pendingPointerId = null;

      if (wasDragging) {
        // Suppress any click event from firing on buttons underneath
        const suppressClick = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        window.addEventListener('click', suppressClick, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', suppressClick, { capture: true }), 150);

        // Persist position
        const rect = this.containerEl.getBoundingClientRect();
        store.updateSettings({
          toolbarPos: { x: Math.round(rect.left), y: Math.round(rect.top) }
        });
      }
    };

    this.containerEl.addEventListener('pointerdown', (e: PointerEvent) => {
      // Don't drag if interacting with the resize handle
      const target = e.target as HTMLElement;
      if (target.closest('#toolbarResizeHandle, .toolbar-resize-handle')) {
        return;
      }

      // Check if clicked an interactive element (button, color swatch, input, etc.)
      const isInteractive = !!target.closest('.tool-btn, .color-swatch, button, input, select');

      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      pendingPointerId = e.pointerId;

      const rect = this.containerEl.getBoundingClientRect();
      this.initialToolbarLeft = rect.left;
      this.initialToolbarTop = rect.top;

      this.wakeFromGhost();

      if (!isInteractive) {
        // Empty space, toolbar background, or drag handles: start dragging immediately!
        this.isDragging = true;
        dragThresholdMet = true;
        this.containerEl.classList.add('is-dragging');
        try {
          this.containerEl.setPointerCapture(e.pointerId);
        } catch {}
        gestureWatchdog.registerGesture('toolbar-drag', () => stopDrag(), e.pointerId);
      } else {
        // On a button or swatch: wait for slight movement (> 5px) to distinguish tap from drag
        pendingDrag = true;
        dragThresholdMet = false;
      }
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDragging && !pendingDrag) return;
      if (pendingPointerId !== null && e.pointerId !== pendingPointerId) return;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (pendingDrag && !this.isDragging) {
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          this.isDragging = true;
          dragThresholdMet = true;
          pendingDrag = false;
          this.containerEl.classList.add('is-dragging');
          try {
            this.containerEl.setPointerCapture(e.pointerId);
          } catch {}
          gestureWatchdog.registerGesture('toolbar-drag', () => stopDrag(), e.pointerId);
        }
      }

      if (this.isDragging) {
        gestureWatchdog.recordActivity('toolbar-drag');

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
      }
    });

    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    this.containerEl.addEventListener('lostpointercapture', () => stopDrag());
  }

  private bindResizing(): void {
    const handle = this.resizeHandleEl;
    if (!handle) return;

    let resizePointerId: number | null = null;
    let startX = 0;
    let initialScale = 1.0;
    let unscaledWidth = 0;
    let originLeft = 0;

    const stopResize = (e?: PointerEvent) => {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.containerEl.classList.remove('is-dragging');
      this.containerEl.classList.remove('is-resizing');
      gestureWatchdog.unregisterGesture('toolbar-resize');
      if (resizePointerId !== null) {
        try {
          handle.releasePointerCapture(resizePointerId);
        } catch {}
      }
      resizePointerId = null;

      this.applyScale(this.toolbarScale, true);
      this.clampToViewport();
    };

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      this.isResizing = true;
      resizePointerId = e.pointerId;
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {}

      this.containerEl.classList.add('is-dragging');
      this.containerEl.classList.add('is-resizing');
      startX = e.clientX;
      initialScale = this.toolbarScale || 1.0;

      const rect = this.containerEl.getBoundingClientRect();
      originLeft = rect.left;
      unscaledWidth = rect.width / initialScale;

      gestureWatchdog.registerGesture('toolbar-resize', () => stopResize(), e.pointerId);
      this.wakeFromGhost();
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isResizing) return;
      gestureWatchdog.recordActivity('toolbar-resize');

      const dx = e.clientX - startX;
      const targetRenderedWidth = (unscaledWidth * initialScale) + dx;
      const newScale = targetRenderedWidth / Math.max(100, unscaledWidth);

      // Clamp scale between 0.55 and 2.00
      const clampedScale = Math.max(0.55, Math.min(2.0, Math.round(newScale * 100) / 100));
      this.applyScale(clampedScale, false);

      // If enlarged beyond viewport right boundary, shift left so it stays on screen
      const currentRenderedWidth = unscaledWidth * clampedScale;
      const maxLeft = window.innerWidth - currentRenderedWidth - 8;
      const curLeft = parseFloat(this.containerEl.style.left) || originLeft;
      if (curLeft > maxLeft && maxLeft > 8) {
        this.containerEl.style.left = `${maxLeft}px`;
      }
    });

    window.addEventListener('pointerup', (e: PointerEvent) => {
      if (this.isResizing) stopResize(e);
    });
    window.addEventListener('pointercancel', (e: PointerEvent) => {
      if (this.isResizing) stopResize(e);
    });
    handle.addEventListener('lostpointercapture', () => stopResize());

    // Double-click/double-tap to reset to 100% (1.0)
    handle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.applyScale(1.0, true);
      this.clampToViewport();
    });

    // Touch pinch-to-scale for 2-finger multi-touch boards
    let initialPinchDist = 0;
    let initialPinchScale = 1.0;
    let isPinching = false;

    this.containerEl.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true;
        initialPinchScale = this.toolbarScale || 1.0;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.containerEl.classList.add('is-resizing');
      }
    }, { passive: true });

    this.containerEl.addEventListener('touchmove', (e: TouchEvent) => {
      if (isPinching && e.touches.length === 2) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (initialPinchDist > 10) {
          const factor = currentDist / initialPinchDist;
          const newScale = Math.max(0.55, Math.min(2.0, Math.round(initialPinchScale * factor * 100) / 100));
          this.applyScale(newScale, false);
        }
      }
    }, { passive: true });

    const endPinch = () => {
      if (isPinching) {
        isPinching = false;
        this.containerEl.classList.remove('is-resizing');
        this.applyScale(this.toolbarScale, true);
        this.clampToViewport();
      }
    };

    this.containerEl.addEventListener('touchend', endPinch, { passive: true });
    this.containerEl.addEventListener('touchcancel', endPinch, { passive: true });
  }

  public applyScale(scale: number, saveToStore = false): void {
    const clamped = Math.max(0.55, Math.min(2.0, Math.round(scale * 100) / 100));
    this.toolbarScale = clamped;
    this.containerEl.style.setProperty('--toolbar-scale', String(clamped));
    this.containerEl.style.transform = 'scale(var(--toolbar-scale, 1))';
    this.containerEl.style.transformOrigin = 'top left';

    if (this.scaleBadgeEl) {
      this.scaleBadgeEl.textContent = `${Math.round(clamped * 100)}%`;
    }

    if (saveToStore) {
      store.updateSettings({ toolbarScale: clamped });
    }
  }

  public setScale(scale: number): void {
    this.applyScale(scale, true);
  }

  public clampToViewport(): void {
    const rect = this.containerEl.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
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
    let cursorIdleTimer: number;
    const resetTimer = () => {
      this.wakeFromGhost();
      window.clearTimeout(this.idleDimTimer);
      const s = store.getState().settings;
      const idleSec = s.toolbarIdleSeconds || 4;
      this.idleDimTimer = window.setTimeout(() => {
        // AUDIT-FIX: BUG-011 - Hide toolbar completely when idle if configured (TB-2, ZEN-6)
        if (store.getState().settings.hideToolbarCompletelyOnIdle) {
          this.containerEl.classList.add('completely-hidden');
        } else {
          this.containerEl.classList.add('dimmed');
        }
      }, idleSec * 1000);

      // AUDIT-FIX: BUG-011 - Hide cursor when idle if configured (ZEN-6)
      if (s.hideCursorWhenIdle) {
        document.body.classList.remove('hide-cursor');
        window.clearTimeout(cursorIdleTimer);
        cursorIdleTimer = window.setTimeout(() => {
          if (store.getState().settings.hideCursorWhenIdle) {
            document.body.classList.add('hide-cursor');
          }
        }, 3000);
      }
    };

    // Any interaction with container or window pointer movement
    this.containerEl.addEventListener('pointerdown', resetTimer, { passive: true });
    this.containerEl.addEventListener('pointermove', resetTimer, { passive: true });
    window.addEventListener('pointermove', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });

    resetTimer();
  }

  private wakeFromGhost(): void {
    this.containerEl.classList.remove('dimmed');
    this.containerEl.classList.remove('completely-hidden');
    document.body.classList.remove('hide-cursor');
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

      // Check right overflow and smoothly shift left / auto-fit scale if needed
      const checkAndClampRight = () => {
        const expandedRect = this.containerEl.getBoundingClientRect();
        const availableW = window.innerWidth - 24;

        // If expanded toolbar rendered width is wider than screen, gently scale it down to fit screen
        if (expandedRect.width > availableW && availableW > 320) {
          const fitScale = Math.max(0.45, Math.min(this.toolbarScale, Math.floor((availableW / (expandedRect.width / this.toolbarScale)) * 100) / 100));
          if (fitScale < this.toolbarScale) {
            this.applyScale(fitScale, false);
            this.containerEl.style.left = '12px';
            return;
          }
        }

        if (expandedRect.right > window.innerWidth - 16) {
          const shift = expandedRect.right - (window.innerWidth - 16);
          const newLeft = Math.max(12, expandedRect.left - shift);
          this.containerEl.style.left = `${newLeft}px`;
        }
      };
      requestAnimationFrame(checkAndClampRight);
      setTimeout(checkAndClampRight, 220);
    } else {
      this.tier2El.classList.add('collapsed');
      this.btnTierToggleEl.classList.remove('active');

      if (labelEl) labelEl.textContent = 'More';
      if (iconEl) {
        iconEl.innerHTML = '<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>';
      }
      this.btnTierToggleEl.title = 'More Tools (+)';

      // Restore user's preferred scale if it was auto-fitted
      const savedScale = store.getState().settings.toolbarScale || 1.0;
      if (this.toolbarScale !== savedScale) {
        this.applyScale(savedScale, false);
      }

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
    // Helper to open or toggle tool popovers
    const openSubPopover = (tool: ActiveTool, anchorEl: HTMLElement, forceOpen = false) => {
      if (tool === 'pen') {
        if (!forceOpen && popoverManager.isOpen()) {
          popoverManager.close();
        } else {
          popoverManager.showPenPopover(anchorEl);
        }
      } else if (tool === 'highlighter') {
        if (!forceOpen && popoverManager.isOpen()) {
          popoverManager.close();
        } else {
          popoverManager.showHighlighterPopover(anchorEl);
        }
      } else if (tool === 'eraser') {
        if (!forceOpen && popoverManager.isOpen()) {
          popoverManager.close();
        } else {
          popoverManager.showEraserPopover(anchorEl);
        }
      } else if (tool === 'magnifier') {
        if (!forceOpen && zoomPopoverManager.isOpen()) {
          zoomPopoverManager.close();
        } else {
          zoomPopoverManager.showMagnifierPopover(anchorEl);
        }
      }
    };

    // Tool buttons (including individual shapes & sub-menus)
    const toolBtns = this.containerEl.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolBtns.forEach((btn) => {
      const tool = btn.getAttribute('data-tool') as ActiveTool;
      const hasSub = btn.hasAttribute('data-has-sub') || ['pen', 'highlighter', 'eraser', 'magnifier'].includes(tool);
      let pressTimer: number | null = null;
      let isLongPressed = false;

      // Long-press detection (350ms) for digital touch boards
      if (hasSub) {
        btn.addEventListener('pointerdown', () => {
          isLongPressed = false;
          pressTimer = window.setTimeout(() => {
            if (this.isDragging) return;
            isLongPressed = true;
            try { navigator.vibrate?.(40); } catch {}
            store.setState({ activeTool: tool });
            openSubPopover(tool, btn, true);
          }, 350);
        });

        const cancelPressTimer = () => {
          if (pressTimer !== null) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        };

        btn.addEventListener('pointerup', cancelPressTimer);
        btn.addEventListener('pointercancel', cancelPressTimer);
        btn.addEventListener('pointerleave', cancelPressTimer);

        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.isDragging) return;
          store.setState({ activeTool: tool });
          openSubPopover(tool, btn, true);
        });
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isDragging) return;
        if (isLongPressed) {
          isLongPressed = false;
          return;
        }

        const shape = btn.getAttribute('data-shape') as ShapeType | null;
        const currentTool = store.getState().activeTool;

        if (tool === 'shape' && shape) {
          popoverManager.close();
          zoomPopoverManager.close();
          store.setState({ activeTool: 'shape', activeShape: shape });
          return;
        }

        if (tool === currentTool) {
          // If already selected, toggle its sub-menu popover
          if (hasSub) {
            openSubPopover(tool, btn);
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
        if (this.isDragging) return;
        const color = sw.getAttribute('data-color')!;
        swatchEls.forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        store.setState({ activeColor: color });
      });
    });

    // Undo & Clear All
    document.getElementById('btnUndo')?.addEventListener('click', () => {
      if (this.isDragging) return;
      annotationStore.undo();
    });

    document.getElementById('btnClearAll')?.addEventListener('click', () => {
      if (this.isDragging) return;
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
          if (this.isDragging) return;
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
      if (this.isDragging) return;
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
      if (this.isDragging) return;
      this.toggleTier2();
    });

    // Auto-Straighten toggle
    const btnStraighten = document.getElementById('btnToolAutoStraighten');
    if (btnStraighten) {
      const active = store.getState().isAutoStraightenEnabled;
      btnStraighten.classList.toggle('active', active);
      btnStraighten.title = active ? 'Auto-Straighten [ON]' : 'Auto-Straighten [OFF]';
    }
    btnStraighten?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      const active = !store.getState().isAutoStraightenEnabled;
      store.setState({ isAutoStraightenEnabled: active });
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active', active);
      btn.title = active ? 'Auto-Straighten [ON]' : 'Auto-Straighten [OFF]';
      // Zero toast / silent update per user request
    });

    // Handwriting ✍ ➔ Aa toggle
    const btnHw = document.getElementById('btnToolHandwriting');
    if (btnHw) {
      btnHw.classList.toggle('active', store.getState().isHandwritingEnabled); // INKFIX: initialize state
    }
    btnHw?.addEventListener('click', (e) => {
      if (this.isDragging) return;
      const active = !store.getState().isHandwritingEnabled;
      store.setState({ isHandwritingEnabled: active });
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active', active);
      // Zero toast / silent update per user request
    });

    // Media overlay button
    document.getElementById('btnMediaOverlay')?.addEventListener('click', () => {
      if (this.isDragging) return;
      const fileInput = document.getElementById('fileInputMedia') as HTMLInputElement;
      fileInput.click();
    });

    // Browser overlay button
    document.getElementById('btnBrowserOverlay')?.addEventListener('click', () => {
      if (this.isDragging) return;
      window.dispatchEvent(new CustomEvent('toggle-web-overlay'));
    });

    // Gemini AI button
    document.getElementById('btnGemini')?.addEventListener('click', () => {
      if (this.isDragging) return;
      window.dispatchEvent(new CustomEvent('toggle-gemini'));
    });

    // Board button
    document.getElementById('btnBoard')?.addEventListener('click', () => {
      if (this.isDragging) return;
      window.dispatchEvent(new CustomEvent('toggle-board'));
    });

    // Deck / Open File button in Tier 2
    document.getElementById('btnToolOpenDeck')?.addEventListener('click', () => {
      if (this.isDragging) return;
      const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
      fileInput?.click();
    });

    // Settings button
    document.getElementById('btnSettings')?.addEventListener('click', () => {
      if (this.isDragging) return;
      window.dispatchEvent(new CustomEvent('toggle-settings'));
    });

    // Full Screen Zen Quick Toggle button (Single intuitive toggle, Zero popups, 100% 4K view)
    const handleFitToggle = (e?: Event) => {
      e?.stopPropagation();
      if (this.isDragging) return;
      const isCurrentlyZen = store.getState().isZen;
      if (!isCurrentlyZen) {
        store.updateSettings({ fitMode: 'fill' });
        fullscreenService.enterZen();
      } else {
        fullscreenService.exitZen();
      }
    };

    document.getElementById('btnToolFitModeTier1')?.addEventListener('click', handleFitToggle);
  }

  private bindStore(): void {
    store.subscribe((state, prev) => {
      // Active tool and shape update
      if (state.activeTool !== prev.activeTool || state.activeShape !== prev.activeShape) {
        const toolBtns = this.contentEl.querySelectorAll<HTMLButtonElement>('[data-tool]');
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

      // Active color swatch synchronization
      if (state.activeColor !== prev.activeColor) {
        const swatches = this.contentEl.querySelectorAll<HTMLElement>('.color-swatch');
        swatches.forEach((sw) => {
          sw.classList.toggle('active', sw.getAttribute('data-color') === state.activeColor);
        });
      }

      // Auto-Straighten toggle sync
      if (state.isAutoStraightenEnabled !== prev.isAutoStraightenEnabled) {
        const btnStraighten = document.getElementById('btnToolAutoStraighten');
        if (btnStraighten) {
          btnStraighten.classList.toggle('active', state.isAutoStraightenEnabled);
          btnStraighten.title = state.isAutoStraightenEnabled
            ? 'Auto-Straighten [ON]'
            : 'Auto-Straighten [OFF]';
        }
      }

      // Tier 2 collapse / expand
      if (state.isTier2Expanded !== prev.isTier2Expanded) {
        this.syncTier2State(state.isTier2Expanded);
      }

      // Toolbar scale update
      if (state.settings.toolbarScale !== prev.settings.toolbarScale) {
        this.applyScale(state.settings.toolbarScale || 1.0, false);
      }

      // Slide Fit mode button label sync
      if (state.settings.fitMode !== prev.settings.fitMode) {
        const text = state.settings.fitMode === 'fill' ? 'Fill' : state.settings.fitMode === 'stretch' ? 'Stretch' : 'Fit';
        const lbl = document.getElementById('btnToolFitModeLabel');
        if (lbl) {
          lbl.textContent = text;
        }
      }

      // Zen mode toolbar visibility and "फुल स्क्रीन" button active state
      if (state.isZen !== prev.isZen || state.isToolbarVisibleInZen !== prev.isToolbarVisibleInZen) {
        const btnFs = document.getElementById('btnToolFitModeTier1');
        const lblFs = document.getElementById('btnToolFitModeTier1Label');
        if (btnFs) {
          btnFs.classList.toggle('active', state.isZen);
        }
        if (lblFs) {
          lblFs.textContent = state.isZen ? 'फुल स्क्रीन बंद' : 'फुल स्क्रीन';
        }
        if (state.isZen && !state.isToolbarVisibleInZen) {
          this.containerEl.classList.add('zen-hidden');
        } else {
          this.containerEl.classList.remove('zen-hidden');
        }
      }

      // Board mode: seamlessly mount unified toolbar inside bottom board dock
      if (state.isBoardMode !== prev.isBoardMode) {
        if (state.isBoardMode) {
          const boardCenter = document.getElementById('boardDockCenter');
          if (boardCenter && this.contentEl) {
            boardCenter.appendChild(this.contentEl);
          }
          this.containerEl.classList.add('hidden');
        } else {
          if (this.containerEl && this.contentEl) {
            this.containerEl.appendChild(this.contentEl);
          }
          this.containerEl.classList.remove('hidden');
        }
      }
    });
  }
}

export const toolbar = new Toolbar();
