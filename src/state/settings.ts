export interface AppSettings {
  language: 'hi' | 'en';
  fitMode: 'fit' | 'fill' | 'stretch';
  renderQuality: 'auto' | '3x' | '2x';
  autoEraseOnSlideChange: boolean;
  keepAnnotationsPerSlide: boolean;
  toolbarIdleSeconds: number;
  toolbarDimmedOpacity: number;
  toolbarPos: { x: number; y: number } | null;
  defaultPenSize: number;
  defaultPenAlpha: number;
  defaultHighlighterWidth: number;
  defaultHighlighterAlpha: number;
  defaultEraserSize: number;
  eraserMode: 'stroke' | 'pixel';
  handwritingDelayMs: number;
  handwritingProvider: 'gemini' | 'mlkit' | 'none';
  voiceLang: 'hi-IN' | 'en-IN';
  geminiModel: string;
  boardDefaultTheme: 'slate' | 'chalkboard' | 'chroma' | 'navy' | 'maths';
  clearMediaOnSlideChange: boolean;
  channelName: string;
  // SSIRO-UPDATE: Welcome screen settings
  showWelcomeScreen: boolean;
  welcomeLine1: string;
  welcomeLine2: string;
  welcomeDuration: number;
  // SSIRO-UPDATE: Magnifier and Zoom settings
  magnifierSize: number;
  magnifierZoom: number;
  magnifierShape: 'circle' | 'rect';
  magnifierMode: 'follow' | 'pin';
  magnifierSpotlight: boolean;
  magnifierSpotlightDim: number;
  magnifierTouchPos: 'above' | 'under';
  keepLensOnSlideChange: boolean;
  keepZoomOnSlideChange: boolean;
  keepPenWidthOnZoom: boolean;
  tapZoomLevel: number;
  // MIC-AI: Microphone settings
  micAutoOffMinutes: number;
  muteMicOnBoard: boolean;
  pushToTalk: boolean;
  showMicDotInZen: boolean;
  // MIC-AI: AI Router settings
  aiQualityPreference: 'best' | 'balanced' | 'fast';
  aiWarnAfterCalls: number;
  aiTaskPinnedModels: Record<string, { provider: string; model: string }>;
  aiProviderPriority: string[];
  // INKFIX: Smart Ink settings
  smartInkEnabled: boolean;
  smartInkSensitivity: 'normal' | 'strict' | 'forgiving';
  smartInkHoldToSnap: boolean;
  smartInkShapeDelayMs: number;
  smartInkHighlighterDelayMs: number;
  smartInkTextDelayMs: number;
  smartInkConvertText: 'word' | 'line' | 'off';
  smartInkAiAssist: boolean;
  smartInkCorrectionLevel: 'light' | 'none' | 'full';
  smartInkInspectorEnabled: boolean;
}

const SETTINGS_STORAGE_KEY = 'smart_studio_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'hi',
  fitMode: 'fit',
  renderQuality: 'auto',
  autoEraseOnSlideChange: true,
  keepAnnotationsPerSlide: false,
  toolbarIdleSeconds: 4,
  toolbarDimmedOpacity: 0.2,
  toolbarPos: null,
  defaultPenSize: 4,
  defaultPenAlpha: 1,
  defaultHighlighterWidth: 32,
  defaultHighlighterAlpha: 0.25,
  defaultEraserSize: 36,
  eraserMode: 'pixel',
  handwritingDelayMs: 1800,
  handwritingProvider: 'gemini',
  voiceLang: 'hi-IN',
  geminiModel: 'gemini-1.5-flash',
  boardDefaultTheme: 'slate',
  clearMediaOnSlideChange: false,
  channelName: 'Decoding Indology',
  // SSIRO-UPDATE: Welcome screen defaults
  showWelcomeScreen: true,
  welcomeLine1: 'Welcome to',
  welcomeLine2: 'SSIRO Classes',
  welcomeDuration: 2.8,
  // SSIRO-UPDATE: Magnifier & Zoom defaults
  magnifierSize: typeof window !== 'undefined' && window.innerWidth > 1800 ? 280 : 220,
  magnifierZoom: 3.0,
  magnifierShape: 'circle',
  magnifierMode: 'follow',
  magnifierSpotlight: false,
  magnifierSpotlightDim: 0.45,
  magnifierTouchPos: 'above',
  keepLensOnSlideChange: false,
  keepZoomOnSlideChange: false,
  keepPenWidthOnZoom: true,
  tapZoomLevel: 2.5,
  // MIC-AI: Microphone defaults
  micAutoOffMinutes: 10,
  muteMicOnBoard: false,
  pushToTalk: false,
  showMicDotInZen: true,
  // MIC-AI: AI Router defaults
  aiQualityPreference: 'balanced',
  aiWarnAfterCalls: 0,
  aiTaskPinnedModels: {},
  aiProviderPriority: ['gemini', 'anthropic', 'openai', 'grok', 'groq', 'deepseek', 'mistral', 'openrouter', 'perplexity', 'custom'],
  // INKFIX: Smart Ink defaults
  smartInkEnabled: true,
  smartInkSensitivity: 'normal',
  smartInkHoldToSnap: true,
  smartInkShapeDelayMs: 450,
  smartInkHighlighterDelayMs: 250,
  smartInkTextDelayMs: 1000,
  smartInkConvertText: 'word',
  smartInkAiAssist: true,
  smartInkCorrectionLevel: 'light',
  smartInkInspectorEnabled: false
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
}
