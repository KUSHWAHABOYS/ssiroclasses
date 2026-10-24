# Smart Studio Presenter Pro (स्मार्ट स्टूडियो प्रस्तुतकर्ता प्रो)

> **Designed for Hindi YouTube Educator (*Decoding Indology*)**  
> Optimized for 75"–86" Android 4K Smart Boards (Touch + Stylus/Finger) & PC/Laptop Screen-Shared to StreamYard / OBS Studio.

---

## 🌟 Key Architecture & Highlights

1. **100% Client-Side & Zero-Server Dependency**:
   - Zero database, zero telemetry, zero accounts.
   - All presentation decks, cached pages, settings, and AES-GCM encrypted vault tokens remain strictly on your local device.
   - Fully functional offline as an installed PWA or Android APK.

2. **Ultra-Sharp 4K Rendering**:
   - High-fidelity PDF rendering with 3× supersampling and local Web Worker.
   - Intelligent **Fit vs Fill** engine: Sampled dominant corner-color background filling eliminates ugly black bars without stretching or distorting slides.
   - Pre-rendered 5-page LRU cache for instantaneous slide transitions (< 100 ms).

3. **Guaranteed Synchronous Auto-Erase**:
   - Navigating slides synchronously purges drawing canvases and resets in-progress strokes in one render frame, guaranteeing zero flash of old ink.

4. **Floating 360° Draggable 2-Tier Toolbar**:
   - Large-target touch UI (≥ 56 px on mobile/PC, 64–76 px on 4K boards).
   - **Ghost Mode**: Dims to 20% opacity after 4 seconds of idle time and restores to 100% instantly on touch, mouse hover, or keypress (remains fully interactive while dimmed).
   - Tier 1: Select, Pen, Translucent Marker, Eraser, 6 Swatches, Undo, Clear All, More (+).
   - Tier 2: Shapes (Rectangle, Circle, Line), Smart Arrow, ✍ ➔ Aa Handwriting-to-Text, Media Overlay, In-App Browser, Gemini AI, Blackboard Studio, Settings, Zen Fullscreen.
   - In-place popovers directly above active tools for precision brush size, opacity, and eraser modes.

5. **Universal Blackboard Studio**:
   - 100% viewport blackboard with 5 studio themes:
     - Classic Black Slate (`#111111`)
     - Green Chalkboard (`#2F4F3F` with subtle chalk dust texture)
     - **Pure Studio Chroma Green (`#00FF00`)**: Exact flat color with zero gradient, texture, or vignette for seamless OBS/StreamYard chroma keying. Pen palette automatically adapts to chroma-safe colors (green removed).
     - Navy Blue (`#0B1F3A`)
     - Maths Grid (`#131823` with 40 px grid at 12% alpha)
   - Bottom-anchored control dock for ergonomic reach on wall-mounted 86" boards.

6. **Multimedia Floating Windows & Comparison**:
   - Up to 4 floating video (.mp4/.webm) and image (.jpg/.png/.webp) windows with 4-corner resizing and custom video controls.
   - **Side-by-Side 50/50 Compare**: One-tap comparison layout with synchronized play/pause.
   - Layer isolation: In Drawing mode, you can write and annotate directly on top of a playing video!

7. **Handwriting-to-Text Typography**:
   - Word grouping algorithm with proximity threshold.
   - 1.8-second pause triggers AI transcription via Google Gemini Vision (black ink on white cropped snippet).
   - Replaces handwriting with crisp typography using bundled Devanagari (*Noto Sans Devanagari*) or Latin (*Inter*) fonts.
   - 3-second floating "Undo Conversion" chip restores original strokes.

8. **Multi-Provider AI Assistant & Key Vault**:
   - Universal `aiRouter` supports Google Gemini, Anthropic Claude, OpenAI, xAI Grok, Groq, Mistral, DeepSeek, OpenRouter, Perplexity, and Custom endpoints.
   - 256-bit AES-GCM encryption with non-extractable `CryptoKey` in IndexedDB.
   - Keys are decrypted in memory only during active requests, masked as `••••••••XXXX`, and never sent to any server other than the provider's official base URL.
   - Quality tiers (Best, Balanced, Fast) and automatic best-model selection for each task (Chat, Slide Explain, Smart Ink OCR).
   - "Explain Slide with Vision" analyzes the current slide screenshot to assist during live streams.

9. **Explicit Microphone Control & Privacy Protection**:
   - Strictly `off` by default everywhere (launch, reload, slide navigation, blur, board entry).
   - Dedicated 🎙 Mic button on Tier 1 toolbar, mirror icon in top bar, and 12px Zen dot.
   - Complete pipeline release on mute (`recognition.abort()`, track termination) guarantees the browser/Android mic indicator turns off immediately.
   - Spoken mute command: *"stop listening / माइक बंद करो"*.
   - Auto-off idle timer (10 min default), Push-to-talk (`V` key hold), and honest privacy disclosure.

---

## 🎙️ Microphone Control (माइक नियंत्रण)

### Strict User-Gated State Machine
- **State Definition**: `micState = 'off' | 'listening' | 'error'`.
- **Default State**: Strictly `off` on every launch, page reload, slide transition, return from the in-app browser, and window blur longer than 30 seconds. No setting or storage persists an "auto-on" state.
- **Activating Listening (`off` → `listening`)**:
  - Direct user action only: tap/click the 🎙 Mic button, press keyboard shortcut `V`, or hold the button/shortcut in Push-to-talk mode.
  - Spoken voice commands can **never** turn the mic on.
  - Microphone permissions are never requested at launch—only upon the user's first explicit toggle.
- **Deactivating (`listening` → `off`)**:
  - Tap the 🎙 Mic button or press `V`.
  - Spoken command: *"stop listening / माइक बंद"* or *"माइक बंद करो"*.
  - Tab visibility change (switching tabs or minimizing).
  - Window blur longer than 30 seconds.
  - Opening the Blackboard (when the *"Mute mic on Board"* setting is active).
  - Auto-off idle timer (default 10 minutes of no recognized speech; configurable to off / 5 / 10 / 30 min).
  - Any recognition error or page unload.
- **True Hardware Pipeline Release**:
  - When turning off, `recognition.abort()` is called, event handlers are detached, auto-restart loops are stopped, and any active `MediaStream` tracks are terminated (`track.stop()`). The browser tab recording indicator and Android status bar mic icon turn off immediately (< 1 s).
- **Indicators**:
  - **Toolbar 🎙 Mic Button**: Tier 1 placement beside Clear and More; 56 px touch target (64 px on 4K boards). Shows diagonal slash in neutral grey when off; solid red with pulsing ring and live 3-bar animated input meter when listening; amber with "!" on error.
  - **Top Bar Mirror Icon**: `#btnMicHeader` provides instant status indication in standard mode.
  - **Zen Mode 12px Dot**: Discreet red pulsing indicator (`#micZenDot`) at top-right of stage ensures presenter awareness even in distraction-free Zen mode.
  - **Ghost Mode**: When toolbar dims, the Mic button maintains $\ge 60\%$ visibility while listening.
- **Privacy Assurance**:
  - The app itself never records, buffers, or saves audio files anywhere. Speech recognition is conducted by the browser's speech engine (Google Speech Services in Chrome / Android WebView).

---

## 🤖 AI Providers & Keys (बहु-प्रदाता AI राउटर)

### Supported Providers
Smart Studio Presenter Pro features a zero-server, multi-provider AI router (`src/ai/aiRouter.ts`) supporting:
- **Google Gemini**: Google Generative Language API via `x-goog-api-key` header (Flash 2.0, 1.5 Pro, 1.5 Flash).
- **Anthropic Claude**: Messages API with `x-api-key` and browser direct access (Claude 3.5 Sonnet, 3.5 Haiku, Claude 3.7).
- **OpenAI**: `/chat/completions` with Bearer auth (GPT-4o, GPT-4o-mini).
- **xAI Grok**: Grok-2, Grok-2 Vision.
- **Groq**: Ultra-low-latency Llama-3.3-70B, Llama-3.1-8B, Llama-3.2-11B-Vision.
- **Mistral AI**: Mistral Large, Pixtral Large (Vision), Pixtral 12B.
- **DeepSeek**: DeepSeek-Chat, DeepSeek-Reasoner.
- **OpenRouter**: Unified access to top open and commercial models.
- **Perplexity**: Sonar Pro, Sonar search-grounded models.
- **Custom Endpoint**: Any OpenAI-compatible local/remote endpoint (vLLM, Ollama, LocalAI).

### Key Vault & Migration
- **AES-GCM 256-bit Vault**: Managed in `src/ai/keyVault.ts` using non-extractable Web Crypto API keys stored in IndexedDB. Plaintext keys are never logged, never stored in localStorage, and never placed in URLs.
- **Automatic Migration**: Pre-existing Gemini keys from previous versions are migrated automatically into the multi-provider vault on first launch without breaking existing setups.
- **Key Auto-Detection**:
  - Instant detection from key prefixes (`AIza` for Gemini, `sk-ant-` for Claude, `xai-` for Grok, `gsk_` for Groq, `sk-or-` for OpenRouter, `pplx-` for Perplexity).
  - Ambiguous keys (`sk-...`) are probed in parallel against candidate `/models` endpoints to identify the correct provider automatically.

### Automated Best-Model Selection & Fallbacks
- **Task Profiles**:
  - `chat`: Optimized for deep reasoning and detailed explanations.
  - `slide-explain`: Vision-capable model with structured pedagogical analysis.
  - `handwriting-ocr`: Low latency, deterministic temperature 0.0, high precision on Devanagari and Latin ink.
  - `text-fix`: Fast and economical text cleanup.
  - `quick-answer`: Fastest response tier.
- **Quality Preferences**:
  - **Balanced (Default)**: Flagship models for Chat and Slide Explain; fast/balanced models for frequent Smart Ink handwriting conversion.
  - **Best Quality**: Highest reasoning tier across all tasks.
  - **Fastest / Cheapest**: Lowest latency and token consumption.
- **Automated Fallback Chain**: If a model encounters a rate limit, quota exhaustion, or temporary outage, the router automatically attempts the next ranked model for that provider, then falls back to secondary configured providers with a non-blocking toast.
- **Abort Control**: In-flight AI requests are immediately aborted (`AbortController`) whenever the educator changes slides or closes the AI panel.

### Browser CORS vs. Android APK
- **Browser CORS Reality**: Web browsers enforce Cross-Origin Resource Sharing. Gemini, Anthropic (with browser header), and OpenRouter permit direct web browser calls.
- **Android APK Advantage**: On the Android 4K APK build, `CapacitorHttp` natively routes provider requests, bypassing browser CORS restrictions entirely and allowing direct connections to OpenAI, Grok, Groq, Mistral, and DeepSeek.


---

## ✍️ Smart Ink & Auto-Beautify (स्मार्ट इंक)

Smart Ink automatically beautifies hand-drawn strokes into crisp geometric shapes, straight underlines, and typeset font words while guaranteeing that ink never vanishes.

### 1. Invariant Guarantee: Ink Must Never Disappear
Every conversion runs as an atomic transaction (`InkTransaction`):
- **Raw Ink Preservation**: Raw pen strokes remain stored in `annotationStore` marked as `replacedBy: conversionId` (hidden from rendering). They are never deleted when a conversion runs.
- **Invariant Assertion**: An automatic conversion can never reduce the visible ink on a slide to nothing. If an AI call fails, network drops, or JSON is invalid, the transaction instantly rolls back and restores the raw strokes exactly as drawn.
- **Undo Support**: Raw strokes stay stored for 60 seconds (or until slide change), allowing immediate restoration via the Undo chip or Undo button.

### 2. Underline & Straight Lines That Actually Work
- **Underline vs. Shirorekha Classifier**:
  - **Shirorekha**: If 2 or more glyph strokes hang below the horizontal stroke, it remains part of the Hindi/Devanagari text word.
  - **Underline**: If glyph strokes or typeset text sit above the stroke (or the stroke is in the lowest 20% of the handwriting group), it becomes a straight line.
- **Baseline Snapping**:
  - Automatically aligns to the baseline $+ 0.12 \times \text{lineHeight}$ of the text line directly above.
  - Snaps outward to word boundaries (or full text width if spanning $\ge 80\%$).
- **Tolerant Straightening**: RMS lateral deviation $\le 6\%$ (for flat strokes) or $\le 8\%$; automatically snaps to horizontal or vertical within 12° of axis.

### 3. Tolerant Shapes Recognition & Hold-to-Snap
- **Supported Shapes**: Box (rectangle), Square, Circle, Ellipse, Triangle, Diamond, and Arrow (single and multi-stroke).
- **Normal Sensitivity Thresholds**: Closed shape closure gap up to 25%, circle residual $\le 9\%$, rectangle angles $90^\circ \pm 18^\circ$, square ratio 0.88–1.12, RDP $\epsilon = 3.5\%$, corner merge $<10\%$.
- **Hold-to-Snap**: Holding the pointer/stylus still for 0.5s before lifting triggers an instant snap on release with a visible countdown ring.
- **AI Second Opinion**: Uncertain strokes (confidence 0.35–0.6) are sent to the `shape-classify` task for classification while local geometry fitters generate the clean 4K result.

### 4. Speed & Speculative Recognition
- **Low-Latency Defaults**: Shape delay 0.45s, highlighter snap 0.25s, text delay 1.0s (whole line mode: 2.0s).
- **Speculative Recognition**: Starts background AI OCR after 500ms of idle time in parallel with the remaining wait. If the educator continues writing, the request is aborted immediately; if they pause, the clean text appears instantly.

### 5. Word-Level Typeset Text
- Strokes are clustered into words using horizontal gap thresholds ($0.35 \times \text{glyphHeight}$) and Devanagari shirorekha connectivity. Lone marks and matras wait for complete words.
- Generates editable typeset word objects in Noto Sans Devanagari (Hindi) and Inter (English).
- Sentence continuation appends words to the right on the same baseline with previous words sent as context.

### 6. Smart Ink Inspector
- Located under **Settings → Smart Ink & Auto-Beautify → Smart Ink Inspector**.
- Provides a local in-memory log of the last 20 conversion decisions (time, tool, class scores, AI latency, result, reason).
- Includes a **"📋 कॉपी रिपोर्ट (Copy Report)"** button to export diagnostic logs with zero personal speech or key data.

---

## 🎙️ Voice Write Commands ("बोलकर यहाँ लिखें")

With the microphone activated, educators can dictate text directly onto the slide with intelligent anchor positioning.

### Command Grammar
Supports natural Hindi and English phrasing:
| Spoken Phrase | Placement & Meaning |
| :--- | :--- |
| **"आगे विष्णु लिखो"** / **"write Vishnu at the arrow"** | Places *विष्णु* beyond the head of the most recent arrow. |
| **"तीर के ऊपर / नीचे / पीछे ... लिखो"** | Places text above, below, or at the tail of that arrow. |
| **"इसके अंदर ... लिखो"** / **"बीच में ... लिखो"** | Centers text inside the most recent circle, box, or shape. |
| **"यहाँ ... लिखो"** / **"here ..."** | Places text at the last pen, touch, or cursor position. |
| **"शीर्षक ... लिखो"** / **"title ..."** | Top-center placement in large title typography (7% stage height). |
| **"इस लाइन के नीचे ... लिखो"** | Below the most recent straight line or underline. |
| **"पिछला मिटाओ"** / **"delete last text"** | Removes the most recently written voice text object. |
| **"बड़ा करो"** / **"छोटा करो"** | Resizes the last written text by $\pm 25\%$. |

### Privacy & Polish Guarantees
- **Zero Spoken Transcripts**: The raw spoken command is **never** displayed on screen, never toasted, and never stored. Only the intended typeset text object appears.
- **Visual Feedback**: The newly placed text appears with a 150ms fade and a soft 600ms highlight ring so the teacher sees exactly where it went.
- **Educational Glossary**: Normalizes common Indian history, science, and math terms (e.g., *Vishnu* $\rightarrow$ *विष्णु*, *Aryabhata* $\rightarrow$ *आर्यभट्ट*, *Harappa* $\rightarrow$ *हड़प्पा*).
- **Slide Boundaries & Collision**: Keeps text strictly within the 3840×2160 slide boundaries with automatic nudging to avoid overlapping existing ink.

---

## 🚀 Getting Started

### 1. Run Locally (Development)

```bash
cd smart-studio
npm install
npm run dev
```

Visit `http://localhost:5173/` in Google Chrome or Microsoft Edge.

### 2. Build for Production (PWA)

```bash
npm run build
npm run preview
```

The production assets in `dist/` include `manifest.webmanifest`, `sw.js` (Workbox offline service worker), and bundled PDF worker. Host on any static host (GitHub Pages, Netlify, Cloudflare Pages) or install locally as a standalone desktop app.

---

## 📱 Android APK Build & Board Installation

### Android Project Configuration
The project includes a ready-to-build Android Capacitor project under `android/`:
- **Orientation**: `android:screenOrientation="sensorLandscape"` in `AndroidManifest.xml`.
- **Hardware Acceleration**: `android:hardwareAccelerated="true"` and `android:largeHeap="true"` for smooth 4K 60fps drawing.
- **Microphone & Internet**: `RECORD_AUDIO` and `INTERNET` permissions declared.
- **MainActivity**: Implements `WindowInsetsControllerCompat` Immersive Sticky Mode (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`), `FLAG_KEEP_SCREEN_ON`, media playback without user gesture, and WebChromeClient permission handling.

### How to Compile the APK

1. Ensure **Android Studio** (Hedgehog or newer) with Android SDK 34 and JDK 17/21 is installed.
2. Sync web assets into Android project:
   ```bash
   npm run build
   npx cap sync android
   ```
3. Open in Android Studio or compile via command line:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
4. The generated debug APK will be located at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

### Sideloading onto Android 4K Smart Board (75"–86")

#### Method A: USB Flash Drive (Easiest)
1. Copy `app-debug.apk` onto a USB drive formatted with FAT32 or exFAT.
2. Plug the USB drive into the smart board's front or side USB port.
3. Open the smart board's built-in **File Manager** / **Finder**.
4. Navigate to the USB storage, tap `app-debug.apk`, and confirm **Install**.
   *(If prompted, allow "Install unknown apps" for File Manager in Android Settings).*
5. Open **Smart Studio** from the smart board app drawer. It will launch directly into edge-to-edge landscape fullscreen.

#### Method B: Wireless ADB
1. Enable **Developer Options** and **Network ADB Debugging** on the smart board.
2. From your PC:
   ```bash
   adb connect <SMART_BOARD_IP_ADDRESS>:5555
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 🎥 OBS Studio & StreamYard Setup Guide

### Optimal Stream Sharing Setup
1. In OBS Studio or StreamYard, select **Screen Share / Window Capture**.
2. Target the Smart Studio browser window or smart board screen.
3. Press **F** or click the **Zen** button to enter Zen Fullscreen mode.
   *(All headers, channel badges, and chevrons fade out, leaving 100% clean presentation slide space).*

### Chroma-Key Blackboard Studio Setup
1. In Smart Studio, switch to Blackboard Studio by pressing **B** or tapping the **Board** button.
2. Select the **Pure Chroma Green** theme (pill with `#00FF00`).
3. In OBS Studio:
   - Right-click the video source ➔ **Filters** ➔ **Add Filter (+)** ➔ **Chroma Key**.
   - Set **Key Color Type** to **Green**.
   - Because Smart Studio uses exact `#00FF00` flat color with zero texture, the background becomes 100% transparent instantly with zero green fringing.
   - The instructor's handwriting in white, saffron, cyan, ruby red, or yellow floats cleanly over your live video stream!

---

## ⌨️ Shortcuts & Gestures Reference

| Action | Keyboard Shortcut | Mouse / Touch Gesture |
| :--- | :--- | :--- |
| **Next Slide** | `→` / `PageDown` / `Space` | Horizontal Swipe Left / Right Edge Click |
| **Previous Slide** | `←` / `PageUp` | Horizontal Swipe Right / Left Edge Click |
| **First Slide** | `Home` | — |
| **Last Slide** | `End` | — |
| **Zen Fullscreen** | `F` | Double-Click / Double-Tap (except Zoom tool) |
| **Blackboard Studio** | `B` | Board button on header / toolbar |
| **Open Deck** | `O` | Open Deck button on header |
| **Close Overlays / Tool** | `Escape` | Tap ✕ on overlay / closes active tool |
| **Square / Perfect Circle** | Hold `Shift` while dragging | — |
| **Magnifier Lens** | `M` | Tap 🔍 button in Tier 1 / Stylus Hover / Finger Drag |
| **Pin Lens** | — | Long-press (500ms) / Alt+Click / Tap in Pin Mode |
| **Adjust Magnification** | `Wheel` | Slider in Popover / ➕ / ➖ on pinned ring |
| **Adjust Lens Size** | `Shift` + `Wheel` | Corner handle drag / Slider in Popover |
| **Whole-Slide Zoom Tool** | `Z` | Tap Zoom button in Tier 2 / Two-finger Pinch (1×–8×) |
| **Tap to Zoom (2.5× ↔ 1×)** | — | Single tap on slide when Zoom tool active |
| **Pan Zoomed Slide** | Middle-Mouse Drag | Two-finger drag / 1-finger drag in Zoom tool |
| **Zoom In / Out / Reset** | `+` / `-` / `0` | Floating 1× Reset Chip |

---

## 🔍 Magnifier Lens & Whole-Slide Zoom (New in v1.1.0)

### 1. Magnifier Lens
- **Activation**: Click the **🔍 Lens** button in Tier 1 of the floating toolbar or press `M`.
- **Follow Behavior**:
  - Mouse follows `pointermove`.
  - Stylus follows hover (`pointerType === 'pen'`) and contact.
  - Finger touch displays the lens above fingertip (`radius + 24px`) with zero obstruction of underlying detail.
  - Content stays centered with mathematical sub-pixel accuracy (≤ 4px error at rest).
- **Pinning Lenses**:
  - Long-press for 500ms or Alt+click to drop a pinned lens on the slide (up to 3 simultaneous pinned lenses).
  - Pinned lenses feature a gold gradient ring, corner resize handle, zoom ➕/➖ buttons, ✕ remove button, and a **Fixed Area (🔒)** vs **Glass Mode (🔍)** toggle.
  - Pinned lenses survive tool changes (you can switch back to Pen and annotate inside the lens!).
- **Spotlight Dim Mode**:
  - In Settings or the Magnifier Popover, enable **Spotlight** to dim the rest of the canvas by 45%, directing 100% of student focus to the lens.
- **Settings Popover**:
  - Tapping the active 🔍 button opens an in-place popover directly above the button to customize size (120–600 px), magnification (1.5×–8×), shape (Circle / Rounded Rect), mode (Follow / Pin-on-tap), spotlight, and touch position.

### 2. Whole-Slide Zoom
- **Activation**: Tap the **Zoom** button in Tier 2 of the toolbar, press `Z`, or simply pinch with two fingers anywhere on the stage.
- **Gestures**:
  - **Pinch**: Smooth 1:1 hardware-accelerated zoom (1× to 8×) about the finger midpoint.
  - **Two-Finger Pan**: Drag anywhere when zoomed (`> 1.05×`) with inertial physics (0.92 friction). Slides always cover 100% of stage (no empty borders).
  - **Tap-to-Zoom**: In Zoom tool, tap any detail to smoothly animate to 2.5× centered on that point; double-tap to reset to 1×.
  - **Floating 1× Chip**: Tap the floating `1×` badge in the bottom-right corner to instantly return to normal view.
- **Conflict Rule**:
  - For standard drawing tools, double-tap toggles toolbar visibility in Zen mode as before.
  - When the Zoom tool is active, double-tap toggles zoom, and the toolbar remains accessible via its drag handle (`⋮⋮`) or a 3-finger tap.

---

## 🌟 Welcome Screen Customization

Smart Studio Presenter Pro features an instant, cold-start welcome splash ("Welcome to SSIRO Classes") rendered with bundled high-contrast typography (*Noto Sans Devanagari 800*, *Inter 800*).

- **Brand Defaults**: Defined in `src/brand.ts`:
  ```ts
  export const WELCOME_LINE_1 = 'Welcome to';
  export const WELCOME_LINE_2 = 'SSIRO Classes';
  ```
- **Customization**: Open **Settings ➔ स्वागत स्क्रीन (Welcome Screen)**:
  - Toggle welcome screen on/off.
  - Customize Text Line 1 and Text Line 2.
  - Adjust duration slider (1.0 to 5.0 seconds, default 2.8s).
- **Instant Skip**: Tap anywhere or press any key after 800ms to dismiss immediately.
- **Background Pre-Warming**: While the splash renders, local fonts and `pdf.worker.min.mjs` are silently pre-cached so the presentation deck appears with zero latency.

---

## 🎨 Icon Generation Pipeline (`npm run icons`)

Icons are derived deterministically from the master vector SVG at `assets/brand/logo.svg` using Sharp:

```bash
npm run icons
```

Generated assets:
- `public/icons/icon-192.png`: 192×192 standard icon (transparent corners).
- `public/icons/icon-512.png`: 512×512 master high-resolution icon.
- `public/icons/maskable-512.png`: Full-bleed background with 0.78 scaled content for Android adaptive / round icon masks.
- `public/apple-touch-icon.png`: 180×180 iOS touch icon (no transparency).
- `public/favicon.svg`: Vector browser tab favicon.
- `public/favicon-32.png`: 32×32 PNG favicon.
- `public/favicon.ico`: Standard multi-resolution Windows ICO (16, 32, 48 px).

> **Note on Windows PC Taskbar Icons**:  
> When updating an already-installed PWA on Windows, Chrome/Edge caches application shortcuts in the Windows shell. The in-app window, splash screen, and browser tabs update immediately via the new Service Worker cache (`ssiro-smart-studio-v1.1.0`). To force Windows Explorer to refresh the taskbar shortcut icon immediately, simply uninstall the PWA via Chrome (*Settings ➔ Apps ➔ Manage Apps*) and re-install.

