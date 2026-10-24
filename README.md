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

8. **Google Gemini AI Assistant & AES-GCM Key Vault**:
   - 256-bit AES-GCM encryption with unextractable `CryptoKey` in IndexedDB.
   - API key is never stored in plaintext and masked as `••••••••XXXX`.
   - Direct HTTPS requests to Google's official API endpoint (zero third-party proxy).
   - "Explain Slide with Vision" analyzes the current slide screenshot to assist during live streams.

9. **Bilingual Voice Commands (Web Speech API)**:
   - Voice navigation in Hindi (`hi-IN`) and English (`en-IN`): "Next" / "अगला", "Back" / "पीछे", "Slide 5" / "स्लाइड पाँच", "Clear" / "साफ़", "Board" / "बोर्ड", "Fullscreen", and tool selection.

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
| **Zen Fullscreen** | `F` | Double-Click / Double-Tap |
| **Blackboard Studio** | `B` | Board button on header / toolbar |
| **Open Deck** | `O` | Open Deck button on header |
| **Close Overlays** | `Escape` | Tap ✕ on overlay |
| **Square / Perfect Circle** | Hold `Shift` while dragging | — |
