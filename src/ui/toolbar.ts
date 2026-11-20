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
// SSIRO-UPDATE: Welcome screen
import { welcomeScreen } from './welcomeScreen';
// TEACHER-SUITE: Smart Classroom Tools Suite
import { timerController, curtainController, spotlightController, splitScreenController, pdfNotesExporter } from '../tools/teachingTools';
import { slideView } from '../presenter/slideView';

export class Toolbar {
  private containerEl!: HTMLElement;
  private contentEl!: HTMLElement;
  private masterDockEl!: HTMLElement;
  private penIslandEl!: HTMLElement;
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
    '#06b6d4', // Sky / Neon cyan
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
    const toolBtns = this.containerEl?.querySelectorAll<HTMLButtonElement>('[data-tool]');
    toolBtns?.forEach((btn) => {
      const t = btn.getAttribute('data-tool');
      const sh = btn.getAttribute('data-shape');
      if (t === 'shape') {
        btn.classList.toggle('active', initialTool === 'shape' && store.getState().activeShape === sh);
      } else {
        btn.classList.toggle('active', t === initialTool);
      }
    });

    // Prevent touch/swipe gestures on toolbar from bubbling to stage (so PPT slides don't change on toolbar swipe)
    this.containerEl.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    this.containerEl.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
    this.containerEl.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });

    // Clamp toolbar on resize and orientationchange
    window.addEventListener('resize', () => this.clampToViewport(), { passive: true });
    window.addEventListener('orientationchange', () => this.clampToViewport(), { passive: true });
  }

  private renderToolbar(): void {
    this.containerEl.innerHTML = `
      <div class="master-toolbar-wrapper" id="masterToolbarWrapper">
        <!-- 1. DYNAMIC INKING & PROPERTIES ISLAND (Contextual Floater above Pen) -->
        <div class="pen-dynamic-island" id="penDynamicIsland">
          <!-- Tips: Fountain, Ballpoint, Brush, Calligraphy -->
          <div class="island-tips-group" id="islandTipsGroup">
            <button class="island-tip-btn active" data-tip="fountain" type="button">Fountain</button>
            <button class="island-tip-btn" data-tip="ballpoint" type="button">Ballpoint</button>
            <button class="island-tip-btn" data-tip="brush" type="button">Brush</button>
            <button class="island-tip-btn" data-tip="calligraphy" type="button">Calligraphy</button>
          </div>

          <div class="island-sep"></div>

          <!-- Stroke Dots: STROKE 1px, 2px, 4px, 8px -->
          <div class="island-stroke-group" id="islandStrokeGroup">
            <span class="island-stroke-label">STROKE</span>
            <button class="stroke-dot-btn" data-size="2" type="button" title="1px (Fine)">
              <span class="stroke-dot dot-1"></span>
            </button>
            <button class="stroke-dot-btn active" data-size="4" type="button" title="2px (Normal)">
              <span class="stroke-dot dot-2"></span>
            </button>
            <button class="stroke-dot-btn" data-size="8" type="button" title="4px (Medium)">
              <span class="stroke-dot dot-4"></span>
            </button>
            <button class="stroke-dot-btn" data-size="16" type="button" title="8px (Thick)">
              <span class="stroke-dot dot-8"></span>
            </button>
          </div>

          <div class="island-sep"></div>

          <!-- Tactile Color Swatches -->
          <div class="island-swatches-group" id="islandSwatchesGroup">
            ${this.swatches
              .map(
                (c, i) =>
                  `<div class="color-swatch color-swatch-tactile ${i === 1 ? 'active' : ''}" style="background-color: ${c};" data-color="${c}"></div>`
              )
              .join('')}
            <div class="color-swatch-spectrum" id="btnCustomColor" title="Custom Spectrum Color">
              <span class="spectrum-plus">+</span>
              <input type="color" id="inputCustomColor" style="position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;" />
            </div>
          </div>

          <div class="island-sep"></div>

          <!-- Adaptive Pressure Feedback -->
          <div class="island-pressure-feedback" id="islandPressureFeedback" title="Pressure Sensitivity: Adaptive Dynamic Inking">
            <svg class="pressure-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="m13 2-2 7h5L11 22l2-7H8l5-13z"/>
            </svg>
            <span>Pressure Curve: Adaptive</span>
          </div>
        </div>

        <!-- 2. STUDIO MASTER FLOATING DOCK -->
        <div class="studio-master-dock" id="toolbarMasterDock">
          <!-- SECTION 1: Drag Anchor, Select, Lasso, Auto-Straighten -->
          <div class="dock-section">
            <div class="dock-drag-handle" id="dragHandle" title="टूलबार मूव करें (360° Drag Toolbar)">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="8" cy="6" r="1.3" fill="currentColor"/>
                <circle cx="8" cy="12" r="1.3" fill="currentColor"/>
                <circle cx="8" cy="18" r="1.3" fill="currentColor"/>
                <circle cx="16" cy="6" r="1.3" fill="currentColor"/>
                <circle cx="16" cy="12" r="1.3" fill="currentColor"/>
                <circle cx="16" cy="18" r="1.3" fill="currentColor"/>
              </svg>
            </div>

            <button class="dock-btn tool-btn" id="btnToolSelect" data-tool="select" title="Select (S)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m3 3 7 18 3-7 7-3L3 3z"/>
              </svg>
              <span class="dock-label">Select</span>
            </button>

            <button class="dock-btn tool-btn" id="btnToolLasso" data-tool="lasso" title="Lasso Selection (L)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 22a5 5 0 0 1-2-4c0-3.87 3.13-7 7-7h1a7 7 0 1 0-7-7c0 2.5 1.5 4.5 3.5 5.5"/>
                <circle cx="12" cy="12" r="1.5"/>
              </svg>
              <span class="dock-label">Lasso</span>
            </button>

            <button class="dock-btn tool-btn" id="btnToolAutoStraighten" title="Auto-Straighten Shapes [OFF]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 4l6 6L9 21H3v-6L14 4z"/>
                <line x1="2" y1="22" x2="22" y2="22" stroke-width="2"/>
              </svg>
              <span class="dock-label">Auto</span>
            </button>
          </div>

          <div class="dock-sep"></div>

          <!-- SECTION 2: Inking Toolkit (Pen ▾, Marker ▾, Eraser ▾, Laser ▾) -->
          <div class="dock-section">
            <button class="dock-btn tool-btn tool-pen active" id="btnToolPen" data-tool="pen" data-has-sub="true" title="पेन (Pen • टैप से इनकिंग आइलैंड खोलें/बंद करें)">
              <div class="pen-active-dot"></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              <div class="dock-label-group">
                <span class="dock-label">Pen</span>
                <span class="dock-sub-arrow">▾</span>
              </div>
            </button>

            <button class="dock-btn tool-btn" id="btnToolHighlighter" data-tool="highlighter" data-has-sub="true" title="हाइलाइटर (Marker ▾)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 11-6 6v3h3l6-6"/>
                <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
              </svg>
              <div class="dock-label-group">
                <span class="dock-label">Marker</span>
                <span class="dock-sub-arrow">▾</span>
              </div>
            </button>

            <button class="dock-btn tool-btn" id="btnToolEraser" data-tool="eraser" data-has-sub="true" title="इरेज़र (Eraser ▾)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
                <path d="M22 21H7"/>
              </svg>
              <div class="dock-label-group">
                <span class="dock-label">Eraser</span>
                <span class="dock-sub-arrow">▾</span>
              </div>
            </button>

            <button class="dock-btn tool-btn" id="btnToolMagnifier" data-tool="magnifier" data-has-sub="true" title="लेज़र / मैग्नीफ़ायर (Laser ▾)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="7"/>
                <line x1="21" y1="21" x2="16" y2="16"/>
              </svg>
              <div class="dock-label-group">
                <span class="dock-label">Laser</span>
                <span class="dock-sub-arrow">▾</span>
              </div>
            </button>
          </div>

          <div class="dock-sep"></div>

          <!-- SECTION 3: Smart Assist & AI Suite -->
          <div class="dock-section">
            <!-- AI अनुवाद Distinct Glowing Card -->
            <button class="dock-btn tool-btn tool-ai-translate" id="btnToolTranslate" data-tool="translate" title="AI लाइव अनुवाद (Neural Live Translate)">
              <div class="ai-ping-dot"></div>
              <div class="ai-icon-box">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <div class="ai-text-box">
                <span class="ai-title">AI अनुवाद</span>
                <span class="ai-sub">Neural Live</span>
              </div>
            </button>

            <!-- ✍️ → Aa AI OCR -->
            <button class="dock-btn tool-btn" id="btnToolHandwriting" title="AI हस्तलेखन पहचान (✍️ ➔ Aa AI OCR)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m18 2 4 4-12 12H6v-4L18 2z"/>
                <path d="M14 6l4 4"/>
              </svg>
              <span class="dock-label">AI OCR</span>
            </button>

            <!-- ✦ Gemini -->
            <button class="dock-btn tool-btn" id="btnGemini" title="Gemini AI Teaching Assistant">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
              </svg>
              <span class="dock-label">Gemini</span>
            </button>
          </div>

          <div class="dock-sep"></div>

          <!-- SECTION 4: Geometric & Annotation Kit (Pill Container) -->
          <div class="dock-section">
            <div class="dock-shapes-pill" id="dockShapesPill">
              <button class="shape-dock-btn tool-btn" id="btnToolRect" data-tool="shape" data-shape="rect" title="Rectangle / Box [ ]">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </button>
              <button class="shape-dock-btn tool-btn" id="btnToolCircle" data-tool="shape" data-shape="circle" title="Circle O">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="8"/>
                </svg>
              </button>
              <button class="shape-dock-btn tool-btn" id="btnToolTriangle" data-tool="shape" data-shape="triangle" title="Triangle △">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 4 21 20 3 20"/>
                </svg>
              </button>
              <button class="shape-dock-btn tool-btn" id="btnToolLine" data-tool="shape" data-shape="line" title="Straight Line ╱">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="4" y1="20" x2="20" y2="4"/>
                </svg>
              </button>
              <button class="shape-dock-btn tool-btn" id="btnToolArrow" data-tool="arrow" title="Smart Arrow →">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="13 6 19 12 13 18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="dock-sep"></div>

          <!-- SECTION 5: History & System Controls -->
          <div class="dock-section">
            <button class="dock-btn tool-btn" id="btnUndo" title="Undo (Ctrl+Z)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7v6h6"/>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
              </svg>
              <span class="dock-label">Undo</span>
            </button>

            <button class="dock-btn tool-btn" id="btnRedo" title="Redo (Ctrl+Y)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 7v6h-6"/>
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
              </svg>
              <span class="dock-label">Redo</span>
            </button>

            <button class="dock-btn tool-btn" id="btnClearAll" title="Clear All Ink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              <span class="dock-label">Clear</span>
            </button>

            <!-- Uniform Mic Button with green live status dot -->
            <button class="dock-btn tool-btn mic-btn mic-off" id="btnToolMic" title="माइक चालू / बंद (Mic ON/OFF • V • दबाकर रखें मेनू हेतु)">
              <span class="mic-zen-dot" style="display:none;"></span>
              <span class="mic-zen-ping" style="display:none;"></span>
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
              <span class="dock-label">Mic</span>
            </button>

            <!-- Full Screen Quick Toggle -->
            <button class="dock-btn tool-btn" id="btnToolFitModeTier1" title="फुल स्क्रीन / फिट 16:9 दृश्य (Full Screen • L)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
              <span class="dock-label" id="btnToolFitModeTier1Label">फुल स्क्रीन</span>
            </button>
          </div>

          <div class="dock-sep"></div>

          <!-- SECTION 6: Studio Hub & Extensions -->
          <div class="dock-section">
            <!-- TEACHER TOOLS SUITE -->
            <button class="dock-btn-icon" id="btnToolTimer" title="टाइमर / स्टॉपवॉच (Countdown Timer & Stopwatch)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnToolCurtain" title="पर्दा टूल (Curtain / Screen Shade)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="11" x2="21" y2="11" stroke-width="2.5"/>
                <polyline points="9 15 12 18 15 15"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnToolSpotlight" title="स्पॉटलाइट फोकस (Spotlight Focus)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnToolSplitBoard" title="स्प्लिट स्क्रीन ब्लैकबोर्ड (50:50 Dual Split Board)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="12" y1="3" x2="12" y2="21"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnToolExportPdf" title="क्लास नोट्स डाउनलोड करें (1-Click Export Notes PDF)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>

            <div class="dock-sep"></div>

            <button class="dock-btn-icon" id="btnMediaOverlay" title="Media Overlay">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnBrowserOverlay" title="In-App Browser">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnBoard" title="Universal Blackboard Studio (B)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnToolOpenDeck" title="Open PDF/PPT Deck (O)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnToolLibrary" title="Studio Library">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>

            <button class="dock-btn-icon" id="btnSettings" title="Studio Settings">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            <!-- बंद करें (Power / Exit Session Button) -->
            <button class="dock-btn-exit" id="btnCloseSession" title="सेशन समाप्त करें (Exit / Close Session)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
              <span>बंद करें</span>
            </button>
          </div>
        </div>

        <!-- Hidden test-compatibility elements for legacy suites -->
        <div class="toolbar-tier toolbar-tier-2 toolbar-extra-tools collapsed" id="toolbarTier2" style="display:none !important;">
          <button class="tool-btn" id="btnTierToggle" title="More Tools (+)">
            <svg id="tierToggleIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
            <span class="btn-label" id="tierToggleLabel">More</span>
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

    this.contentEl = document.getElementById('masterToolbarWrapper')!;
    this.masterDockEl = document.getElementById('toolbarMasterDock')!;
    this.penIslandEl = document.getElementById('penDynamicIsland')!;
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
      const isInteractive = !!target.closest('.dock-btn, .shape-dock-btn, .dock-btn-icon, .dock-btn-exit, .island-tip-btn, .stroke-dot-btn, .color-swatch-tactile, .color-swatch-spectrum, button, input, select');

      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      pendingPointerId = e.pointerId;

      const rect = this.containerEl.getBoundingClientRect();
      this.initialToolbarLeft = rect.left;
      this.initialToolbarTop = rect.top;

      this.wakeFromGhost();

      if (!isInteractive) {
        // Empty space, toolbar background, or drag handle: start dragging immediately!
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
        if (store.getState().settings.hideToolbarCompletelyOnIdle) {
          this.containerEl.classList.add('completely-hidden');
        } else {
          this.containerEl.classList.add('dimmed');
        }
      }, idleSec * 1000);

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
      this.tier2El?.classList.remove('collapsed');
      this.btnTierToggleEl?.classList.add('active');

      if (labelEl) labelEl.textContent = 'Less';
      if (iconEl) {
        iconEl.innerHTML = '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>';
      }
      if (this.btnTierToggleEl) this.btnTierToggleEl.title = 'Fewer Tools (−)';
    } else {
      this.tier2El?.classList.add('collapsed');
      this.btnTierToggleEl?.classList.remove('active');

      if (labelEl) labelEl.textContent = 'More';
      if (iconEl) {
        iconEl.innerHTML = '<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>';
      }
      if (this.btnTierToggleEl) this.btnTierToggleEl.title = 'More Tools (+)';
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
          // If already selected: for pen, toggle Dynamic Inking Island; for others, open popover
          if (tool === 'pen' && this.penIslandEl) {
            this.penIslandEl.classList.toggle('collapsed');
          } else if (hasSub) {
            openSubPopover(tool, btn);
          }
        } else {
          popoverManager.close();
          zoomPopoverManager.close();
          store.setState({ activeTool: tool });
        }
      });
    });

    // Inking Island: Tip Selector buttons (Fountain, Ballpoint, Brush, Calligraphy)
    const tipBtns = this.containerEl.querySelectorAll<HTMLButtonElement>('.island-tip-btn');
    tipBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isDragging) return;
        tipBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tip = btn.getAttribute('data-tip');
        if (tip === 'brush') {
          store.setState({ penSize: 6 });
        } else if (tip === 'calligraphy') {
          store.setState({ penSize: 4 });
        } else if (tip === 'ballpoint') {
          store.setState({ penSize: 2 });
        } else {
          store.setState({ penSize: 3 });
        }
      });
    });

    // Inking Island: Stroke Thickness Dots
    const strokeBtns = this.containerEl.querySelectorAll<HTMLButtonElement>('.stroke-dot-btn');
    strokeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isDragging) return;
        const size = parseInt(btn.getAttribute('data-size') || '3', 10);
        strokeBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        store.setState({ penSize: size });
      });
    });

    // Inking Island: Color Swatches
    const swatchEls = this.containerEl.querySelectorAll<HTMLElement>('.color-swatch-tactile, .color-swatch');
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

    // Custom Color Spectrum Picker
    const btnCustomColor = document.getElementById('btnCustomColor');
    const inputCustomColor = document.getElementById('inputCustomColor') as HTMLInputElement | null;
    btnCustomColor?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      inputCustomColor?.click();
    });

    inputCustomColor?.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      if (color) {
        swatchEls.forEach((s) => s.classList.remove('active'));
        if (btnCustomColor) {
          btnCustomColor.style.borderColor = color;
          btnCustomColor.style.boxShadow = `0 0 10px ${color}`;
        }
        store.setState({ activeColor: color });
      }
    });

    // Undo & Redo & Clear All
    document.getElementById('btnUndo')?.addEventListener('click', () => {
      if (this.isDragging) return;
      annotationStore.undo();
    });

    document.getElementById('btnRedo')?.addEventListener('click', () => {
      if (this.isDragging) return;
      annotationStore.redo();
    });

    document.getElementById('btnClearAll')?.addEventListener('click', () => {
      if (this.isDragging) return;
      annotationStore.clearAll();
    });

    // TEACHER-SUITE: Wire Classroom Tools
    document.getElementById('btnToolTimer')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      timerController.toggle();
    });

    document.getElementById('btnToolCurtain')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      curtainController.toggle();
    });

    document.getElementById('btnToolSpotlight')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      spotlightController.toggle();
    });

    document.getElementById('btnToolSplitBoard')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      splitScreenController.toggle();
    });

    document.getElementById('btnToolExportPdf')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      pdfNotesExporter.exportCurrentSession();
    });

    // Session Exit Button ("बंद करें")
    document.getElementById('btnCloseSession')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isDragging) return;
      // Smoothly return to Welcome Screen & clean up session
      slideView.closeDeck();
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

        const dot = btnMic.querySelector('.mic-zen-dot') as HTMLElement;
        const ping = btnMic.querySelector('.mic-zen-ping') as HTMLElement;
        if (dot) dot.style.display = isListening ? 'block' : 'none';
        if (ping) ping.style.display = isListening ? 'block' : 'none';
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
    });

    // Handwriting ✍ ➔ Aa toggle
    const btnHw = document.getElementById('btnToolHandwriting');
    if (btnHw) {
      btnHw.classList.toggle('active', store.getState().isHandwritingEnabled);
    }
    btnHw?.addEventListener('click', (e) => {
      if (this.isDragging) return;
      const active = !store.getState().isHandwritingEnabled;
      store.setState({ isHandwritingEnabled: active });
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active', active);
    });

    // Media overlay button
    document.getElementById('btnMediaOverlay')?.addEventListener('click', () => {
      if (this.isDragging) return;
      const fileInput = document.getElementById('fileInputMedia') as HTMLInputElement;
      fileInput?.click();
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

    // Deck / Open File button
    document.getElementById('btnToolOpenDeck')?.addEventListener('click', () => {
      if (this.isDragging) return;
      const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
      fileInput?.click();
    });

    // Studio Library button
    document.getElementById('btnToolLibrary')?.addEventListener('click', () => {
      if (this.isDragging) return;
      window.dispatchEvent(new CustomEvent('open-library-modal'));
    });

    // Settings button
    document.getElementById('btnSettings')?.addEventListener('click', () => {
      if (this.isDragging) return;
      window.dispatchEvent(new CustomEvent('toggle-settings'));
    });

    // Full Screen Zen Quick Toggle button
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

        // Toggle Dynamic Inking Island when switching tools: visible only when Pen is active
        if (this.penIslandEl) {
          if (state.activeTool === 'pen') {
            this.penIslandEl.classList.remove('collapsed');
          } else {
            this.penIslandEl.classList.add('collapsed');
          }
        }
      }

      // Active color swatch synchronization
      if (state.activeColor !== prev.activeColor) {
        const swatches = this.containerEl.querySelectorAll<HTMLElement>('.color-swatch-tactile, .color-swatch');
        swatches.forEach((sw) => {
          sw.classList.toggle('active', sw.getAttribute('data-color') === state.activeColor);
        });
      }

      // Pen size synchronization
      if (state.penSize !== prev.penSize) {
        const strokeBtns = this.containerEl.querySelectorAll<HTMLButtonElement>('.stroke-dot-btn');
        strokeBtns.forEach((btn) => {
          const size = parseInt(btn.getAttribute('data-size') || '0', 10);
          btn.classList.toggle('active', size === state.penSize);
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

      // Board mode: mount unified toolbar inside bottom board dock if present
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
