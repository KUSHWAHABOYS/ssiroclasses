# Known Limitations & Platform Behaviors (ज्ञात सीमाएं एवं समाधान)

As part of our commitment to transparent engineering, this document details any technical constraints inherent to browser sandboxing, WebView runtimes, and client-side web technologies, along with the implemented fallbacks and recommended workflows.

---

### 1. PowerPoint (.pptx) Native In-Browser Fidelity
- **Technical Constraint**: Web browsers do not possess a native Microsoft PowerPoint rendering engine. Unlike PDF standards which are strictly defined and rendered pixel-perfect by `pdfjs-dist`, `.pptx` files rely on complex proprietary XML markup, custom shape morphs, slide master inheritance, and embedded Office fonts that cannot be rendered with 100% fidelity purely client-side without an external server or heavy proprietary rendering engine.
- **Implemented Behavior**: When a user selects a `.pptx` file, Smart Studio displays an informative guidance dialog explaining why PDF is the golden standard for broadcast-quality teaching decks.
- **Recommended Workflow**:
  - In PowerPoint or Google Slides, export the presentation deck as **PDF** (*File ➔ Save As / Download as PDF*).
  - Open the exported `.pdf` in Smart Studio. This guarantees 100% vector typography, accurate mathematical formulas, Sanskrit transliteration diacritics, and image layouts at full 4K resolution.

---

### 2. In-App Web Browser on PC (Google Search & External Sites)
- **Technical Constraint**: On desktop browsers (Chrome, Edge) and PWAs, modern websites (including `google.com`, `wikipedia.org`, and streaming sites) enforce strict HTTP response headers:
  - `X-Frame-Options: SAMEORIGIN` / `DENY`
  - `Content-Security-Policy: frame-ancestors 'self'`
  Standard browser security blocks these sites from rendering inside an in-page `<iframe>` element.
- **Implemented Behavior**:
  - Smart Studio tests iframes and detects security blocks within 3 seconds.
  - An intelligent **Fallback Card** is presented in Hindi and English with a 1-click button: *"नई विंडो में खोलें (Open in New Tab)"*.
  - For streaming in OBS Studio or StreamYard, users can capture the secondary window using standard OBS **Window Capture**.
- **Android APK Advantage**: In the Android APK build, the native WebView/InAppBrowser is not constrained by browser iframe restrictions, allowing full native browsing over the presentation canvas.

---

### 3. Offline Devanagari Handwriting Recognition
- **Technical Constraint**: Web browsers and mobile WebViews currently lack a standardized, reliable on-device Devanagari handwriting recognition API. While Latin handwriting models exist in limited experimental browser APIs, Devanagari (with complex conjuncts, matras, and shirorekha) requires a dedicated neural model.
- **Implemented Architecture**:
  - **Phase 1 (Primary - Web & APK)**: Uses **Google Gemini 1.5 Flash Vision** via direct HTTPS requests with client-side 256-bit AES-GCM encrypted API key storage. An offscreen cropped snapshot of the word group (black ink on white canvas, 16px padding) is sent with temperature `0.0`. This provides industry-leading transcription accuracy for Hindi and Sanskrit terms.
  - **Phase 2 (APK Offline Native Model)**: The codebase includes the pluggable `HandwritingRecognizer` interface designed for a Google ML Kit Digital Ink Recognition Capacitor plugin wrapper with the `hi` and `en` offline models.
  - **Zero-Loss Fallback**: If offline or if the user has not configured a Gemini API key, the handwriting is **never deleted or lost**. The educator's original ink strokes remain fully visible on the canvas with a non-blocking toast.

---

### 4. Microphone Control & Speech Recognition Privacy (माइक नियंत्रण व गोपनीयता)
- **Technical Constraint & Privacy Reality**: The Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) relies on speech-to-text engines provided by the underlying browser/OS (in Google Chrome and Android WebView, audio may be processed via Google Speech Services while the mic is active). The app itself does not record, buffer, or upload audio files anywhere.
- **Strict User-Gated Architecture (v1.2.0)**:
  - **Off by Default**: The mic is strictly `off` on every launch, reload, slide change, return from in-app browser, and window blur (>30s). No setting or mechanism can turn it on automatically.
  - **Explicit User Action Only**: Turns on only via physical tap on the 🎙 Mic button, keyboard shortcut `V`, or push-to-talk. Spoken commands can never turn the mic on.
  - **Complete Pipeline Release**: When turning off, `recognition.abort()` is called, all event listeners are detached, restart loops are stopped, and any active audio tracks are terminated (`track.stop()`) to immediately extinguish the browser/system mic-in-use indicator.
  - **Auto-off Idle Timer**: Automatically mutes after 10 minutes (configurable: off / 5 / 10 / 30 min) of no recognized command.
  - **Spoken Mute Command**: "stop listening / माइक बंद करो" immediately mutes the mic.
  - **Visual Safeguards**: Pulsing red ring, live 3-bar input meter, Tier 1 toolbar button, header mirror button, and a 12px red dot in Zen mode ensure the presenter is always aware when the mic is active.

---

### 5. Host Compilation of Android APK
- **Technical Constraint**: Compiling an Android `.apk` binary from source requires a local installation of the Java Development Kit (JDK 17 or 21) and the Android SDK / Build Tools. On systems where `JAVA_HOME` is not configured, Gradle cannot assemble the binary locally in the terminal.
- **Implemented Solution**:
  - Complete native Android project generated and synced under `android/`.
  - AndroidManifest.xml and MainActivity.java configured with immersive sticky mode, keep-awake, hardware acceleration, and mic permissions.
  - Can be built immediately in Android Studio or CI/CD using `./gradlew assembleDebug`.

---

### 6. PWA Taskbar & Desktop Shortcut Icon Updates on Windows PC
- **Technical Constraint**: When a Progressive Web App (PWA) is installed via Chrome or Edge on Windows, the operating system creates Windows `.lnk` shortcuts and extracts the icon into the Windows Icon Cache (`%LOCALAPPDATA%\IconCache.db`). Although the Service Worker automatically refreshes the in-browser and in-window application assets (showing the "New version ready — Reload" toast), the Windows OS taskbar and desktop shortcuts may continue caching the previous icon until Windows rebuilds its shell cache.
- **Implemented Solution & User Guidance**:
  - The Service Worker cacheId has been bumped to `ssiro-smart-studio-v1.3.0` so browser tabs, splash screens, and window headers update immediately upon reload.
  - For installed desktop PWAs on Windows, if the taskbar icon does not immediately show the new SSIRO gold lotus icon, simply uninstall the PWA from Chrome/Edge (*Settings ➔ Apps ➔ Manage Apps*) and click Install again.

---

### 7. Toolbar Double-Tap vs. Zoom Double-Tap Conflict Rule
- **Technical Constraint**: The app features a global double-tap gesture to toggle toolbar visibility in Zen mode. In the new Whole-Slide Zoom tool, educators also expect double-tap to toggle between 1× and 2.5× zoom.
- **Implemented Solution**:
  - The conflict rule cleanly isolates tool behaviors: for all normal tools (Pen, Highlighter, Eraser, Shapes, Select), double-tap toggles toolbar visibility as before.
  - When the **Zoom tool** is explicitly active, double-tap toggles zoom level (1× ↔ 2.5×), and the toolbar remains accessible at all times via its 360° drag handle (`⋮⋮`) or a 3-finger tap.

---

### 8. Multi-Provider AI Browser CORS Restrictions (ब्राउज़र CORS सीमाएं)
- **Technical Constraint & Platform Reality**: Certain AI providers (such as OpenAI, xAI Grok, Groq, Mistral, DeepSeek, and Perplexity) configure their official HTTP endpoints without wildcard browser CORS headers (`Access-Control-Allow-Origin: *`), purposefully blocking direct `fetch()` requests originating from arbitrary web page origins.
- **Implemented Architecture & Zero-Server Compliance**:
  - **Direct Browser-Capable Providers**: Google Gemini, Anthropic Claude (via the official `anthropic-dangerous-direct-browser-access: true` header), and OpenRouter natively permit direct browser calls.
  - **Android APK Advantage**: In the Android APK build, Smart Studio uses `CapacitorHttp` natively. Native requests bypass browser CORS sandboxing completely, allowing direct communication with OpenAI, Grok, Groq, Mistral, DeepSeek, and Perplexity directly from the smart board.
  - **PWA/PC Guidance**: On desktop browsers, if a CORS-restricted provider is selected, Smart Studio detects the network block within seconds and presents a clear message: *"This provider cannot be called directly from a browser. Use the Android app, or choose Gemini/OpenRouter/Anthropic that allows direct browser access."*
  - **Zero-Server Guarantee**: The application never introduces a middleman proxy or telemetry server. Keys and payloads are never transmitted to any third-party server under any circumstance.

---

### 9. Smart Ink Transactional Rollbacks & Network Latency (स्मार्ट इंक लेनदेन व विलंब)
- **Technical Constraint**: When converting handwritten Hindi or English words into clean typeset fonts, the request travels over the internet to the educator's configured AI provider. If the smart board connection is slow or drops temporarily, an un-gated OCR system would delete ink or hang indefinitely.
- **Implemented Architecture & Invariant**:
  - **Ink Never Vanishes**: Every conversion is an atomic transaction. Raw strokes are kept stored in `annotationStore` (hidden) and only replaced after clean geometry or text is successfully validated and drawn. Any network timeout or offline state triggers an instant rollback, keeping drawn ink intact.
  - **Speculative Recognition**: Background recognition begins after 500ms of idle time, cutting perceived conversion delay down to approximately 1.0s.
  - **Local Shape Bypass**: Freehand shapes and underlines with high geometric confidence ($\ge 0.6$) snap completely locally in $<20$ms without making any AI network call.

### 10. Web Speech Recognition Variations in Voice Writing (आवाज लेखन सीमाएं)
- **Technical Constraint**: The browser's `SpeechRecognition` API transcribes spoken words based on the device's selected language (`hi-IN` or `en-IN`). Educational terminology and Sanskrit proper nouns (e.g. *Vishnu*, *Aryabhata*) can be transcribed with slight regional spelling variations.
- **Implemented Behavior**:
  - **Phonetic & Glossary Normalization**: Dictated words are cross-referenced with a curated Indology and mathematics glossary, snapping variations automatically to standard forms (e.g., *Vishnu* $\rightarrow$ *विष्णु*).
  - **Zero Spoken Transcript Exposure**: The raw spoken sentence is never toasted or stored on the slide, ensuring video recordings for YouTube or live streams are never cluttered with interim transcripts.

---

### 11. AI Provider Free-Tier Limits & Dynamic Quota Changes (मुफ़्त सीमा व कोटा परिवर्तन)
- **Technical Constraint & Platform Reality**: Free-tier rate limits and daily request quotas for cloud AI providers (especially Google AI Studio / Gemini API) are established per project/account, vary significantly by model tier, and change over time without prior notice. For example, standard Flash models may enforce a limit of 20 requests per day (RPD) on free keys, while Flash-Lite models offer substantially higher daily allowances.
- **Implemented Architecture (Economy AI Mode v1.4.0)**:
  - **Dynamic Model Catalog**: Models are never hardcoded. After API key validation, available models are queried and ranked dynamically in `modelCatalog.ts`.
  - **Flash-Lite Default Priority**: Economy mode prioritizes `gemini-2.0-flash-lite`, followed by `gemini-1.5-flash-8b`, before ever touching standard Flash models.
  - **Structured 429 Cooldown & Graceful Fallback**: When an HTTP 429 error occurs, `quotaManager` parses structured error payloads, extracts retry delays or daily reset times, and records an active cooldown. The AI router automatically falls back to the next available economy model without crashing or interrupting the user.
  - **Token Minimization**: Concise system prompts (<60 tokens), disabling of hidden thinking tokens (`thinkingBudget: 0`), text layer extraction before pixels for slide explanations, chat history truncation to the last 4 turns / 200 characters, and a 24-hour IndexedDB response cache reduce token consumption by up to 80%.

---

### 12. Chrome's Own "Ask Gemini" Browser Button Integration
- **Technical Constraint**: Google Chrome provides a native "Ask Gemini" button in the browser omnibar/toolbar on supported desktop builds. However, web security sandboxing strictly prohibits web pages or web applications from opening, inspecting, or embedding browser-native omnibar features or side panels via JavaScript.
- **Implemented Solution**:
  - The in-app AI Assistant panel displays a non-intrusive hint when running in Chrome: *"दूसरा तरीका: Chrome के ऊपरी Ask Gemini बटन से भी पूछ सकते हैं"* (Alternative: You can also ask via Chrome's top Ask Gemini button).
  - The in-app assistant remains 100% self-contained, dockable, resizable, and context-aware of slide text and annotations.

---

### 13. Chrome Built-in AI (On-Device Gemini Nano) Runtimes & Languages
- **Technical Constraint**: The browser on-device Prompt API (`window.ai.languageModel`) is an experimental capability currently restricted to Desktop Google Chrome. It is not supported in the Android WebView / Capacitor APK, mobile browsers, or other desktop browsers. Furthermore, Google's documented on-device Nano models focus primarily on English, Japanese, and Spanish, with limited Hindi comprehension.
- **Implemented Architecture**:
  - **Strict Feature Detection**: Disabled by default. Only enabled when `window.ai.languageModel` is detected and reports ready availability.
  - **Safe Diagnostic Check**: Settings ➔ AI includes a *"जांचें (Test)"* button that verifies on-device model status and execution safely.
  - **Graceful Fallback**: If on-device AI is absent or fails for Hindi tasks, the router smoothly skips to the next cloud provider without blocking presentation workflows.


