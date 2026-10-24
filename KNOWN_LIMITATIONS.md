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

### 4. Continuous Voice Recognition Across Smart Board WebViews
- **Technical Constraint**: The Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) relies on speech-to-text engines provided by the underlying OS / browser:
  - On PC Chrome/Edge: Powered by Google Cloud Speech services; works seamlessly when online.
  - On Android Smart Boards: Older smart boards running Android 9, 10, or 11 with outdated Android System WebViews may require Google Speech Services to be installed or updated from Google Play Services.
- **Implemented Architecture**:
  - Continuous speech recognition auto-restarts upon completion.
  - The Android `MainActivity.java` explicitly intercepts `WebChromeClient.onPermissionRequest` to automatically grant microphone permissions to the WebView without interrupting teaching.
  - Bilingual command dictionary supports both Hindi (*अगला, पीछे, बोर्ड, साफ़*) and English (*next, back, board, clear, slide [n]*).
  - If microphone access is denied or unavailable on an older board, full presentation control is smoothly maintained via touch chevrons, edge clicks, swipe gestures, and keyboard/remote shortcuts.

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
  - The Service Worker cacheId has been bumped to `ssiro-smart-studio-v1.1.0` so browser tabs, splash screens, and window headers update immediately upon reload.
  - For installed desktop PWAs on Windows, if the taskbar icon does not immediately show the new SSIRO gold lotus icon, simply uninstall the PWA from Chrome/Edge (*Settings ➔ Apps ➔ Manage Apps*) and click Install again.

---

### 7. Toolbar Double-Tap vs. Zoom Double-Tap Conflict Rule
- **Technical Constraint**: The app features a global double-tap gesture to toggle toolbar visibility in Zen mode. In the new Whole-Slide Zoom tool, educators also expect double-tap to toggle between 1× and 2.5× zoom.
- **Implemented Solution**:
  - The conflict rule cleanly isolates tool behaviors: for all normal tools (Pen, Highlighter, Eraser, Shapes, Select), double-tap toggles toolbar visibility as before.
  - When the **Zoom tool** is explicitly active, double-tap toggles zoom level (1× ↔ 2.5×), and the toolbar remains accessible at all times via its 360° drag handle (`⋮⋮`) or a 3-finger tap.
