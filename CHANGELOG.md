# Changelog — Smart Studio Presenter Pro

All notable changes to "Smart Studio Presenter Pro" are documented in this file.

## [1.4.0] — 2026-10-24 (Economy AI Mode, Quota Safe Fallback, Code-First Ink & Resizable Panel)

### 🤖 Part B & C — Principle: Code First, API Only When Needed & Economy AI
- **No-API Audit & Deterministic Execution**:
  - Audited all AI calls across the codebase; removed unnecessary API triggers. Highlighting, line straightening, geometric shape recognition, slide navigation, and glossary normalization now run 100% in deterministic code without requiring an API key, quota, or network connection.
  - Shape recognition defaults to pure geometry (`smartInkAiAssist: false`); Smart Text handwriting OCR (`✍→Aa`) defaults to OFF at launch.
  - Zero pre-warm or background API calls on app startup or slide change.
- **Dynamic Model Catalog (`src/ai/modelCatalog.ts`)**:
  - Dynamically discovers and ranks models without hardcoded assumptions.
  - Default mode is **Economy**: prefers `gemini-2.0-flash-lite`, then `gemini-1.5-flash-8b`, then standard Flash. Automatically excludes retired/deprecated models (e.g. `gemini-1.0-pro`, `text-bison`).
  - Added Quality Preference setting: **Economy (Default)**, **Balanced**, and **Best**.
  - Added *"बेहतर जवाब / Better answer"* button under assistant replies to re-ask questions with the next stronger tier on-demand.
- **Quota Cooldown Manager & Friendly Errors (`src/ai/quotaManager.ts`)**:
  - Structured HTTP 429 parser distinguishing per-minute rate limits (brief backoff) from daily free quota limits (persisted lockout until stated reset time).
  - Persisted cooldown map (`ssiro_model_cooldown_v1`) in localStorage prevents repeated failing calls.
  - Automatic within-provider model fallback chain: switches smoothly from exhausted model to next economy model with non-blocking toast.
  - Friendly Hindi/English error cards replace raw JSON/URL dumps; sensitive keys (`AIza***[MASKED]`, `sk-***[MASKED]`) masked in technical details.
  - Full word wrapping (`overflow-wrap: anywhere`) eliminates horizontal scrollbars.
- **Token Minimization & 24h Response Cache (`src/ai/responseCache.ts`)**:
  - Short system prompts (<60 tokens) and configurable Answer Length (*Short* ~300 / *Normal* ~600 / *Detailed* ~1500 tokens).
  - Disabled hidden thinking tokens (`thinkingBudget: 0`) on Gemini 2.0+ models.
  - Text-before-pixels for *"Explain this slide"*: sends extracted PDF text layer; downscales image to $\le 1024$px JPEG quality 0.8 only when no text layer exists.
  - Trimmed chat history to last 4 turns / 1500 tokens, truncating earlier assistant replies to 200 characters.
  - 24-hour IndexedDB response cache serves identical queries instantly with zero token consumption and a *"✓ cached"* badge.
  - Real-time usage meter in panel footer and Settings ➔ AI (calls today, tokens in/out from provider metadata, active model).

### 🖥️ Part C6 — Resizable & Dockable Assistant Panel UI (`src/ui/geminiPanel.ts`)
- **Interactive Sizing & Docking**:
  - Drag handles on edges and corners for fluid resizing (width 280px–85vw, height 240px–100vh).
  - Dock modes: **Right (Default)**, **Left**, **Bottom**, and **Floating**, persisted per device.
  - Dedicated Maximize button for full-screen answers, Minimize button for collapsed bar that never obstructs drawing, and Esc key shortcut.
  - Typography controls: $A-$ / $A+$ buttons to dynamically scale font size.
  - Quick action chips above input: *"स्लाइड का सार"*, *"मुख्य बिंदु"*, *"सरल हिंदी में समझाओ"*, *"5 क्विज़ प्रश्न"*, *"यहाँ क्या स्पष्ट नहीं है"*.
  - Per-message Copy button and *"स्लाइड पर लिखें / Put on slide"* button to insert responses as editable text objects.
  - Chrome omnibar Ask Gemini footnote guide.

### 🎨 Part D — Ink by Code (Highlighter, Underlines, Shapes)
- **Highlighter Clean Band <= 0.15s (`src/smartink/smartInkController.ts`)**:
  - Purely in code: calculates principal stroke axis and converts freehand highlighter sweeps into clean horizontal bands with flat butt caps within 150ms.
  - Snaps to text lines using the PDF text layer or pixel profiles with 2px padding and word boundary alignment.
  - Brightness-aware blend modes: `multiply` at alpha 0.32–0.35 on light slides; `screen` at alpha 0.35 on dark blackboard slides to preserve text legibility.
- **Underline Straightening <= 0.3s**:
  - Forgiving tolerance ($\le 6\%$ RMS deviation, $\le 8\%$ max deviation, $\ge 60$px length) with 12° horizontal/vertical snap.
  - Snaps under slide text at baseline $+ 0.12 \times \text{lineHeight}$.
- **Geometric Shapes <= 0.45s**:
  - Fast offline recognition for lines, circles, ellipses, rectangles, squares, triangles, diamonds, and single/multi-stroke arrows.
  - Text-vs-shape guard protects Devanagari characters, matras, and small handwriting from false conversions.
  - Transactional invariant: raw ink is never deleted until clean geometry commits; rollback restores raw ink on any error.

### 🎙️ Part E — Local Voice Commands Dictionary (`src/voice/commandsDict.ts`)
- **Expanded Hindi & English Grammar**:
  - Support for ordinals up to 50 (*पहली*, *दूसरी*, *तीसरी* ... *पचासवीं*), Devanagari digits (*१* - *५०*), Hindi number words, and English numbers.
  - Full synonym registry covering navigation, tools (pen, marker, eraser, lens), colors, board toggle, zoom, fullscreen, and mic mute.
  - Automatic conversational filler word stripping (*भैया*, *यार*, *ज़रा*, *कृपया*, *प्लीज*, etc.).
  - Icon-only visual feedback (e.g. 🎙️ ➡️, 🎙️ ✏️); zero spoken transcripts displayed or stored.
  - Local "Write here" anchor resolution without AI.

### 🌐 Part C5 & F — Optional Chrome Built-in AI & WebMCP Layers
- **Chrome On-Device AI (`src/ai/providers/chromeBuiltIn.ts`)**:
  - Added optional on-device provider utilizing `window.ai.languageModel` (Gemini Nano in desktop Chrome), disabled by default with diagnostic test in Settings.
- **WebMCP Tool Integration (`src/ai/webMcp.ts`)**:
  - Experimental agent layer registering presentation tools (`next_slide`, `previous_slide`, `goto_slide`, `toggle_board`, `clear_slide`, `write_text`) with destructive confirmation safety guards.

---

## [1.3.0] — 2026-10-24 (Smart Ink Repair, Transactional Conversions & Voice Write Commands)

### ✍️ Part B — Transactional Conversions & Invariant Guarantees (Ink Never Vanishes)
- **Transactional Conversion Engine (`src/smartink/transaction.ts`)**:
  - Replaced destructive stroke deletion (`eraseStrokeAt(point, 2000)`) with synchronous transactional commit/rollback (`InkTransaction`).
  - Raw strokes remain stored in `annotationStore` marked with `replacedBy: conversionId` (hidden from rendering) and are never deleted when a conversion runs.
  - Development-time invariant assertion: visible ink count on slide is never reduced by an automatic conversion.
  - Instant rollback on error, network drop, timeout, or slide change: raw ink remains visible exactly as drawn.
  - Preserved raw strokes are retained for 60 seconds to support Undo chip and normal Undo button.

### 📏 Part C — Underline vs. Shirorekha & Baseline Snapping
- **Classifier Rule (`src/smartink/classifier.ts`)**:
  - Differentiates Hindi/Devanagari *shirorekha* from underlines: a stroke with 2+ glyph strokes hanging below remains part of the text word. A stroke below text or in the bottom 20% of handwriting is classified as an underline.
  - Tolerant line straightening: RMS lateral deviation $\le 6\%$ (for aspect ratio $\ge 8:1$) or max deviation $\le 8\%$, min length $\max(60\text{px}, 4\% \text{stage width})$.
  - Snapping to horizontal/vertical within 12° of axis.
- **Baseline Alignment (`src/smartink/textLines.ts`)**:
  - Snaps hand-drawn underline directly under text line at baseline $+ 0.12 \times \text{lineHeight}$.
  - Snaps outward to word boundaries (or full text width if spanning $\ge 80\%$).

### 🔷 Part D — Tolerant Shape Fitting & Hold-to-Snap
- **Forgiving Geometric Fitter (`src/smartink/shapeFitter.ts`)**:
  - Implemented Normal sensitivity thresholds: closed shape closure gap up to 25%, circle residual $\le 9\%$, rectangle angles $90^\circ \pm 18^\circ$, square ratio 0.88–1.12, RDP $\epsilon = 3.5\%$, corner merge $<10\%$.
  - Fits boxes, squares, circles, ellipses, triangles, diamonds, and arrows (single and multi-stroke).
  - Minimum size guard (diagonal $\ge 40$px) to avoid snapping tiny marks or text characters.
- **Hold-to-Snap Gesture**:
  - Holding stylus/pointer still for 0.5s before lifting triggers instant snap on release with a countdown ring indicator.
- **AI-Assisted Shape Recognition (Second Opinion)**:
  - Added router task profile `shape-classify` (vision, fast tier, temp 0, max 40 tokens) for uncertain strokes ($0.35 \le \text{confidence} < 0.6$). Local geometry fitter is forced to the AI's label.

### ⚡ Part E — Speed & Speculative Recognition
- **Optimized Delay Profiles**:
  - Shape snap delay: 0.45s (default; range 0.2–1.5s).
  - Highlighter snap delay: 0.25s.
  - Text conversion delay: 1.0s (default; range 0.6–3.0s; whole line mode: 2.0s).
- **Speculative Recognition**:
  - Starts background AI OCR after 500ms of idle time. If the user draws again, the request is cancelled via `AbortController`. If user pauses, result appears immediately without compound network delay.

### 📝 Part F — Word-Level Conversion (Never Letter-by-Letter)
- **Word Clustering (`src/smartink/wordGrouper.ts`)**:
  - Clusters strokes into words using horizontal gap threshold $0.35 \times \text{glyphHeight}$ and Devanagari shirorekha connectivity.
  - Conversion unit is a complete word object with individual bounding box and typography (Noto Sans Devanagari for Hindi, Inter for English).
  - Isolated single strokes and matras wait for neighbouring glyphs and remain untouched if incomplete.
  - Sentence continuation appends words to the right on the same baseline with previous text context sent to AI.

### 🎙️ Part G — Voice Write Commands ("Write This Here")
- **Grammar & Anchor Resolution (`src/voice/writeCommand.ts`)**:
  - Parses Hindi & English write commands: *"आगे विष्णु लिखो"*, *"तीर के आगे लिखो"*, *"इसके अंदर लिखो"*, *"बीच में लिखो"*, *"यहाँ लिखो"*, *"शीर्षक लिखो"*, *"पिछला मिटाओ"*, *"बड़ा/छोटा करो"*.
  - Anchors text relative to most recent arrow (at head with directional offset), shape center, line below, or pointer position.
  - Privacy guarantee: raw spoken command is never toasted or stored; only the resulting text object appears with a 600ms highlight ring.
  - Normalizes educational vocabulary (e.g. *Vishnu* $\rightarrow$ *विष्णु*, *Aryabhata* $\rightarrow$ *आर्यभट्ट*).

### 🔬 Part H — Diagnostics, Inspector & Test Suite
- **Smart Ink Inspector (`src/smartink/inspector.ts` & `src/ui/smartInkSettingsSection.ts`)**:
  - Settings $\rightarrow$ Smart Ink Inspector toggle with real-time log of the last 20 conversion decisions (tool, features, class scores, branch taken, AI call latency, result, reason).
  - "📋 कॉपी रिपोर्ट (Copy Report)" button for easy diagnostic export.
- **Automated Test Suite (`tests/smartink.test.ts`)**:
  - 25 automated unit and integration tests covering underline straightening, ink invariant, mouse jitter rejection, shapes recognition accuracy ($\ge 95\%$), word-level grouping, and voice write commands. All 25 tests passing.


### 🎙️ Part B — Microphone Control & Privacy Protection
- **Root Cause Fix & Complete Audit**:
  - Audited codebase and eliminated unprompted auto-listening on startup and un-gated auto-restart loops in `src/voice/commands.ts`.
  - Confirmed zero occurrences of `MediaRecorder`, `AudioContext`, or audio buffering; the app records/stores no audio files or buffers anywhere.
- **State Machine (`src/voice/micController.ts`)**:
  - Single source of truth: `micState = 'off' | 'listening' | 'error'`.
  - Strictly `off` by default on launch, reload, slide change, browser return, and window blur (>30s). No setting remembers or auto-turns-on the mic.
  - Transitions to `listening` only via physical user interaction: toolbar 🎙 Mic button, keyboard shortcut `V`, or push-to-talk.
  - Complete audio pipeline release on mute: calls `recognition.abort()`, detaches all handlers, stops restart loops, and terminates any opened `MediaStream` tracks (`track.stop()`) so the browser/Android status mic-in-use indicator turns off immediately.
  - Added auto-off idle timer (default 10 minutes of no recognized command; settings range off/5/10/30).
  - Added spoken mute command: *"stop listening / माइक बंद करो"* mutes the microphone.
- **Visual Indicators & Controls**:
  - Added 🎙 Mic button to Tier 1 floating toolbar (56px touch target / 64px on 4K boards, labeled "माइक / Mic") between Clear and More tools.
  - Off: grey icon with diagonal slash; Listening: solid icon, red background, soft pulsing ring, live 3-bar animated input meter; Error: amber with "!".
  - Top bar mirror mic icon (`#btnMicHeader`) next to fullscreen button.
  - 12px pulsing red dot (`#micZenDot`) top-right in Zen mode ensures presenter awareness.
  - Ghost mode keeps mic button at $\ge 60\%$ opacity when toolbar dims.
  - Debounced toasts ("🎙️ माइक चालू / Mic ON", "🔇 माइक बंद / Mic OFF").
- **Settings → Voice Section**:
  - Configurable Voice language (`hi-IN` / `en-IN`), Auto-off timer, Mute mic on Board toggle, Push-to-talk toggle, and Zen red dot toggle.
  - Honest privacy disclaimer: *"In Chrome/Android WebView, speech recognition is performed by the browser's speech service, which may send audio to its provider while the mic is on. This app does not record or save audio."*

### 🤖 Part C — Multi-Provider AI Router & Key Vault
- **Universal Multi-Provider Architecture (`src/ai/`)**:
  - Unified entry point `aiRouter.run(task, payload)` replaces all direct Gemini calls.
  - Central provider registry supporting: Google Gemini, Anthropic Claude, OpenAI, xAI Grok, Groq, Mistral, DeepSeek, OpenRouter, Perplexity, and Custom OpenAI-compatible endpoints.
  - Multi-key AES-GCM 256-bit unextractable vault in IndexedDB (`src/ai/keyVault.ts`) with seamless automatic migration of pre-existing Gemini keys.
- **Key Auto-Detection & Validation**:
  - Instant key shape detection (`AIza`, `sk-ant-`, `xai-`, `gsk_`, `sk-or-`, `pplx-`).
  - Parallel probe against candidate `/models` endpoints for ambiguous keys (`sk-...`, Mistral, DeepSeek).
  - Live connection verification before key acceptance.
- **Model Discovery, Ranking & Dynamic Best-Model Selection**:
  - Automated model listing from `/models` endpoints with 24-hour persistent caching.
  - Task profiles (`chat`, `slide-explain`, `handwriting-ocr`, `text-fix`, `quick-answer`).
  - Tiered ranking rules (`flagship`, `balanced`, `fast`) and Quality preference (Best quality, Balanced, Fastest/cheapest).
  - Automated fallback chain across provider models and secondary providers with non-blocking feedback toasts.
  - Immediate request cancellation (`AbortController`) on slide change or panel closure.
- **CORS Handling & Platform Reality (`src/ai/http.ts`)**:
  - Android APK: routes requests through `CapacitorHttp` natively, bypassing browser CORS restrictions.
  - Desktop PWA/PC: displays clear, helpful guidance for CORS-blocked providers without introducing external proxy servers.
- **UI & Feature Rewiring**:
  - `src/ui/geminiPanel.ts`: converted to general AI Assistant showing dynamic provider/model badges (`Provider • Model`).
  - `src/draw/handwriting.ts`: routed through `aiRouter.run('handwriting-ocr', ...)`; preserves ink untouched if no vision provider is configured.
  - Settings → AI panel (`src/ai/aiSettingsPanel.ts`): key manager, test/replace/delete actions, quality selector, model allocations, call counter, and cost warning safeguard.

## [1.1.1] — 2026-10-24 (Welcome Screen Persistent Home & No Default Deck Fix)

### 🚀 Welcome-Fix: Persistent Home Screen & No Auto-Loaded Deck
- **No Default Deck Ever**:
  - Removed all automatic startup loaders for sample decks (`slideView.loadInitialDeck()` on startup disabled).
  - App state initial value is strictly `'welcome'` and `currentDeck` starts as `null`.
  - Kept demo deck strictly as an optional developer helper behind `Settings → Advanced → Load demo deck`.
- **Explicit App State System**:
  - Introduced explicit `appState = 'welcome' | 'deck' | 'board'`.
  - Transitions to `'deck'` only when user selects a file (Open Deck button, Drag & Drop, or OS `launchQueue`).
  - Transitions to `'board'` only when Board is toggled. Closing Board returns to `'deck'` if a deck is loaded, or back to `'welcome'` if not.
- **Persistent Welcome Home Screen**:
  - Welcome screen no longer auto-dismisses after 2.8s and no longer skips on stray taps or keys.
  - Replaced "Tap to start" with touch-friendly primary button **"डेक खोलें / Open Deck"** (min 64px touch target) and drop zone text **"PDF / PPTX यहाँ खींचकर छोड़ें / drag & drop a file here"**.
  - Smooth 300ms fade transition into slide 1 upon loading a deck; if loading fails, stays on welcome screen and displays a bilingual error toast.
- **Strict Welcome State Inertness**:
  - In `'welcome'` state, arrow keys, space, swipes, edge clicks, and drawing input are completely inert and do not draw or change state.
  - Allowed commands in welcome state: Voice commands *"board/बोर्ड"*, *"open/खोलो"*, and *"fullscreen/फुलस्क्रीन"*, plus top header buttons (Open Deck, Board, Zen Fullscreen).
  - Slide counter, slide title, navigation chevrons, drawing toolbar, and bottom caption are cleanly hidden.
- **Return to Home & Close Deck**:
  - Added "Close Deck" (✕) button in top bar and inside Settings Panel.
  - Prompts for confirmation if uncommitted annotations exist, resets zoom, clears pinned lenses, clears media windows, and cleanly returns to the welcome home screen.
- **Settings & Compact Mode**:
  - "Show welcome screen" toggle: when turned off, displays compact clean home screen (logo, app name, Open Deck button, no animation) without opening any deck.
  - Bumped version to `v1.1.1` and PWA cacheId to `ssiro-smart-studio-v1.1.1`.

## [1.1.0] — 2026-10-24 (SSIRO Classes Update)

### 🌟 Part B — Update 1: Fullscreen Welcome Screen ("Welcome to SSIRO Classes")
- **Fullscreen Launch Splash**:
  - Implemented 100vw × 100dvh splash screen displaying "Welcome to SSIRO Classes" on every app launch across desktop browsers, installed PWAs, and Android windows.
  - Sizing configured via `clamp(40px, 7.5vw, 160px)` with two balanced visual lines ("Welcome to" in white, "SSIRO Classes" in gold gradient `#FFD76A` → `#E8890C`).
  - Deep navy gradient background (`#14306B` → `#0A1633`) with faint animated gold glow and drawing underline animation.
  - Bundled heavy Devanagari and Latin typography (*Noto Sans Devanagari 800*, *Inter 800*, *Poppins 800*).
  - Skips on tap/click/key after 800ms; automatically cross-fades (300ms) into presentation deck after 2.8s.
  - Silently pre-warms PDF worker, local fonts, and settings during splash display for instantaneous home screen transitions.
  - Critical inline CSS in `index.html` guarantees zero white-flash on cold start.
  - Added OS File Handler `launchQueue` consumer support to open files immediately after welcome dismissal.
- **Brand & Settings Customization**:
  - Added `src/brand.ts` with customizable `WELCOME_LINE_1 = 'Welcome to'` and `WELCOME_LINE_2 = 'SSIRO Classes'`.
  - Added new "Welcome Screen" settings section in Settings panel with toggles for visibility, custom text lines, and duration (1–5s).

### 🔍 Part C — Update 2: Magnifier Lens & Whole-Slide Zoom
- **Magnifier Lens (`src/zoom/magnifierLens.ts`)**:
  - Dedicated canvas at `z-index: 38` with high-resolution clipping.
  - **Follow Mode**: Smooth lerp easing (0.35 per frame in rAF) toward stylus hover, finger drag, or mouse pointer with ≤ 4px error at rest.
  - For touch input, lens sits ergonomically above the fingertip (`radius + 24px`) flipping below if close to stage ceiling.
  - Renders directly from cached 3× `ImageBitmap` with high smoothing quality—never upscaling a screenshot.
  - Composites annotation ink, blackboard backgrounds, and video overlays seamlessly inside the lens.
  - **Pin Lens Mode**: Long-press (500ms) or Alt+click pins a lens (up to 3 pinned lenses).
  - Pinned lenses feature 4px gold gradient ring, corner resize handle, magnify (+/-) buttons, ✕ close button, and 🔒 Fixed (retains pinned slide area) vs 🔍 Glass (magnifies current stage area) toggle.
  - Pinned lenses automatically clear on slide change in accordance with auto-erase rules (customizable via `keepLensOnSlideChange` setting).
  - **Spotlight Dim Layer**: Layer at `z-index: 37` dims stage by 45% with clean cutouts for active and pinned lenses.
  - Keyboard & Wheel shortcuts: `Wheel` changes zoom factor (0.25× step); `Shift+Wheel` changes lens size; `M` toggles tool; `Esc` deactivates tool.
- **Whole-Slide Zoom & Pan (`src/zoom/zoomController.ts`, `src/zoom/zoomGestures.ts`)**:
  - Wrapped `slideCanvas`, `mediaLayer`, `annotationCanvas`, and `previewCanvas` in `#zoomRoot` with hardware-accelerated CSS transform.
  - Inverse coordinate transformation in `core/layers.ts` and `draw/engine.ts` stores strokes in slide-space so ink stays permanently attached to slides at any zoom level.
  - Added "Keep pen width constant on screen while zoomed" setting (`keepPenWidthOnZoom`, default on).
  - Multi-touch pinch-to-zoom (1× to 8×) centered at finger midpoint with limit rubber-banding.
  - Inertial panning with 0.92 friction; clamps bounds so slides always cover the stage with zero margin gaps.
  - Tap-to-zoom (animates to 2.5×) with double-tap returning to 1× when Zoom tool is active.
  - Conflict resolution: double-tap toggles toolbar in Zen mode for all drawing tools; when Zoom tool is active, double-tap toggles zoom and toolbar can be opened with drag handle or 3-finger tap.
  - Transient zoom level indicator (e.g., "2.5×") and floating 1× reset chip.
  - Voice commands: *"magnifier/मैग्नीफ़ायर"*, *"zoom in/झूम इन"*, *"zoom out/झूम आउट"*, *"reset zoom/झूम हटाओ"*, *"spotlight/स्पॉटलाइट"*.
- **Hi-Res Patch Manager (`src/zoom/hiResPatch.ts`)**:
  - Debounced (120ms) visible crop rendering with `pdfjs-dist` when display scale exceeds cached bitmap density.

### 🎨 Part D — Update 3: PWA Logo & App Icons
- **Official Master SVG Brand Logo**:
  - Saved official master SVG at `assets/brand/logo.svg` (deep navy `#0A1633` background, gold gradient ring and handle, glass radial gradient, lotus petals, and light reflection arc).
- **Automated Icon Generation Pipeline (`scripts/generate-icons.mjs`)**:
  - Automated `npm run icons` using Sharp to export:
    - `public/icons/icon-192.png` (192×192)
    - `public/icons/icon-512.png` (512×512)
    - `public/icons/maskable-512.png` (512×512 full bleed background with 0.78 scale safe zone)
    - `public/apple-touch-icon.png` (180×180)
    - `public/favicon.svg`
    - `public/favicon-32.png`
    - `public/favicon.ico` (multi-resolution 16/32/48 ICO)
- **PWA Manifest & Cache Refresh**:
  - Updated `manifest.webmanifest` and `vite.config.ts` with `#0A1633` theme and background colors.
  - Bumped cacheId to `ssiro-smart-studio-v1.1.0` and package version to `1.1.0` to trigger the "New version ready — Reload" toast on existing installations.

---

## [1.0.0] — 2026-10-24
- Initial release of Smart Studio Presenter Pro for *Decoding Indology*.
