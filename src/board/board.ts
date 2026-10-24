import { BoardThemeId, store } from '../state/store';
import { BOARD_THEMES, BoardThemeDef } from './themes';
import { layerManager } from '../core/layers';
import { annotationStore } from '../draw/annotationStore';
import { slideRenderer } from '../presenter/renderer';
// WELCOME-FIX: import welcomeScreen for state transitions
import { welcomeScreen } from '../ui/welcomeScreen';

export class BlackboardStudio {
  private dockEl!: HTMLElement;
  private currentTheme: BoardThemeDef = BOARD_THEMES.slate;

  init(): void {
    this.dockEl = document.getElementById('boardDock') as HTMLElement;
    this.renderDock();
    this.bindEvents();
    this.bindStore();
  }

  private renderDock(): void {
    this.dockEl.innerHTML = `
      <div class="board-dock-left">
        <div class="theme-selector" id="themeSelector">
          ${Object.values(BOARD_THEMES)
            .map(
              (th) => `
            <div class="theme-pill ${th.id === 'slate' ? 'active' : ''}" 
                 style="background-color: ${th.bgColor}; border-color: ${th.isChroma ? '#000' : 'rgba(255,255,255,0.2)'};" 
                 data-theme="${th.id}" 
                 title="${th.nameHi} (${th.name})">
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="board-dock-center">
        <button class="tool-btn active" data-board-tool="select" title="Select">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 3 7 18 3-7 7-3L3 3z"/></svg>
        </button>
        <button class="tool-btn" data-board-tool="pen" title="Pen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button class="tool-btn" data-board-tool="highlighter" title="Marker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
        </button>
        <button class="tool-btn" data-board-tool="eraser" title="Eraser">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
        </button>
        <button class="tool-btn" data-board-tool="shape" title="Shapes">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>
        <button class="tool-btn" data-board-tool="arrow" title="Arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>

        <div class="swatch-group" id="boardSwatches">
          <!-- Populated dynamically based on theme -->
        </div>

        <button class="tool-btn" id="btnBoardUndo" title="Undo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </button>
        <button class="tool-btn" id="btnBoardClear" title="Clear Board">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>

      <div class="board-dock-right">
        <button class="board-close-btn" id="btnBoardClose" title="Close Board (Return to Slide)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <span>✕ बंद करें</span>
        </button>
      </div>
    `;

    this.updateSwatches(this.currentTheme.safePalette);
  }

  private updateSwatches(palette: string[]): void {
    const swatchContainer = document.getElementById('boardSwatches');
    if (!swatchContainer) return;

    swatchContainer.innerHTML = palette
      .map(
        (c, idx) =>
          `<div class="color-swatch ${idx === 0 ? 'active' : ''}" style="background-color: ${c};" data-color="${c}"></div>`
      )
      .join('');

    // Ensure active color is from current safe palette
    const activeColor = palette[0];
    store.setState({ activeColor });

    swatchContainer.querySelectorAll<HTMLElement>('.color-swatch').forEach((sw) => {
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = sw.getAttribute('data-color')!;
        swatchContainer.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        store.setState({ activeColor: c });
      });
    });
  }

  private bindEvents(): void {
    // Theme switching
    const themePills = this.dockEl.querySelectorAll<HTMLElement>('.theme-pill');
    themePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const tid = pill.getAttribute('data-theme') as BoardThemeId;
        this.setTheme(tid);
        themePills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
      });
    });

    // Tool switching inside dock
    const toolBtns = this.dockEl.querySelectorAll<HTMLButtonElement>('[data-board-tool]');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-board-tool') as any;
        store.setState({ activeTool: tool });
        toolBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Undo & Clear
    document.getElementById('btnBoardUndo')?.addEventListener('click', () => {
      annotationStore.undo();
    });

    document.getElementById('btnBoardClear')?.addEventListener('click', () => {
      annotationStore.clearAll();
    });

    // Close button
    document.getElementById('btnBoardClose')?.addEventListener('click', () => {
      this.closeBoard();
    });

    // Header toggle button
    document.getElementById('btnBoardHeader')?.addEventListener('click', () => {
      this.toggleBoard();
    });

    // Custom event
    window.addEventListener('toggle-board', () => {
      this.toggleBoard();
    });
  }

  toggleBoard(): void {
    if (store.getState().isBoardMode) {
      this.closeBoard();
    } else {
      this.openBoard();
    }
  }

  openBoard(): void {
    // Save current slide annotations if needed
    annotationStore.clearAll();
    // WELCOME-FIX: Transition appState to 'board'
    store.setState({ isBoardMode: true, appState: 'board' });
    this.dockEl.classList.remove('hidden');
    this.renderBoardSurface();
  }

  closeBoard(): void {
    const strokes = annotationStore.getStrokes();
    if (strokes.length > 0) {
      const confirmClose = confirm('क्या आप ब्लैकबोर्ड बंद करना चाहते हैं? बोर्ड की स्याही साफ़ हो जाएगी। / Close blackboard? Ink will be cleared.');
      if (!confirmClose) return;
    }

    annotationStore.clearAll();
    this.dockEl.classList.add('hidden');

    const state = store.getState();
    const nextState = state.currentDeck ? 'deck' : 'welcome';
    // WELCOME-FIX: Return to 'deck' if a deck is loaded, otherwise return to 'welcome'
    store.setState({ isBoardMode: false, appState: nextState });

    if (nextState === 'deck' && state.currentDeck) {
      const page = state.currentDeck.pages[state.currentPage - 1];
      if (page) {
        slideRenderer.renderSlide(page);
      }
    } else {
      // Clear canvas and show persistent welcome screen
      layerManager.slideCtx.clearRect(0, 0, layerManager.slideCanvas.width, layerManager.slideCanvas.height);
      welcomeScreen.show();
    }
  }

  setTheme(themeId: BoardThemeId): void {
    this.currentTheme = BOARD_THEMES[themeId] || BOARD_THEMES.slate;
    store.setState({ boardTheme: themeId });
    this.updateSwatches(this.currentTheme.safePalette);
    this.renderBoardSurface();
  }

  renderBoardSurface(): void {
    if (!store.getState().isBoardMode) return;

    const ctx = layerManager.slideCtx;
    const dims = layerManager.getDimensions();
    const th = this.currentTheme;

    ctx.save();
    // Fill exact 100% viewport with theme color
    ctx.fillStyle = th.bgColor;
    ctx.fillRect(0, 0, dims.width, dims.height);

    // Subtle texture for chalkboard
    if (th.texture === 'chalk') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < 400; i++) {
        const x = Math.random() * dims.width;
        const y = Math.random() * dims.height;
        const r = Math.random() * 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Maths Grid (40px grid drawn at 1px, 12% alpha per B8)
    if (th.grid) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${th.grid.alpha})`;
      ctx.lineWidth = 1;
      for (let x = 0; x < dims.width; x += th.grid.size) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dims.height);
        ctx.stroke();
      }
      for (let y = 0; y < dims.height; y += th.grid.size) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dims.width, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private bindStore(): void {
    store.subscribe((state, prev) => {
      if (state.isBoardMode && !prev.isBoardMode) {
        this.renderBoardSurface();
      }
    });

    layerManager.onResize(() => {
      if (store.getState().isBoardMode) {
        this.renderBoardSurface();
      }
    });
  }
}

export const blackboardStudio = new BlackboardStudio();
