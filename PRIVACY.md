# Smart Studio Presenter Pro — Privacy & Security Architecture
**गोपनीयता एवं डेटा सुरक्षा नीति (100% Client-Side & Zero-Telemetry)**

Last Updated: 2026-10-28  
Version: 1.4.0 (Audit Verified)

---

## 1. Core Commitment: 100% Client-Side & Private
Smart Studio Presenter Pro is an offline-first broadcast presentation tool engineered specifically for Hindi educators, live-streamers, and smart board teachers. We adhere to an absolute **zero-telemetry, zero-tracking, zero-ad** philosophy.

- **No Analytics**: Google Analytics, Mixpanel, Sentry, Firebase, or any other tracking libraries are completely absent from both source code and built bundles.
- **No Third-Party Cookies or Beacons**: No cookies or web beacons are placed or read.
- **No Remote Fonts**: Typography runs completely on local system fonts and bundled offline assets. No requests to Google Fonts or remote CDN origins.
- **Strict CSP (Content Security Policy)**: The application enforces a strict Content Security Policy restricting network connections solely to explicit user-configured AI provider endpoints.

---

## 2. API Key Security & Cryptographic Vault
If you choose to enable AI features (such as Google Gemini, OpenAI, Claude, Groq, DeepSeek, or OpenRouter):
- **WebCrypto AES-GCM Encryption**: All API keys are encrypted client-side using non-extractable 256-bit AES-GCM keys via the browser's native `window.crypto.subtle` hardware API.
- **Never Plaintext in Storage**: Plaintext API keys are never written to `localStorage`, `sessionStorage`, cookies, URL parameters, or diagnostic logs.
- **No Proxy Server**: API requests are dispatched directly from your browser/device to the official API endpoint via encrypted HTTPS (or Capacitor native HTTP on Android). No intermediate server ever intercepts your keys or tokens.
- **1-Click Key Destruction**: In *Settings ➔ AI ➔ Key Vault*, you can delete individual keys or delete all keys with one tap, immediately scrubbing all cryptographic key records.

---

## 3. Microphone & Speech Recognition Privacy
- **Strictly User-Gated**: The microphone is `OFF` on initial launch, reload, slide change, and return from background. It **never turns on automatically**.
- **No Audio Recording or Storage**: The app does not record, buffer, stream, or store any microphone audio.
- **Complete Resource Release**: When you tap the mic button or say *"माइक बंद करो"* / *"stop listening"*, the audio pipeline calls `abort()`, detaches listeners, and terminates media tracks (`track.stop()`) so the browser/system mic-in-use indicator immediately turns off.
- **Icon-Only Feedback**: Voice feedback is strictly icon-only (e.g. `🎙️ ✏️`). Spoken transcripts are never written to the screen, console, or storage.
- **Push-to-Talk & Auto-Off**: Built-in 10-minute auto-mute and optional push-to-talk ensure the mic is never left open inadvertently.

---

## 4. Local Storage & Device Data
All user preferences, custom logos, organisation names, and slide annotations are saved exclusively on your local device:
- **IndexedDB**: Encrypted Key Vault storage and offline deck caches (if offline mode enabled).
- **LocalStorage**: UI preferences (pen widths, colors, ghost timer, active board theme).
- **Service Worker Cache**: Application shell for offline PWA startup.

### Complete Data Wipe (Delete All App Data)
Under *Settings ➔ Privacy*, tapping **"सभी ऐप डेटा हटाएं (Delete All App Data)"** instantly wipes all IndexedDB databases, LocalStorage items, Service Worker caches, and registered Service Workers, resetting the application to a pristine factory state.

---

## 5. Network Activity Transparency
Allowed network origins:
1. `self` (origin serving the PWA shell)
2. `https://generativelanguage.googleapis.com` (Only if Google Gemini API key is configured)
3. `https://api.openai.com` (Only if OpenAI API key is configured)
4. `https://api.anthropic.com` (Only if Anthropic API key is configured)
5. `https://api.groq.com`, `https://api.deepseek.com`, `https://openrouter.ai`, `https://api.perplexity.ai` (Only if corresponding user key is configured)

If no AI key is configured, **the application makes exactly zero network requests**. All drawing, shapes, blackboard, magnifier, and local voice command grammar operate 100% offline.
