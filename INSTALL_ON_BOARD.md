# INSTALL_ON_BOARD.md — Smart Studio Presenter Pro
# बोर्ड पर इंस्टॉल करने के निर्देश (Hindi + English)

---

## ⚡ APK कैसे बनाएँ / How to Build the APK

> **महत्वपूर्ण:** Android SDK इस कंप्यूटर पर नहीं है, इसलिए APK **GitHub Actions** से बनेगी।
> **Important:** Android SDK is not installed locally. Build the APK using **GitHub Actions**.

### Step 1: GitHub पर Code Push करें

```bash
cd C:\Users\rnran\.gemini\antigravity\scratch\smart-studio
git init
git add .
git commit -m "feat: Smart Studio Presenter Pro – initial APK build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-studio.git
git push -u origin main
```

### Step 2: GitHub Secrets सेट करें

GitHub → Repository → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | कहाँ से |
|-------------|-------|---------|
| `KEYSTORE_BASE64` | keystore file का Base64 | नीचे command देखें |
| `KEY_ALIAS` | `studio` | fixed |
| `KEY_PASSWORD` | keystore.properties से | `keyPassword` value |
| `STORE_PASSWORD` | keystore.properties से | `storePassword` value |

**Keystore को Base64 में बदलने का तरीका (Windows PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\rnran\.gemini\antigravity\scratch\smart-studio\smart-studio-release.jks")) | Set-Clipboard
# Clipboard में copy हो गया — GitHub Secret में paste करें
```

### Step 3: Workflow Run करें

1. GitHub → **Actions** tab खोलें
2. "Build Signed Android APK" workflow चुनें
3. **"Run workflow"** → **"Run workflow"** क्लिक करें
4. ~10-15 मिनट बाद workflow complete होगा
5. **Artifacts** section में `smart-studio-apk-v1.0.0` download करें
6. ZIP extract करें → `Smart-Studio-v1.0.0-release.apk` मिलेगा

---

## 📱 बोर्ड पर APK इंस्टॉल करना / Installing APK on the Board

### Method A: Pen Drive से (सबसे आसान)

1. `Smart-Studio-v1.0.0-release.apk` को **pen drive** में copy करें
2. Pen drive बोर्ड में लगाएँ
3. बोर्ड का **File Manager** खोलें
4. Pen drive में APK ढूँढें, tap करें
5. "Install unknown apps" पूछे तो → **Settings** → file manager को allow करें
6. वापस आएँ → **Install** दबाएँ

### Method B: Cloud से Download (WiFi हो तो)

1. APK को **Google Drive / OneDrive / Dropbox** पर upload करें
2. बोर्ड पर browser खोलें → वही link खोलें
3. Download करें → Install करें

### Method C: ADB से (USB / WiFi) — Advanced

```bash
# USB से
adb devices
adb install -r Smart-Studio-v1.0.0-release.apk

# WiFi से (board की IP settings में देखें)
adb connect 192.168.X.X:5555
adb install -r Smart-Studio-v1.0.0-release.apk
```

### ⚠️ "Unknown Sources" Enable करना

बोर्ड का Settings खोलें:

| Board Type | Path |
|------------|------|
| Most Android boards | Settings → Security → Unknown Sources: ON |
| Android 8+ boards | Settings → Apps → Special App Access → Install Unknown Apps → File Manager: Allow |

> **"Play Protect warning"** आए तो **"Install anyway"** चुनें। यह APK safe है।

---

## 🚀 पहली बार खोलें / First Launch

1. App icon tap करें: **Smart Studio**
2. Splash screen आएगा (~1.2 सेकंड)
3. Welcome screen पर **"Open Deck to Begin"** दबाएँ
4. PDF या image चुनें
5. Mic icon पहली बार tap करने पर **permission माँगेगा** — "Allow" करें

---

## 🔄 Update करना / Updating the App

नया APK पुराने के ऊपर install होगा — settings सुरक्षित रहेंगी:

```bash
adb install -r Smart-Studio-v1.0.1-release.apk
# -r = replace (पुरानी APK रहेगी, update होगी)
```

> ⚠️ **वही keystore use करें जो पहले इस्तेमाल हुई।** अलग keystore से install नहीं होगा।

---

## 🔧 Troubleshooting

| समस्या / Problem | समाधान / Solution |
|-----------------|-------------------|
| "App not installed" | पहले debug APK uninstall करें। या: अलग signature की पुरानी install है — uninstall करें |
| "Parse error" | APK corrupt है — फिर से download करें |
| बहुत पुराना WebView | Settings → Android System WebView → Update (Play Store में) |
| Lag आ रहा है | Settings → Performance → **Low-end** चुनें |
| Lag अभी भी है | Version number पर 7 बार tap करें → Perf Overlay → "Copy Report" → report भेजें |
| Mic काम नहीं | Settings → Apps → Smart Studio → Permissions → Microphone: Allow |
| Screen rotate हो रही है | Normal है — बोर्ड sensor से rotate होती है (sensorLandscape) |
| Black screen | Board को restart करें; WebView update करें |

---

## ✅ 15-Minute On-Board Verification Checklist

बोर्ड पर install के बाद यह 15 checklist items verify करें:

| # | Test | Expected | ✓ |
|---|------|----------|---|
| 1 | App launch | Splash (~1.2s) → Welcome screen | ☐ |
| 2 | Open PDF | File manager खुले, PDF load हो | ☐ |
| 3 | Pen tool | स्मूथ stroke, कोई lag नहीं | ☐ |
| 4 | Marker tool | Semi-transparent, स्मूथ | ☐ |
| 5 | Underline/Shapes | Shape बनें, resize हो | ☐ |
| 6 | Pinch zoom | Smooth in/out | ☐ |
| 7 | Magnifier | Glass effect (या solid on Low-end) | ☐ |
| 8 | Blackboard | Dark canvas, pen काम करे | ☐ |
| 9 | Toolbar resize/drag | Smooth drag | ☐ |
| 10 | Mic on/off | First tap: permission माँगे; फिर: toggle | ☐ |
| 11 | AI panel | Opens, closes smoothly | ☐ |
| 12 | Back button (1×) | "बाहर जाने के लिए..." toast | ☐ |
| 13 | Back button (2×, 2s) | App बंद हो | ☐ |
| 14 | Rotate board (landscape) | Layout ठीक रहे, ink न खोए | ☐ |
| 15 | 5-minute drawing session | No crash, no ANR, no slowdown | ☐ |

**अगर कोई item fail हो:** error/screenshot के साथ report करें।

---

## 🔑 Keystore Backup — CRITICAL

> 🔴 **यह files backup करें — इनके बिना app update नहीं होगा:**

```
C:\Users\rnran\.gemini\antigravity\scratch\smart-studio\smart-studio-release.jks
C:\Users\rnran\.gemini\antigravity\scratch\smart-studio\android\keystore.properties
```

**Backup कहाँ करें:**
- ✅ Google Drive (password-protected folder)
- ✅ External hard drive
- ✅ USB drive (safe place में)
- ❌ Same computer only (risky)

---

## 🏗️ फिर से Build करने के Commands / Rebuild Commands

```bash
cd C:\Users\rnran\.gemini\antigravity\scratch\smart-studio

# Local web build
npm ci
npm run build

# Capacitor sync (Android SDK चाहिए)
npx cap sync android

# Gradle build (Android SDK चाहिए)
cd android
./gradlew assembleRelease

# GitHub Actions से (recommended):
git commit -am "release: v1.0.1"
git tag v1.0.1
git push origin main --tags
# → GitHub Actions automatically builds APK
```

---

## 📊 APK Info

| Field | Value |
|-------|-------|
| Package | com.decodingindology.studio |
| Version | 1.0.0 (versionCode: 1) |
| Min Android | 7.0 (API 24) |
| Target Android | 15 (API 35) |
| ABIs | armeabi-v7a, arm64-v8a, x86_64 |
| Signing | SHA256withRSA, v1+v2+v3 |
| Cert SHA-256 | F3:5A:64:68:41:FC:0A:C1:DD:C1:56:0D:FD:88:04:D2:EA:C8:B9:43:A6:26:9F:09:B5:DD:54:60:E2:66:1B:7D |
| Keystore validity | Until 2054-03-18 |

---

*Honest note: "लैग नहीं" की गारंटी हर बोर्ड पर संभव नहीं। Performance app में ही Auto-detect होती है।
अगर फिर भी लैग आए: Settings → Low-end, और ?perf=1 overlay से numbers share करें।*

