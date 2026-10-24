import { store } from '../state/store';
import { keyVault } from '../ai/keyVault';

export class SettingsPanel {
  private modalEl!: HTMLElement;

  init(): void {
    this.modalEl = document.getElementById('settingsPanel') as HTMLElement;
    this.render();
    this.bindEvents();
  }

  private render(): void {
    const s = store.getState().settings;
    const maskedKey = keyVault.getMaskedKey() || 'कोई कुंजी सेट नहीं (None)';

    this.modalEl.innerHTML = `
      <div class="settings-header">
        <span style="font-weight: 700; font-size: 16px; color: var(--primary-accent);">
          ⚙ स्टूडियो सेटिंग्स (Studio Settings)
        </span>
        <button class="media-win-btn" id="btnSettingsClose" style="font-size: 16px;">✕</button>
      </div>

      <div class="settings-body">
        <!-- Display & Presentation Section -->
        <div class="settings-section">
          <div class="settings-section-title">प्रस्तुति व डिस्प्ले (Presentation & 4K Display)</div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्लाइड फ़िट मोड (Fit Mode)</span>
              <span class="setting-desc">16:9 बोर्ड पर अन्य अनुपातों के लिए स्केल विधि</span>
            </div>
            <select id="settingFitMode" class="header-btn" style="background:#111;">
              <option value="fit" ${s.fitMode === 'fit' ? 'selected' : ''}>Fit (Uniform + Corner Color Fill)</option>
              <option value="fill" ${s.fitMode === 'fill' ? 'selected' : ''}>Fill (Cover Viewport, No Distortion)</option>
              <option value="stretch" ${s.fitMode === 'stretch' ? 'selected' : ''}>Stretch (Non-uniform, Warning)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">रेंडर गुणवत्ता (Render Quality)</span>
              <span class="setting-desc">4K सुपरसैंपलिंग मल्टीप्लायर</span>
            </div>
            <select id="settingRenderQuality" class="header-btn" style="background:#111;">
              <option value="3x" ${s.renderQuality === '3x' ? 'selected' : ''}>3× Supersampled (Ultra Sharp 4K)</option>
              <option value="2x" ${s.renderQuality === '2x' ? 'selected' : ''}>2× Standard</option>
              <option value="auto" ${s.renderQuality === 'auto' ? 'selected' : ''}>Auto Safe</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्लाइड बदलने पर स्वतः साफ़ (Auto-Erase on Navigation)</span>
              <span class="setting-desc">अगली स्लाइड पर जाने पर पिछली स्याही तुरंत मिटाएं</span>
            </div>
            <input type="checkbox" id="settingAutoErase" ${s.autoEraseOnSlideChange ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">प्रति-स्लाइड स्याही सहेजें (Keep Annotations Per Slide)</span>
              <span class="setting-desc">हर स्लाइड के लिए अलग ड्राइंग याद रखें</span>
            </div>
            <input type="checkbox" id="settingKeepPerSlide" ${s.keepAnnotationsPerSlide ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>
        </div>

        <!-- Google Gemini AI Key Vault Section -->
        <div class="settings-section">
          <div class="settings-section-title">Google Gemini AI & Key Vault (AES-GCM 256-bit)</div>

          <div class="setting-item" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div class="setting-label">
              <span class="setting-name">वर्तमान API कुंजी (Current Key)</span>
              <span class="setting-desc" id="currentKeyDisplay" style="font-family: monospace; color: var(--primary-accent);">${maskedKey}</span>
            </div>
            <div style="display:flex; gap:8px;">
              <input type="password" id="inputNewApiKey" placeholder="Google AI Studio API Key यहाँ पेस्ट करें..." class="gemini-input" style="flex:1;" />
              <button class="header-btn" id="btnSaveApiKey" style="background:var(--primary-accent); color:#000; font-weight:700;">सहेजें (Save)</button>
              <button class="header-btn" id="btnDeleteApiKey" style="color:#f87171;">हटाएं (Delete)</button>
            </div>
            <span style="font-size:11px; color:var(--text-muted);">
              🔒 आपकी कुंजी इस डिवाइस पर AES-GCM से सुरक्षित एन्क्रिप्टेड रहती है और सीधे generativelanguage.googleapis.com को जाती है। कोई मध्यस्थ सर्वर नहीं है।
            </span>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">Gemini मॉडल (Model)</span>
              <span class="setting-desc">Vision और चैट के लिए Gemini मॉडल नाम</span>
            </div>
            <input type="text" id="settingGeminiModel" value="${s.geminiModel}" class="gemini-input" style="width:180px;" />
          </div>
        </div>

        <!-- SSIRO-UPDATE: Welcome Screen Section -->
        <div class="settings-section">
          <div class="settings-section-title">स्वागत स्क्रीन (Welcome Screen)</div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्वागत स्क्रीन दिखाएं (Show Welcome Screen)</span>
              <span class="setting-desc">ऐप शुरू होने पर 'Welcome to SSIRO Classes' स्प्लैश दिखाएं</span>
            </div>
            <input type="checkbox" id="settingShowWelcome" ${s.showWelcomeScreen ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">शीर्षक पंक्ति 1 (Line 1)</span>
              <span class="setting-desc">स्वागत संदेश की पहली पंक्ति</span>
            </div>
            <input type="text" id="settingWelcomeLine1" value="${s.welcomeLine1 || 'Welcome to'}" class="gemini-input" style="width:180px;" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">शीर्षक पंक्ति 2 (Line 2)</span>
              <span class="setting-desc">मुख्य संस्थान / कक्षा नाम (Gold Gradient)</span>
            </div>
            <input type="text" id="settingWelcomeLine2" value="${s.welcomeLine2 || 'SSIRO Classes'}" class="gemini-input" style="width:180px;" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">प्रदर्शित समय (Duration)</span>
              <span class="setting-desc">स्क्रीन स्वतः हटने का समय (1–5 सेकंड)</span>
            </div>
            <input type="range" id="settingWelcomeDuration" min="1" max="5" step="0.2" value="${s.welcomeDuration || 2.8}" class="popover-slider" style="width:120px;" />
            <span id="welcomeDurationVal">${s.welcomeDuration || 2.8}s</span>
          </div>
        </div>

        <!-- SSIRO-UPDATE: Magnifier Lens & Whole-Slide Zoom Section -->
        <div class="settings-section">
          <div class="settings-section-title">मैग्नीफ़ायर लेंस व ज़ूम (Magnifier & Zoom)</div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">डिफ़ॉल्ट आवर्धन (Magnification)</span>
              <span class="setting-desc">लेंस का डिफ़ॉल्ट ज़ूम स्तर</span>
            </div>
            <input type="range" id="settingMagZoom" min="1.5" max="8" step="0.5" value="${s.magnifierZoom || 3.0}" class="popover-slider" style="width:120px;" />
            <span id="magZoomVal">${s.magnifierZoom || 3.0}×</span>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">डिफ़ॉल्ट लेंस आकार (Lens Size)</span>
              <span class="setting-desc">लेंस का व्यास (120–600 px)</span>
            </div>
            <input type="range" id="settingMagSize" min="120" max="600" step="10" value="${s.magnifierSize || 280}" class="popover-slider" style="width:120px;" />
            <span id="magSizeVal">${s.magnifierSize || 280}px</span>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्पॉटलाइट (Spotlight Dim)</span>
              <span class="setting-desc">लेंस के अतिरिक्त बाकी स्क्रीन को धुंधला करना</span>
            </div>
            <input type="checkbox" id="settingMagSpotlight" ${s.magnifierSpotlight ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">टच स्थिति (Touch Position)</span>
              <span class="setting-desc">उंगली से स्पर्श करते समय लेंस कहाँ दिखे</span>
            </div>
            <select id="settingMagTouchPos" class="header-btn" style="background:#111;">
              <option value="above" ${s.magnifierTouchPos === 'above' ? 'selected' : ''}>Above Finger (उंगली के ऊपर)</option>
              <option value="under" ${s.magnifierTouchPos === 'under' ? 'selected' : ''}>Under Finger (उंगली के नीचे)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">ज़ूम में पेन की चौड़ाई स्थिर रखें (Keep Pen Width Constant)</span>
              <span class="setting-desc">ज़ूम करने पर स्क्रीन पर स्याही की मोटाई न बदले</span>
            </div>
            <input type="checkbox" id="settingKeepPenWidth" ${s.keepPenWidthOnZoom ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्लाइड बदलने पर लेंस बनाए रखें (Keep Pinned Lens)</span>
              <span class="setting-desc">अगली स्लाइड पर जाने पर टिकाए गए लेंस न हटाएं</span>
            </div>
            <input type="checkbox" id="settingKeepLens" ${s.keepLensOnSlideChange ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्लाइड बदलने पर ज़ूम बनाए रखें (Keep Zoom Level)</span>
              <span class="setting-desc">अगली स्लाइड पर जाने पर 1× पर रीसेट न करें</span>
            </div>
            <input type="checkbox" id="settingKeepZoom" ${s.keepZoomOnSlideChange ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>
        </div>

        <!-- Toolbar & Interaction Section -->
        <div class="settings-section">
          <div class="settings-section-title">टूलबार और इंटरैक्शन (Toolbar & Input)</div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">घोस्ट मोड टाइमर (Ghost Mode Idle Sec)</span>
              <span class="setting-desc">निष्क्रिय रहने पर टूलबार 20% धुंधला होने का समय</span>
            </div>
            <input type="range" id="settingGhostTimer" min="2" max="10" value="${s.toolbarIdleSeconds}" class="popover-slider" style="width:120px;" />
            <span id="ghostSecVal">${s.toolbarIdleSeconds}s</span>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">टूलबार स्थिति रीसेट (Reset Toolbar Position)</span>
              <span class="setting-desc">टूलबार को डिफ़ॉल्ट शीर्ष केंद्र स्थिति पर लाएं</span>
            </div>
            <button class="header-btn" id="btnResetToolbarPos">रीसेट करें (Reset)</button>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">आवाज भाषा (Voice Command Language)</span>
              <span class="setting-desc">Web Speech API के लिए भाषा</span>
            </div>
            <select id="settingVoiceLang" class="header-btn" style="background:#111;">
              <option value="hi-IN" ${s.voiceLang === 'hi-IN' ? 'selected' : ''}>हिंदी (hi-IN)</option>
              <option value="en-IN" ${s.voiceLang === 'en-IN' ? 'selected' : ''}>English (en-IN)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">चैनल नाम (Channel Brand)</span>
              <span class="setting-desc">शीर्ष पट्टी में प्रदर्शित चैनल का नाम</span>
            </div>
            <input type="text" id="settingChannelName" value="${s.channelName}" class="gemini-input" style="width:180px;" />
          </div>
        </div>

        <!-- SSIRO-UPDATE: About Section with App Logo -->
        <div class="settings-section">
          <div class="settings-section-title">के बारे में (About & Brand)</div>
          <div style="display:flex; align-items:center; gap:16px; padding:8px 0;">
            <img src="/assets/brand/logo.svg" alt="SSIRO Logo" style="width:64px; height:64px; border-radius:14px; box-shadow:var(--shadow-lg);" />
            <div>
              <div style="font-weight:700; font-size:15px; color:#ffffff;">Smart Studio Presenter Pro v1.1.0</div>
              <div style="font-size:12px; color:var(--primary-accent); margin-top:2px;">SSIRO Classes Edition</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">4K Teaching & Presentation Studio • 100% Client-Side</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.modalEl.querySelector('#btnSettingsClose')?.addEventListener('click', () => {
      this.close();
    });

    // Fit Mode
    const fitSelect = this.modalEl.querySelector('#settingFitMode') as HTMLSelectElement;
    fitSelect?.addEventListener('change', () => {
      store.updateSettings({ fitMode: fitSelect.value as any });
      if (fitSelect.value === 'stretch') {
        alert('चेतावनी: Stretch मोड गैर-समान अनुपात में स्लाइड को विकृत (distort) कर सकता है।');
      }
    });

    // SSIRO-UPDATE: Welcome Screen Settings Events
    const showWelcome = this.modalEl.querySelector('#settingShowWelcome') as HTMLInputElement;
    showWelcome?.addEventListener('change', () => {
      store.updateSettings({ showWelcomeScreen: showWelcome.checked });
    });

    const welcomeLine1 = this.modalEl.querySelector('#settingWelcomeLine1') as HTMLInputElement;
    welcomeLine1?.addEventListener('change', () => {
      store.updateSettings({ welcomeLine1: welcomeLine1.value.trim() });
    });

    const welcomeLine2 = this.modalEl.querySelector('#settingWelcomeLine2') as HTMLInputElement;
    welcomeLine2?.addEventListener('change', () => {
      store.updateSettings({ welcomeLine2: welcomeLine2.value.trim() });
    });

    const welcomeDurSlider = this.modalEl.querySelector('#settingWelcomeDuration') as HTMLInputElement;
    const welcomeDurVal = this.modalEl.querySelector('#welcomeDurationVal') as HTMLElement;
    welcomeDurSlider?.addEventListener('input', () => {
      const v = Number(welcomeDurSlider.value);
      if (welcomeDurVal) welcomeDurVal.textContent = `${v}s`;
      store.updateSettings({ welcomeDuration: v });
    });

    // SSIRO-UPDATE: Magnifier & Zoom Settings Events
    const magZoomSlider = this.modalEl.querySelector('#settingMagZoom') as HTMLInputElement;
    const magZoomVal = this.modalEl.querySelector('#magZoomVal') as HTMLElement;
    magZoomSlider?.addEventListener('input', () => {
      const v = Number(magZoomSlider.value);
      if (magZoomVal) magZoomVal.textContent = `${v}×`;
      store.updateSettings({ magnifierZoom: v });
    });

    const magSizeSlider = this.modalEl.querySelector('#settingMagSize') as HTMLInputElement;
    const magSizeVal = this.modalEl.querySelector('#magSizeVal') as HTMLElement;
    magSizeSlider?.addEventListener('input', () => {
      const v = Number(magSizeSlider.value);
      if (magSizeVal) magSizeVal.textContent = `${v}px`;
      store.updateSettings({ magnifierSize: v });
    });

    const magSpotlight = this.modalEl.querySelector('#settingMagSpotlight') as HTMLInputElement;
    magSpotlight?.addEventListener('change', () => {
      store.updateSettings({ magnifierSpotlight: magSpotlight.checked });
    });

    const magTouchPos = this.modalEl.querySelector('#settingMagTouchPos') as HTMLSelectElement;
    magTouchPos?.addEventListener('change', () => {
      store.updateSettings({ magnifierTouchPos: magTouchPos.value as any });
    });

    const keepPenWidth = this.modalEl.querySelector('#settingKeepPenWidth') as HTMLInputElement;
    keepPenWidth?.addEventListener('change', () => {
      store.updateSettings({ keepPenWidthOnZoom: keepPenWidth.checked });
    });

    const keepLens = this.modalEl.querySelector('#settingKeepLens') as HTMLInputElement;
    keepLens?.addEventListener('change', () => {
      store.updateSettings({ keepLensOnSlideChange: keepLens.checked });
    });

    const keepZoom = this.modalEl.querySelector('#settingKeepZoom') as HTMLInputElement;
    keepZoom?.addEventListener('change', () => {
      store.updateSettings({ keepZoomOnSlideChange: keepZoom.checked });
    });

    // Render Quality
    const qualitySelect = this.modalEl.querySelector('#settingRenderQuality') as HTMLSelectElement;
    qualitySelect?.addEventListener('change', () => {
      store.updateSettings({ renderQuality: qualitySelect.value as any });
    });

    // Auto Erase
    const autoErase = this.modalEl.querySelector('#settingAutoErase') as HTMLInputElement;
    autoErase?.addEventListener('change', () => {
      store.updateSettings({ autoEraseOnSlideChange: autoErase.checked });
    });

    // Keep per slide
    const keepPerSlide = this.modalEl.querySelector('#settingKeepPerSlide') as HTMLInputElement;
    keepPerSlide?.addEventListener('change', () => {
      store.updateSettings({ keepAnnotationsPerSlide: keepPerSlide.checked });
    });

    // Save API key
    const btnSaveKey = this.modalEl.querySelector('#btnSaveApiKey');
    const inputKey = this.modalEl.querySelector('#inputNewApiKey') as HTMLInputElement;
    const currentKeyDisplay = this.modalEl.querySelector('#currentKeyDisplay') as HTMLElement;

    btnSaveKey?.addEventListener('click', async () => {
      const raw = inputKey.value.trim();
      if (!raw) return;
      try {
        const masked = await keyVault.storeApiKey(raw);
        inputKey.value = '';
        currentKeyDisplay.textContent = masked;
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: 'Gemini API Key सुरक्षित एन्क्रिप्टेड रूप में सहेजी गई!' }
          })
        );
      } catch (err: any) {
        alert(`कुंजी सहेजने में त्रुटि: ${err.message}`);
      }
    });

    // Delete API key
    const btnDelKey = this.modalEl.querySelector('#btnDeleteApiKey');
    btnDelKey?.addEventListener('click', () => {
      if (confirm('क्या आप वाकई संग्रहीत API कुंजी को मिटाना चाहते हैं?')) {
        keyVault.deleteKey();
        currentKeyDisplay.textContent = 'कोई कुंजी सेट नहीं (None)';
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: 'API Key हटा दी गई।' }
          })
        );
      }
    });

    // Model name
    const modelInput = this.modalEl.querySelector('#settingGeminiModel') as HTMLInputElement;
    modelInput?.addEventListener('change', () => {
      store.updateSettings({ geminiModel: modelInput.value.trim() });
    });

    // Ghost timer
    const ghostSlider = this.modalEl.querySelector('#settingGhostTimer') as HTMLInputElement;
    const ghostVal = this.modalEl.querySelector('#ghostSecVal') as HTMLElement;
    ghostSlider?.addEventListener('input', () => {
      const v = Number(ghostSlider.value);
      ghostVal.textContent = `${v}s`;
      store.updateSettings({ toolbarIdleSeconds: v });
    });

    // Reset toolbar position
    const btnResetPos = this.modalEl.querySelector('#btnResetToolbarPos');
    btnResetPos?.addEventListener('click', () => {
      const tb = document.getElementById('toolbarContainer');
      if (tb) {
        tb.style.left = 'calc(50% - 240px)';
        tb.style.top = '80px';
        tb.style.transform = 'none';
        store.updateSettings({ toolbarPos: null });
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: 'टूलबार स्थिति डिफ़ॉल्ट पर रीसेट कर दी गई।' }
          })
        );
      }
    });

    // Voice language
    const voiceLang = this.modalEl.querySelector('#settingVoiceLang') as HTMLSelectElement;
    voiceLang?.addEventListener('change', () => {
      store.updateSettings({ voiceLang: voiceLang.value as any });
    });

    // Channel name
    const channelInput = this.modalEl.querySelector('#settingChannelName') as HTMLInputElement;
    channelInput?.addEventListener('change', () => {
      store.updateSettings({ channelName: channelInput.value.trim() });
    });

    window.addEventListener('toggle-settings', () => {
      this.toggle();
    });
  }

  open(): void {
    store.setState({ isSettingsOpen: true });
    this.render();
    this.bindEvents();
    this.modalEl.classList.remove('hidden');
  }

  close(): void {
    store.setState({ isSettingsOpen: false });
    this.modalEl.classList.add('hidden');
  }

  toggle(): void {
    if (store.getState().isSettingsOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

export const settingsPanel = new SettingsPanel();
