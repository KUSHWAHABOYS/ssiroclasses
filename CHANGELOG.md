# Changelog — Smart Studio Presenter Pro

All notable changes to "Smart Studio Presenter Pro" are documented in this file.

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
