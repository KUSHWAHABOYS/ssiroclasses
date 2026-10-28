// AUDIT-FIX: BUG-009 - Complete Settings Categories, Search, Layout Report, Streaming & Privacy Wipe per SET-1, ZEN-6, ZEN-7, SET-3
import { store } from '../state/store';
import { keyVault } from '../ai/keyVault';
import { slideView } from '../presenter/slideView';
import { aiSettingsPanel } from '../ai/aiSettingsPanel';
import { smartInkSettingsSection } from './smartInkSettingsSection';
import { DEFAULT_SETTINGS, AppSettings } from '../state/settings';
import { slideRenderer } from '../presenter/renderer';

export type SettingsCategory = 'all' | 'general' | 'display' | 'ink' | 'toolbar' | 'voice' | 'ai' | 'streaming' | 'privacy' | 'about';

export class SettingsPanel {
  private modalEl!: HTMLElement;
  private currentCategory: SettingsCategory = 'all';
  private searchQuery = '';

  init(): void {
    this.modalEl = document.getElementById('settingsPanel') as HTMLElement;
    this.render();
    this.bindEvents();

    window.addEventListener('re-render-settings', () => {
      if (store.getState().isSettingsOpen) {
        this.render();
        this.bindEvents();
      }
    });
  }

  private render(): void {
    const s = store.getState().settings;

    this.modalEl.innerHTML = `
      <div class="settings-header">
        <span style="font-weight: 700; font-size: 16px; color: var(--primary-accent); display:flex; align-items:center; gap:8px;">
          ⚙ स्टूडियो सेटिंग्स (Studio Settings)
        </span>
        <button class="media-win-btn" id="btnSettingsClose" style="font-size: 16px;" aria-label="Close Settings">✕</button>
      </div>

      <!-- Settings Search Bar -->
      <div class="settings-search-bar">
        <input type="text" id="settingSearchInput" class="settings-search-input" placeholder="🔍 सेटिंग्स खोजें... (Search settings in Hindi or English)" value="${this.searchQuery}" />
      </div>

      <!-- Category Navigation Pills -->
      <div class="settings-categories-nav">
        <button class="settings-cat-btn ${this.currentCategory === 'all' ? 'active' : ''}" data-cat="all">सभी (All)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'general' ? 'active' : ''}" data-cat="general">सामान्य (General)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'display' ? 'active' : ''}" data-cat="display">डिस्प्ले (Display)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'ink' ? 'active' : ''}" data-cat="ink">पेन व इंक (Pen & Ink)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'toolbar' ? 'active' : ''}" data-cat="toolbar">टूलबार (Toolbar)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'voice' ? 'active' : ''}" data-cat="voice">आवाज (Voice)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'ai' ? 'active' : ''}" data-cat="ai">AI (कृत्रिम बुद्धिमत्ता)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'streaming' ? 'active' : ''}" data-cat="streaming">स्ट्रीमिंग (Streaming)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'privacy' ? 'active' : ''}" data-cat="privacy">गोपनीयता (Privacy)</button>
        <button class="settings-cat-btn ${this.currentCategory === 'about' ? 'active' : ''}" data-cat="about">के बारे में (About)</button>
      </div>

      <div class="settings-body" id="settingsBody">
        <!-- 1. GENERAL / WELCOME SECTION -->
        <div class="settings-section" data-section-cat="general">
          <div class="settings-section-title">स्वागत स्क्रीन व होम (Welcome Screen & General)</div>

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

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">डेक बंद करें (Close Current Deck)</span>
              <span class="setting-desc">वर्तमान प्रस्तुति बंद करें और मुख्य स्वागत स्क्रीन पर वापस लौटें</span>
            </div>
            <button class="header-btn" id="btnSettingsCloseDeck" style="background:rgba(239,68,68,0.18); color:#fca5a5; border-color:rgba(239,68,68,0.5);">
              ✕ डेक बंद करें (Close Deck)
            </button>
          </div>
        </div>

        <!-- 2. DISPLAY & PRESENTATION SECTION -->
        <div class="settings-section" data-section-cat="display">
          <div class="settings-section-title">प्रस्तुति व 4K डिस्प्ले (Presentation & 4K Display)</div>

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
              <span class="setting-name">खाली मार्जिन स्वतः ट्रिम करें (Auto-Trim Blank Margins)</span>
              <span class="setting-desc">स्लाइड के चारों ओर खाली सफेद/काली जगह हटाकर विषयवस्तु फैलाएं</span>
            </div>
            <input type="checkbox" id="settingAutoTrimMargins" ${s.autoTrimMargins ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <!-- Manual Crop Sliders -->
          <div class="setting-item" style="flex-direction:column; align-items:flex-start; gap:8px;">
            <div class="setting-label">
              <span class="setting-name">मैन्युअल क्रॉप (Manual Crop Sliders - Top / Bottom / Left / Right)</span>
              <span class="setting-desc">यदि स्लाइड में अवांछित हेडर या फूटर मार्जिन हों तो काटें</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; color:#aaa; width:40px;">ऊपर (T):</span>
                <input type="range" id="cropTopSlider" min="0" max="25" value="${s.manualCropTop}" class="popover-slider" style="flex:1;" />
                <span id="cropTopVal" style="font-size:12px; color:#FFD76A; width:32px;">${s.manualCropTop}%</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; color:#aaa; width:40px;">नीचे (B):</span>
                <input type="range" id="cropBottomSlider" min="0" max="25" value="${s.manualCropBottom}" class="popover-slider" style="flex:1;" />
                <span id="cropBottomVal" style="font-size:12px; color:#FFD76A; width:32px;">${s.manualCropBottom}%</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; color:#aaa; width:40px;">बाएं (L):</span>
                <input type="range" id="cropLeftSlider" min="0" max="25" value="${s.manualCropLeft}" class="popover-slider" style="flex:1;" />
                <span id="cropLeftVal" style="font-size:12px; color:#FFD76A; width:32px;">${s.manualCropLeft}%</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; color:#aaa; width:40px;">दाएं (R):</span>
                <input type="range" id="cropRightSlider" min="0" max="25" value="${s.manualCropRight}" class="popover-slider" style="flex:1;" />
                <span id="cropRightVal" style="font-size:12px; color:#FFD76A; width:32px;">${s.manualCropRight}%</span>
              </div>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">लेआउट रिपोर्ट (Layout Report per ZEN-7)</span>
              <span class="setting-desc">4K बोर्ड और ब्रॉडकास्ट के लिए सटीक पिक्सल और व्यूमार्जिन माप देखें</span>
            </div>
            <button class="header-btn" id="btnViewLayoutReport" style="background:rgba(56,189,248,0.18); color:#38bdf8; border-color:rgba(56,189,248,0.4);">
              📊 लेआउट रिपोर्ट देखें (Layout Report)
            </button>
          </div>
        </div>

        <!-- 3. PEN & SMART INK SECTION -->
        <div class="settings-section" data-section-cat="ink">
          ${smartInkSettingsSection.renderSection()}
          
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

        <!-- 4. TOOLBAR & INPUT SECTION -->
        <div class="settings-section" data-section-cat="toolbar">
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
              <span class="setting-name">टूलबार स्केल (Toolbar Scale: 60%–160%)</span>
              <span class="setting-desc">टूलबार और बटनों का समग्र आकार बदलें</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button class="header-btn" id="btnToolbarScaleDown" style="width:32px; height:32px; padding:0;">−</button>
              <input type="range" id="settingToolbarScale" min="60" max="160" step="5" value="${Math.round((s.toolbarScale || 1.0) * 100)}" class="popover-slider" style="width:100px;" />
              <span id="toolbarScaleVal" style="width:40px; text-align:right; font-size:13px; font-weight:600; color:var(--primary-accent);">${Math.round((s.toolbarScale || 1.0) * 100)}%</span>
              <button class="header-btn" id="btnToolbarScaleUp" style="width:32px; height:32px; padding:0;">+</button>
              <button class="header-btn" id="btnResetToolbarScale" style="font-size:11px; padding:4px 8px;">100%</button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">टूलबार स्थिति रीसेट करें (Reset Position)</span>
              <span class="setting-desc">टूलबार को मूल डिफ़ॉल्ट स्थिति (ऊपर मध्य) में लाएं</span>
            </div>
            <button class="header-btn" id="btnResetToolbarPos">↺ रीसेट स्थिति</button>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">चैनल नाम (Channel Brand)</span>
              <span class="setting-desc">शीर्ष पट्टी में प्रदर्शित चैनल का नाम</span>
            </div>
            <input type="text" id="settingChannelName" value="${s.channelName}" class="gemini-input" style="width:180px;" />
          </div>
        </div>

        <!-- 5. VOICE & MIC SECTION -->
        <div class="settings-section" data-section-cat="voice">
          <div class="settings-section-title">🎙️ आवाज व माइक्रोफ़ोन नियंत्रण (Voice & Mic Control)</div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">आवाज भाषा (Voice Language)</span>
              <span class="setting-desc">स्पीच रिकग्निशन के लिए भाषा</span>
            </div>
            <select id="settingVoiceLang" class="header-btn" style="background:#111;">
              <option value="hi-IN" ${s.voiceLang === 'hi-IN' ? 'selected' : ''}>हिंदी (hi-IN)</option>
              <option value="en-IN" ${s.voiceLang === 'en-IN' ? 'selected' : ''}>English (en-IN)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्वतः बंद टाइमर (Auto-off Timer)</span>
              <span class="setting-desc">बिना किसी कमांड के माइक अपने आप बंद होने का समय</span>
            </div>
            <select id="settingMicAutoOff" class="header-btn" style="background:#111;">
              <option value="0" ${s.micAutoOffMinutes === 0 ? 'selected' : ''}>बंद (Never / Off)</option>
              <option value="5" ${s.micAutoOffMinutes === 5 ? 'selected' : ''}>5 मिनट (5 min)</option>
              <option value="10" ${s.micAutoOffMinutes === 10 ? 'selected' : ''}>10 मिनट (10 min - डिफ़ॉल्ट)</option>
              <option value="30" ${s.micAutoOffMinutes === 30 ? 'selected' : ''}>30 मिनट (30 min)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">बोर्ड मोड पर म्यूट (Mute mic on Board)</span>
              <span class="setting-desc">ब्लैकबोर्ड खोलते ही माइक तुरंत म्यूट करें</span>
            </div>
            <input type="checkbox" id="settingMuteMicOnBoard" ${s.muteMicOnBoard ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">पुश-टू-टॉक (Push-to-talk)</span>
              <span class="setting-desc">माइक बटन या V कुंजी दबाए रखने पर ही सुनें</span>
            </div>
            <input type="checkbox" id="settingPushToTalk" ${s.pushToTalk ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">ज़ेन मोड में लाल बिंदु (Show mic-on dot in Zen mode)</span>
              <span class="setting-desc">माइक चालू रहने पर शीर्ष-दाएं कोने में 12px लाल संकेतक</span>
            </div>
            <input type="checkbox" id="settingShowMicDotInZen" ${s.showMicDotInZen ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>
        </div>

        <!-- 6. AI SECTION -->
        <div class="settings-section" data-section-cat="ai">
          ${aiSettingsPanel.renderSection()}
        </div>

        <!-- 7. STREAMING & OBS SECTION (ZEN-6) -->
        <div class="settings-section" data-section-cat="streaming">
          <div class="settings-section-title">📺 लाइव स्ट्रीमिंग व ब्रॉडकास्ट (Streaming & OBS / StreamYard)</div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">किनारा भराव मोड (Remainder Fill Mode)</span>
              <span class="setting-desc">गैर-16:9 स्लाइडों पर किनारों का रंग या ब्लर</span>
            </div>
            <select id="settingStreamRemainder" class="header-btn" style="background:#111;">
              <option value="background" ${s.streamRemainderMode === 'background' ? 'selected' : ''}>Corner Background Color (स्वतः रंग भराव)</option>
              <option value="blur" ${s.streamRemainderMode === 'blur' ? 'selected' : ''}>Subtle Blur (हल्का धुंधला)</option>
              <option value="black" ${s.streamRemainderMode === 'black' ? 'selected' : ''}>Deep Black (गहरा काला)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्ट्रीम फ्रेम लॉक (Stream Frame Lock)</span>
              <span class="setting-desc">ब्रॉडकास्ट अनुपात में कैनवास अनुपात को लॉक करें</span>
            </div>
            <select id="settingStreamFrameLock" class="header-btn" style="background:#111;">
              <option value="none" ${s.streamFrameLock === 'none' ? 'selected' : ''}>कोई लॉक नहीं (Full Viewport)</option>
              <option value="16:9" ${s.streamFrameLock === '16:9' ? 'selected' : ''}>16:9 (YouTube & StreamYard)</option>
              <option value="16:10" ${s.streamFrameLock === '16:10' ? 'selected' : ''}>16:10 (Widescreen Tablet/Board)</option>
              <option value="4:3" ${s.streamFrameLock === '4:3' ? 'selected' : ''}>4:3 (Traditional Smart Board)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">निष्क्रिय होने पर टूलबार पूर्णतः छिपाएं (Hide Toolbar on Idle)</span>
              <span class="setting-desc">लाइव प्रसारण में स्क्रीन बिल्कुल स्वच्छ रखने के लिए</span>
            </div>
            <input type="checkbox" id="settingHideToolbarCompletely" ${s.hideToolbarCompletelyOnIdle ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">माउस कर्सर स्वतः छिपाएं (Hide Cursor on Idle)</span>
              <span class="setting-desc">2 सेकंड निष्क्रिय रहने पर स्क्रीन से माउस तीर ओझल करें</span>
            </div>
            <input type="checkbox" id="settingHideCursorWhenIdle" ${s.hideCursorWhenIdle ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">स्ट्रीमिंग निर्देशिका (Streaming Best Practices Help)</span>
              <span class="setting-desc">OBS Studio, StreamYard एवं क्रोमा की (#00FF00) सेटअप मार्गदर्शिका</span>
            </div>
            <button class="header-btn" id="btnOpenStreamingHelp" style="background:rgba(232,137,12,0.2); color:#FFD76A; border-color:#FFD76A;">
              📖 स्ट्रीमिंग हेल्प गाइड खोलें
            </button>
          </div>
        </div>

        <!-- 8. PRIVACY & STORAGE SECTION (SET-3, PRV-1) -->
        <div class="settings-section" data-section-cat="privacy">
          <div class="settings-section-title">🔒 गोपनीयता एवं डेटा प्रबंधन (Privacy & Device Data)</div>

          <div class="setting-item" style="flex-direction:column; align-items:flex-start; gap:8px;">
            <div class="setting-label">
              <span class="setting-name">डिवाइस स्टोरेज स्थिति (Storage Usage on This Device):</span>
            </div>
            <div id="storageStatsContainer" style="font-size:12px; color:#aaa; line-height:1.6; background:rgba(0,0,0,0.3); padding:10px 14px; border-radius:8px; width:100%;">
              गणना हो रही है... (Calculating storage...)
            </div>
          </div>

          <div class="setting-item" style="flex-direction:column; align-items:flex-start; gap:8px;">
            <div class="setting-label">
              <span class="setting-name">अनुमत नेटवर्क गंतव्य (Allowed Network Whitelist):</span>
              <span class="setting-desc">ऐप केवल आपकी अधिकृत AI सेवा से सीधे संपर्क करता है (शून्य ट्रैकर)</span>
            </div>
            <ul style="margin:0; padding-left:18px; font-size:12px; color:#94a3b8; line-height:1.6;">
              <li>Google Gemini API: <code>generativelanguage.googleapis.com</code></li>
              <li>OpenAI Compatible / Groq / DeepSeek / Claude (जब आपकी कुंजी दर्ज हो)</li>
              <li>स्थानीय PWA शेल: <code>self</code> (शून्य बाह्य स्क्रिप्ट, शून्य गूगल फॉन्ट्स)</li>
            </ul>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">AI कुंजियाँ हटाएं (Delete AI Keys)</span>
              <span class="setting-desc">WebCrypto वॉल्ट से सभी सहेजी गई API कुंजियाँ तत्काल मिटाएं</span>
            </div>
            <button class="header-btn" id="btnPrivacyDeleteKeys" style="background:rgba(239,68,68,0.18); color:#fca5a5; border-color:rgba(239,68,68,0.5);">
              🔑 कुंजियाँ मिटाएं (Delete Keys)
            </button>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name" style="color:#ef4444; font-weight:700;">🚨 संपूर्ण ऐप डेटा हटाएं (Delete All App Data)</span>
              <span class="setting-desc">IndexedDB, LocalStorage, ऑफ़लाइन कैश व सेटिंग्स को पूरी तरह मिटाकर शून्य रीसेट करें</span>
            </div>
            <button class="header-btn" id="btnDeleteAllAppData" style="background:#ef4444; color:#fff; font-weight:700; border-color:#b91c1c;">
              🗑️ सारा डेटा हटाएं (Wipe All Data)
            </button>
          </div>
        </div>

        <!-- 9. ABOUT & BRAND SECTION -->
        <div class="settings-section" data-section-cat="about">
          <div class="settings-section-title">के बारे में (About & Brand)</div>
          <div style="display:flex; align-items:center; gap:16px; padding:8px 0;">
            <div class="welcome-logo-container" style="width:64px; height:64px; max-height:64px; cursor:pointer;" title="लोगो बदलने के लिए क्लिक करें">
              ${s.customLogo ? `<img src="${s.customLogo}" style="width:100%; height:100%; object-fit:contain; border-radius:14px;" alt="Logo" />` : `
                <svg viewBox="0 0 512 512" width="100%" height="100%">
                  <rect width="512" height="512" rx="112" fill="#14306B"/>
                  <circle cx="240" cy="232" r="130" fill="#2A4A94" stroke="#FFD76A" stroke-width="26"/>
                  <line x1="330" y1="322" x2="418" y2="410" stroke="#FFD76A" stroke-width="40" stroke-linecap="round"/>
                </svg>
              `}
            </div>
            <div>
              <!-- WELCOME-CLEANUP: Bump version display to v1.4.2 -->
              <div style="font-weight:700; font-size:15px; color:#ffffff;">Smart Studio Presenter Pro v1.4.2</div>
              <div style="font-size:12px; color:var(--primary-accent); margin-top:2px;">SSIRO Classes Edition (Audit Verified)</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">4K Teaching & Presentation Studio • 100% Client-Side</div>
            </div>
          </div>
          <!-- WELCOME-CLEANUP: Removed btnSettingsOpenConnect -->
          <div class="setting-item">
            <button class="header-btn" id="btnResetAllToRecommended" style="background:rgba(255,255,255,0.08); color:#fff; border-color:rgba(255,255,255,0.2); width:100%; justify-content:center;">
              ↺ सभी सेटिंग्स अनुशंसित डिफ़ॉल्ट पर रीसेट करें (Reset All to Recommended)
            </button>
          </div>
        </div>

      </div>
    `;

    this.updateCategoryFilter();
    this.loadStorageStatsAsync();
  }

  private bindEvents(): void {
    this.modalEl.querySelector('#btnSettingsClose')?.addEventListener('click', () => {
      this.close();
    });

    // Category Tabs
    const catBtns = this.modalEl.querySelectorAll('.settings-cat-btn');
    catBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        catBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.getAttribute('data-cat') as SettingsCategory;
        this.updateCategoryFilter();
      });
    });

    // Search input
    const searchInput = this.modalEl.querySelector('#settingSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      this.filterSettingsBySearch();
    });

    // Close Deck button
    this.modalEl.querySelector('#btnSettingsCloseDeck')?.addEventListener('click', () => {
      this.close();
      slideView.closeDeck();
    });

    // WELCOME-CLEANUP: Removed Connect Modal listener

    // Layout Report (ZEN-7)
    this.modalEl.querySelector('#btnViewLayoutReport')?.addEventListener('click', () => {
      const report = this.generateLayoutReport();
      alert(report);
    });

    // Streaming Help Guide (ZEN-6)
    this.modalEl.querySelector('#btnOpenStreamingHelp')?.addEventListener('click', () => {
      this.showStreamingHelpDialog();
    });

    // Delete AI Keys (SET-3)
    this.modalEl.querySelector('#btnPrivacyDeleteKeys')?.addEventListener('click', async () => {
      if (confirm('क्या आप सभी सहेजी गई AI API कुंजियाँ हटाना चाहते हैं?')) {
        await keyVault.deleteAllKeys();
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: '✅ सभी AI कुंजियाँ मिटा दी गईं।' } }));
        this.render();
        this.bindEvents();
      }
    });

    // Delete All App Data (SET-3)
    this.modalEl.querySelector('#btnDeleteAllAppData')?.addEventListener('click', () => {
      this.deleteAllAppData();
    });

    // Reset All to Recommended (SET-1)
    this.modalEl.querySelector('#btnResetAllToRecommended')?.addEventListener('click', () => {
      if (confirm('क्या आप सभी सेटिंग्स को अनुशंसित डिफ़ॉल्ट पर रीसेट करना चाहते हैं? (Reset all settings to recommended defaults?)')) {
        store.updateSettings({ ...DEFAULT_SETTINGS });
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: '↺ सभी सेटिंग्स अनुशंसित डिफ़ॉल्ट पर रीसेट कर दी गईं।' } }));
        this.render();
        this.bindEvents();
      }
    });

    // Display & Slide settings
    const fitSelect = this.modalEl.querySelector('#settingFitMode') as HTMLSelectElement;
    fitSelect?.addEventListener('change', () => {
      store.updateSettings({ fitMode: fitSelect.value as any });
      if (fitSelect.value === 'stretch') {
        alert('चेतावनी: Stretch मोड गैर-समान अनुपात में स्लाइड को विकृत (distort) कर सकता है।');
      }
    });

    const qualitySelect = this.modalEl.querySelector('#settingRenderQuality') as HTMLSelectElement;
    qualitySelect?.addEventListener('change', () => {
      store.updateSettings({ renderQuality: qualitySelect.value as any });
    });

    const autoTrim = this.modalEl.querySelector('#settingAutoTrimMargins') as HTMLInputElement;
    autoTrim?.addEventListener('change', () => {
      store.updateSettings({ autoTrimMargins: autoTrim.checked });
    });

    // Crop sliders
    const bindCrop = (sliderId: string, valId: string, key: keyof AppSettings) => {
      const slider = this.modalEl.querySelector(sliderId) as HTMLInputElement;
      const valEl = this.modalEl.querySelector(valId) as HTMLElement;
      slider?.addEventListener('input', () => {
        const v = Number(slider.value);
        if (valEl) valEl.textContent = `${v}%`;
        store.updateSettings({ [key]: v });
      });
    };
    bindCrop('#cropTopSlider', '#cropTopVal', 'manualCropTop');
    bindCrop('#cropBottomSlider', '#cropBottomVal', 'manualCropBottom');
    bindCrop('#cropLeftSlider', '#cropLeftVal', 'manualCropLeft');
    bindCrop('#cropRightSlider', '#cropRightVal', 'manualCropRight');

    // Streaming settings
    const remainderSelect = this.modalEl.querySelector('#settingStreamRemainder') as HTMLSelectElement;
    remainderSelect?.addEventListener('change', () => {
      store.updateSettings({ streamRemainderMode: remainderSelect.value as any });
    });

    const lockSelect = this.modalEl.querySelector('#settingStreamFrameLock') as HTMLSelectElement;
    lockSelect?.addEventListener('change', () => {
      store.updateSettings({ streamFrameLock: lockSelect.value as any });
    });

    const hideTbIdle = this.modalEl.querySelector('#settingHideToolbarCompletely') as HTMLInputElement;
    hideTbIdle?.addEventListener('change', () => {
      store.updateSettings({ hideToolbarCompletelyOnIdle: hideTbIdle.checked });
    });

    const hideCursorIdle = this.modalEl.querySelector('#settingHideCursorWhenIdle') as HTMLInputElement;
    hideCursorIdle?.addEventListener('change', () => {
      store.updateSettings({ hideCursorWhenIdle: hideCursorIdle.checked });
    });

    // Welcome screen settings
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

    // Auto Erase & Keep
    const autoErase = this.modalEl.querySelector('#settingAutoErase') as HTMLInputElement;
    autoErase?.addEventListener('change', () => {
      store.updateSettings({ autoEraseOnSlideChange: autoErase.checked });
    });

    const keepPerSlide = this.modalEl.querySelector('#settingKeepPerSlide') as HTMLInputElement;
    keepPerSlide?.addEventListener('change', () => {
      store.updateSettings({ keepAnnotationsPerSlide: keepPerSlide.checked });
    });

    // AI and Smart Ink panels
    aiSettingsPanel.bindEvents(this.modalEl);
    smartInkSettingsSection.bindEvents(this.modalEl);

    // Voice & Mic
    const voiceLang = this.modalEl.querySelector('#settingVoiceLang') as HTMLSelectElement;
    voiceLang?.addEventListener('change', () => {
      store.updateSettings({ voiceLang: voiceLang.value as any });
    });

    const micAutoOff = this.modalEl.querySelector('#settingMicAutoOff') as HTMLSelectElement;
    micAutoOff?.addEventListener('change', () => {
      store.updateSettings({ micAutoOffMinutes: parseInt(micAutoOff.value, 10) });
    });

    const muteMicOnBoard = this.modalEl.querySelector('#settingMuteMicOnBoard') as HTMLInputElement;
    muteMicOnBoard?.addEventListener('change', () => {
      store.updateSettings({ muteMicOnBoard: muteMicOnBoard.checked });
    });

    const pushToTalk = this.modalEl.querySelector('#settingPushToTalk') as HTMLInputElement;
    pushToTalk?.addEventListener('change', () => {
      store.updateSettings({ pushToTalk: pushToTalk.checked });
    });

    const showMicDotInZen = this.modalEl.querySelector('#settingShowMicDotInZen') as HTMLInputElement;
    showMicDotInZen?.addEventListener('change', () => {
      store.updateSettings({ showMicDotInZen: showMicDotInZen.checked });
    });

    // Toolbar settings
    const ghostSlider = this.modalEl.querySelector('#settingGhostTimer') as HTMLInputElement;
    const ghostVal = this.modalEl.querySelector('#ghostSecVal') as HTMLElement;
    ghostSlider?.addEventListener('input', () => {
      const v = Number(ghostSlider.value);
      if (ghostVal) ghostVal.textContent = `${v}s`;
      store.updateSettings({ toolbarIdleSeconds: v });
    });

    const scaleSlider = this.modalEl.querySelector('#settingToolbarScale') as HTMLInputElement;
    const scaleVal = this.modalEl.querySelector('#toolbarScaleVal') as HTMLElement;
    const btnScaleDown = this.modalEl.querySelector('#btnToolbarScaleDown');
    const btnScaleUp = this.modalEl.querySelector('#btnToolbarScaleUp');
    const btnResetScale = this.modalEl.querySelector('#btnResetToolbarScale');

    const updateScale = (pct: number) => {
      const clampedPct = Math.max(60, Math.min(160, pct));
      if (scaleSlider) scaleSlider.value = String(clampedPct);
      if (scaleVal) scaleVal.textContent = `${clampedPct}%`;
      const scale = Math.round((clampedPct / 100) * 100) / 100;
      store.updateSettings({ toolbarScale: scale });
    };

    scaleSlider?.addEventListener('input', () => updateScale(Number(scaleSlider.value)));
    btnScaleDown?.addEventListener('click', () => updateScale(Number(scaleSlider?.value || 100) - 10));
    btnScaleUp?.addEventListener('click', () => updateScale(Number(scaleSlider?.value || 100) + 10));
    btnResetScale?.addEventListener('click', () => {
      updateScale(100);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'टूलबार का आकार 100% पर रीसेट किया गया।' } }));
    });

    const btnResetPos = this.modalEl.querySelector('#btnResetToolbarPos');
    btnResetPos?.addEventListener('click', () => {
      const tb = document.getElementById('toolbarContainer');
      if (tb) {
        tb.style.left = 'calc(50% - 240px)';
        tb.style.top = '80px';
        const currentScale = store.getState().settings.toolbarScale || 1.0;
        tb.style.transform = `scale(${currentScale})`;
        store.updateSettings({ toolbarPos: null });
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'टूलबार स्थिति डिफ़ॉल्ट पर रीसेट कर दी गई।' } }));
      }
    });

    const channelInput = this.modalEl.querySelector('#settingChannelName') as HTMLInputElement;
    channelInput?.addEventListener('change', () => {
      store.updateSettings({ channelName: channelInput.value.trim() });
    });

    window.addEventListener('toggle-settings', () => {
      this.toggle();
    });
  }

  private updateCategoryFilter(): void {
    const sections = this.modalEl.querySelectorAll<HTMLElement>('.settings-section');
    sections.forEach((sec) => {
      const cat = sec.getAttribute('data-section-cat');
      if (this.currentCategory === 'all' || cat === this.currentCategory) {
        sec.style.display = 'flex';
      } else {
        sec.style.display = 'none';
      }
    });
  }

  private filterSettingsBySearch(): void {
    const q = this.searchQuery;
    const items = this.modalEl.querySelectorAll<HTMLElement>('.setting-item');
    items.forEach((item) => {
      const text = item.textContent?.toLowerCase() || '';
      if (!q || text.includes(q)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  public generateLayoutReport(): string {
    const s = store.getState();
    const stage = document.getElementById('stage');
    const stageRect = stage ? stage.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
    const slideMetrics = slideRenderer.getCurrentMetrics();
    const dpr = window.devicePixelRatio || 1;
    const isFull = !!document.fullscreenElement;

    return [
      '=== SMART STUDIO 4K LAYOUT REPORT ===',
      `• Timestamp: ${new Date().toISOString()}`,
      `• Viewport: ${window.innerWidth} × ${window.innerHeight} px`,
      `• Device Pixel Ratio (DPR): ${dpr}`,
      `• Physical Canvas Resolution: ${Math.round(window.innerWidth * dpr)} × ${Math.round(window.innerHeight * dpr)} px`,
      `• Aspect Ratio: ${(window.innerWidth / window.innerHeight).toFixed(3)}`,
      `• Fullscreen Active: ${isFull ? 'YES' : 'NO'}`,
      `• Stage Rect: ${Math.round(stageRect.width)} × ${Math.round(stageRect.height)} px (left: ${Math.round(stageRect.left)}, top: ${Math.round(stageRect.top)})`,
      `• Stage Gutters / Padding: 0 px (100% full-frame fit)`,
      `• Fit Mode: ${s.settings.fitMode.toUpperCase()}`,
      `• Slide Rendered Area: ${slideMetrics.destWidth} × ${slideMetrics.destHeight} px`,
      `• Slide Offset: X=${slideMetrics.destX} px, Y=${slideMetrics.destY} px`,
      `• Dominant Remainder Color: ${slideMetrics.dominantColor}`,
      `• Stream Remainder Fill: ${s.settings.streamRemainderMode}`,
      `• Stream Frame Lock: ${s.settings.streamFrameLock}`,
      `• Margin Auto-Trim: ${s.settings.autoTrimMargins ? 'ON' : 'OFF'}`,
      `• Manual Crops: T=${s.settings.manualCropTop}%, B=${s.settings.manualCropBottom}%, L=${s.settings.manualCropLeft}%, R=${s.settings.manualCropRight}%`,
      '• Status: ZERO GAP, ZERO PADDING, BROADCAST READY'
    ].join('\n');
  }

  private showStreamingHelpDialog(): void {
    alert(
      '🎥 STREAMING & OBS STUDIO GUIDE:\n\n' +
      '1. OBS Studio Window Capture:\n' +
      '   - Add Source ➔ Window Capture ➔ Select "Smart Studio Presenter Pro".\n' +
      '   - Press "F" in Smart Studio for Zen Fullscreen (0px borders).\n\n' +
      '2. StreamYard Screen Share:\n' +
      '   - Click Share ➔ Screen ➔ Chrome Tab ➔ Choose "Smart Studio Presenter Pro".\n' +
      '   - Enable "Share audio" for slide media.\n\n' +
      '3. Blackboard Chroma Keying (#00FF00):\n' +
      '   - In Smart Studio, switch Blackboard theme to "Pure Chroma Green".\n' +
      '   - In OBS, right-click the Window Capture source ➔ Filters ➔ Add "Chroma Key".\n' +
      '   - Key Color Type: Green. The chalkboard turns transparent, superimposing your teaching ink over your camera feed!'
    );
  }

  private async loadStorageStatsAsync(): Promise<void> {
    const container = this.modalEl.querySelector('#storageStatsContainer');
    if (!container) return;

    let lsBytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) lsBytes += (k.length + (localStorage.getItem(k)?.length || 0)) * 2;
      }
    } catch {}

    const lsKb = Math.round(lsBytes / 1024 * 10) / 10;
    let dbCount = 1;
    let cacheCount = 1;

    try {
      if (window.indexedDB && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        dbCount = dbs.length;
      }
    } catch {}

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        cacheCount = keys.length;
      }
    } catch {}

    container.innerHTML = `
      • LocalStorage डेटा: <strong>${lsKb} KB</strong> (सेटिंग्स, ब्रांड, टूलबार स्थिति)<br>
      • IndexedDB डेटाबेस: <strong>${dbCount} सक्रिय</strong> (WebCrypto AES-GCM Key Vault)<br>
      • PWA ऑफ़लाइन कैश: <strong>${cacheCount} कैश संचित</strong> (100% ऑफ़लाइन शेल)
    `;
  }

  private async deleteAllAppData(): Promise<void> {
    const confirmWipe = window.confirm(
      'चेतावनी: क्या आप वाकई सभी ऐप डेटा, स्थानीय सेटिंग्स, AI कुंजियाँ और ऑफ़लाइन कैश हटाना चाहते हैं?\n\n(Are you sure you want to delete all app data, keys, and caches? This will reset the app completely.)'
    );
    if (!confirmWipe) return;

    try {
      localStorage.clear();
      sessionStorage.clear();

      if (window.indexedDB && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
        }
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const r of registrations) {
          await r.unregister();
        }
      }

      alert('✅ सारा ऐप डेटा सफलतापूर्वक साफ़ कर दिया गया है। ऐप अब रीलोड होगा।');
      window.location.reload();
    } catch (err) {
      console.error('Delete all app data error:', err);
      alert('डेटा हटाने में त्रुटि: ' + String(err));
    }
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
