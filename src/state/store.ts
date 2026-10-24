import { AppSettings, loadSettings, saveSettings } from './settings';

// SSIRO-UPDATE: Register magnifier and zoom tools
export type ActiveTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'arrow' | 'text' | 'magnifier' | 'zoom';
export type ShapeType = 'rect' | 'circle' | 'line';
export type BoardThemeId = 'slate' | 'chalkboard' | 'chroma' | 'navy' | 'maths';

export interface DeckPage {
  pageNumber: number;
  width: number;
  height: number;
  title?: string;
  sourceType: 'pdf' | 'image' | 'canvas';
  renderData?: any; // pdf.js PageProxy or image element
}

export interface DeckInfo {
  id: string;
  name: string;
  totalPages: number;
  pages: DeckPage[];
}

// WELCOME-FIX: Explicit top-level app state
export type ViewState = 'welcome' | 'deck' | 'board';

export interface AppState {
  appState: ViewState;
  currentDeck: DeckInfo | null;
  currentPage: number;
  totalPages: number;
  isZen: boolean;
  isBoardMode: boolean;
  boardTheme: BoardThemeId;
  activeTool: ActiveTool;
  activeShape: ShapeType;
  activeColor: string;
  isHandwritingEnabled: boolean;
  isTier2Expanded: boolean;
  isToolbarVisibleInZen: boolean;
  isWebOverlayOpen: boolean;
  isGeminiOpen: boolean;
  isSettingsOpen: boolean;
  dominantEdgeColor: string;
  penSize: number;
  penAlpha: number;
  highlighterWidth: number;
  highlighterAlpha: number;
  eraserSize: number;
  eraserMode: 'stroke' | 'pixel';
  settings: AppSettings;
}

type Listener = (state: AppState, prevState: AppState) => void;

class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    const settings = loadSettings();
    this.state = {
      // WELCOME-FIX: Initial app state is always 'welcome'
      appState: 'welcome',
      currentDeck: null,
      currentPage: 1,
      totalPages: 1,
      isZen: false,
      isBoardMode: false,
      boardTheme: settings.boardDefaultTheme,
      activeTool: 'select',
      activeShape: 'rect',
      activeColor: '#f59e0b', // Decoding Indology saffron gold
      isHandwritingEnabled: settings.smartInkEnabled ?? true, // INKFIX: Enable Smart Ink by default
      isTier2Expanded: false,
      isToolbarVisibleInZen: true,
      isWebOverlayOpen: false,
      isGeminiOpen: false,
      isSettingsOpen: false,
      dominantEdgeColor: '#000000',
      penSize: settings.defaultPenSize,
      penAlpha: settings.defaultPenAlpha,
      highlighterWidth: settings.defaultHighlighterWidth,
      highlighterAlpha: settings.defaultHighlighterAlpha,
      eraserSize: settings.defaultEraserSize,
      eraserMode: settings.eraserMode,
      settings
    };
  }

  getState(): AppState {
    return this.state;
  }

  setState(partial: Partial<AppState>): void {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...partial };

    // If settings changed, persist
    if (partial.settings) {
      saveSettings(this.state.settings);
    }

    // Layer isolation: sync data-active-tool on stage element
    const stage = document.getElementById('stage');
    if (stage && (prevState.activeTool !== this.state.activeTool || prevState.isZen !== this.state.isZen)) {
      stage.setAttribute('data-active-tool', this.state.activeTool);
      if (this.state.isZen) {
        stage.classList.add('zen-mode');
      } else {
        stage.classList.remove('zen-mode');
      }
    }

    this.notify(prevState);
  }

  updateSettings(partialSettings: Partial<AppSettings>): void {
    const updated = { ...this.state.settings, ...partialSettings };
    this.setState({ settings: updated });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(prevState: AppState): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state, prevState);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    }
  }
}

export const store = new Store();
