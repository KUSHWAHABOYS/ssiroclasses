import { BoardThemeId, store } from '../state/store';
import { BOARD_THEMES, BoardThemeDef } from './themes';
import { layerManager } from '../core/layers';
import { annotationStore, Stroke } from '../draw/annotationStore';
import { slideRenderer } from '../presenter/renderer';
// WELCOME-FIX: import welcomeScreen for state transitions
import { welcomeScreen } from '../ui/welcomeScreen';

export class BlackboardStudio {
  private dockEl!: HTMLElement;
  private currentTheme: BoardThemeDef = BOARD_THEMES.slate;
  private boardPages: Stroke[][] = [[]];
  private currentPageIndex: number = 0;

  init(): void {
    this.dockEl = document.getElementById('boardDock') as HTMLElement;
    this.renderDock();
    this.bindEvents();
    this.bindStore();
  }

  private renderDock(): void {
    this.dockEl.innerHTML = `
      <div class="board-dock-left" id="boardDockLeft">
        <div class="theme-selector" id="themeSelector">
          ${Object.values(BOARD_THEMES)
            .map(
              (th) => `
            <div class="theme-pill ${th.id === 'slate' ? 'active' : ''}" 
                 style="background-color: ${th.bgColor};" 
                 data-theme="${th.id}" 
                 title="${th.name}">
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="board-dock-right" id="boardDockRight">
        <!-- Multi-Page Blackboard Navigation -->
        <div class="board-page-controls" id="boardPageControls">
          <button class="board-page-btn" id="btnBoardPrevPage" type="button" title="Previous Page (◀)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="board-page-indicator" id="boardPageIndicator">1 / 1</span>
          <button class="board-page-btn" id="btnBoardNextPage" type="button" title="Next Page (▶)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button class="board-page-btn btn-board-add" id="btnBoardAddPage" type="button" title="Add New Page (+)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>

        <div class="board-dock-sep"></div>

        <button class="board-close-btn" id="btnBoardClose" type="button" title="Close Blackboard (Return to Slide)">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
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

    // Multi-page navigation
    document.getElementById('btnBoardPrevPage')?.addEventListener('click', () => {
      this.prevPage();
    });

    document.getElementById('btnBoardNextPage')?.addEventListener('click', () => {
      this.nextPage();
    });

    document.getElementById('btnBoardAddPage')?.addEventListener('click', () => {
      this.addPage();
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

  addPage(): void {
    this.boardPages[this.currentPageIndex] = annotationStore.getStrokes();
    this.boardPages.push([]);
    this.currentPageIndex = this.boardPages.length - 1;
    annotationStore.setBoardStrokes([]);
    this.updatePageIndicator();
  }

  prevPage(): void {
    if (this.currentPageIndex > 0) {
      this.boardPages[this.currentPageIndex] = annotationStore.getStrokes();
      this.currentPageIndex--;
      annotationStore.setBoardStrokes(this.boardPages[this.currentPageIndex] || []);
      this.updatePageIndicator();
    }
  }

  nextPage(): void {
    if (this.currentPageIndex < this.boardPages.length - 1) {
      this.boardPages[this.currentPageIndex] = annotationStore.getStrokes();
      this.currentPageIndex++;
      annotationStore.setBoardStrokes(this.boardPages[this.currentPageIndex] || []);
      this.updatePageIndicator();
    }
  }

  private updatePageIndicator(): void {
    const ind = document.getElementById('boardPageIndicator');
    if (ind) {
      ind.textContent = `${this.currentPageIndex + 1} / ${this.boardPages.length}`;
    }
  }

  toggleBoard(): void {
    if (store.getState().isBoardMode) {
      this.closeBoard();
    } else {
      this.openBoard();
    }
  }

  openBoard(): void {
    annotationStore.switchToBoard();
    store.setState({ isBoardMode: true, appState: 'board' });
    this.dockEl.classList.remove('hidden');
    this.renderBoardSurface();
    this.updatePageIndicator();
  }

  closeBoard(): void {
    // Save current board page strokes
    this.boardPages[this.currentPageIndex] = annotationStore.getStrokes();

    annotationStore.switchToDeck();
    this.dockEl.classList.add('hidden');

    const state = store.getState();
    const nextState = state.currentDeck ? 'deck' : 'welcome';
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
    // Keep user's active color intact; for chroma key only, avoid matching green background
    if (this.currentTheme.isChroma) {
      const activeColor = store.getState().activeColor;
      if (activeColor === '#22c55e' || activeColor === '#10b981' || activeColor === '#00ff00') {
        store.setState({ activeColor: '#f59e0b' });
      }
    }
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
