export interface AppSettings {
  language: 'hi' | 'en';
  fitMode: 'fit' | 'fill' | 'stretch';
  renderQuality: 'auto' | '3x' | '2x';
  autoEraseOnSlideChange: boolean;
  keepAnnotationsPerSlide: boolean;
  toolbarIdleSeconds: number;
  toolbarDimmedOpacity: number;
  toolbarPos: { x: number; y: number } | null;
  toolbarScale: number;
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
  // AUDIT-FIX: BUG-007 - Custom branding logo per WEL-6
  customLogo?: string;
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
  aiQualityPreference: 'economy' | 'balanced' | 'best' | 'fast';
  aiWarnAfterCalls: number;
  aiTaskPinnedModels: Record<string, { provider: string; model: string }>;
  aiProviderPriority: string[];
  // ECON: Token minimization & Provider settings
  aiAnswerLength?: 'short' | 'normal' | 'detailed';
  chromeAiEnabled?: boolean;
  webMcpEnabled?: boolean;
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
  // ECON: Highlighter blend mode
  smartInkHighlighterBlend?: 'auto' | 'multiply' | 'screen';
  // AUDIT-FIX: BUG-009, BUG-010 - Streaming, Clean Broadcast & Crop Settings per ZEN-5, ZEN-6
  streamRemainderMode: 'background' | 'blur' | 'black';
  hideToolbarCompletelyOnIdle: boolean;
  hideCursorWhenIdle: boolean;
  streamFrameLock: 'none' | '16:9' | '16:10' | '4:3';
  autoTrimMargins: boolean;
  manualCropTop: number;
  manualCropBottom: number;
  manualCropLeft: number;
  manualCropRight: number;
  // TOOLBAR: Shape & Tool Idle Revert (15s default, 0 = stay on tool forever)
  autoRevertToPenSeconds?: number;
}

const SETTINGS_STORAGE_KEY = 'smart_studio_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'hi',
  fitMode: 'fill',
  renderQuality: 'auto',
  autoEraseOnSlideChange: true,
  keepAnnotationsPerSlide: false,
  toolbarIdleSeconds: 4,
  toolbarDimmedOpacity: 0.2,
  toolbarPos: null,
  toolbarScale: 1.0,
  defaultPenSize: 4,
  defaultPenAlpha: 1,
  defaultHighlighterWidth: 32,
  defaultHighlighterAlpha: 0.25,
  defaultEraserSize: 36,
  eraserMode: 'stroke',
  handwritingDelayMs: 1800,
  handwritingProvider: 'gemini',
  voiceLang: 'hi-IN',
  geminiModel: 'gemini-3.5-flash',
  boardDefaultTheme: 'slate',
  clearMediaOnSlideChange: false,
  channelName: 'SSIRO Classes',
  // SSIRO-UPDATE: Welcome screen defaults
  showWelcomeScreen: true,
  welcomeLine1: 'Welcome to',
  welcomeLine2: 'SSIRO Classes',
  welcomeDuration: 2.8,
  customLogo: '',
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
  // ECON: Economy mode default (Part C1)
  aiQualityPreference: 'economy',
  aiWarnAfterCalls: 0,
  aiTaskPinnedModels: {},
  aiProviderPriority: ['gemini', 'anthropic', 'openai', 'grok', 'groq', 'deepseek', 'mistral', 'openrouter', 'perplexity', 'custom'],
  // ECON: Token minimization defaults
  aiAnswerLength: 'normal',
  chromeAiEnabled: false,
  webMcpEnabled: false,
  // INKFIX: Smart Ink defaults
  smartInkEnabled: true,
  smartInkSensitivity: 'normal',
  smartInkHoldToSnap: true,
  smartInkShapeDelayMs: 450,
  // ECON: Smart highlighter delay 0.15s per Part D1
  smartInkHighlighterDelayMs: 150,
  smartInkTextDelayMs: 1000,
  smartInkConvertText: 'word',
  // ECON: AI shape assistance defaults to OFF (Part B / D3)
  smartInkAiAssist: false,
  smartInkCorrectionLevel: 'light',
  smartInkInspectorEnabled: false,
  smartInkHighlighterBlend: 'auto',
  // AUDIT-FIX: BUG-009, BUG-010 - Streaming & crop defaults
  streamRemainderMode: 'background',
  hideToolbarCompletelyOnIdle: false,
  hideCursorWhenIdle: false,
  streamFrameLock: 'none',
  autoTrimMargins: false,
  manualCropTop: 0,
  manualCropBottom: 0,
  manualCropLeft: 0,
  manualCropRight: 0,
  autoRevertToPenSeconds: 15
};

export function generateSyncUrl(settings?: AppSettings): string {
  try {
    const s = settings || loadSettings();
    const jsonStr = JSON.stringify(s);
    const encoded = btoa(encodeURIComponent(jsonStr));
    const base = window.location.origin + window.location.pathname;
    return `${base}#sync=${encoded}`;
  } catch {
    return window.location.href;
  }
}

export function loadSettings(): AppSettings {
  try {
    // Check if URL contains sync payload from PC (e.g. #sync=... or ?sync=...)
    if (typeof window !== 'undefined' && window.location) {
      let syncPayload: string | null = null;
      if (window.location.hash && window.location.hash.includes('sync=')) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        syncPayload = hashParams.get('sync');
      } else if (window.location.search && window.location.search.includes('sync=')) {
        const searchParams = new URLSearchParams(window.location.search);
        syncPayload = searchParams.get('sync');
      }

      if (syncPayload) {
        try {
          const jsonStr = decodeURIComponent(atob(syncPayload));
          const imported = JSON.parse(jsonStr);
          if (imported && typeof imported === 'object') {
            const merged = { ...DEFAULT_SETTINGS, ...imported };
            saveSettings(merged);
            // Clean URL hash/query so the URL stays pristine
            window.history.replaceState({}, document.title, window.location.pathname);
            window.setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent('app-toast', {
                  detail: {
                    message: '✅ PC की सेटिंग्स डिजिटल बोर्ड पर सफलतापूर्वक लोड हो गईं! (Settings Synced)',
                    isError: false
                  }
                })
              );
            }, 800);
            return merged;
          }
        } catch (e) {
          console.warn('Sync payload parse failed:', e);
        }
      }
    }

    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    // Auto-migrate legacy 'fit' to 'fill' for 100% full screen smart board presentation
    if (parsed.fitMode === 'fit') {
      parsed.fitMode = 'fill';
    }
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
