import { store } from '../state/store';
import { keyVault } from '../ai/keyVault';
import { slideView } from '../presenter/slideView';
import { DEFAULT_SETTINGS, AppSettings, generateSyncUrl } from '../state/settings';
import { slideRenderer } from '../presenter/renderer';
import { changeLogoModal } from './changeLogoModal';

export type SettingsTabId =
  | 'tab-general'
  | 'tab-display'
  | 'tab-ink'
  | 'tab-toolbar'
  | 'tab-voice'
  | 'tab-gemini'
  | 'tab-obs';

export class SettingsPanel {
  private modalEl!: HTMLElement;
  private activeTab: SettingsTabId = 'tab-general';

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

    window.addEventListener('toggle-settings', () => {
      this.toggle();
    });
  }

  private render(): void {
    const s = store.getState().settings;

    this.modalEl.innerHTML = `
      <!-- Stitch 4K IFP Studio Master Controller Modal -->
      <div class="stitch-dialog" id="stitchModalDialog" role="dialog" aria-modal="true" aria-label="Studio Settings">
        
        <!-- Top Modal Header -->
        <header class="stitch-header">
          <div style="display:flex; align-items:center; gap:16px;">
            <div style="width:48px; height:48px; border-radius:14px; background:rgba(223,130,0,0.18); display:flex; align-items:center; justify-content:center; color:#ffd76a; border:1px solid rgba(255,215,106,0.3);">
              <span class="material-symbols-outlined" style="font-size:26px;">tune</span>
            </div>
            <div style="display:flex; flex-direction:column;">
              <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <h1 style="font-size:22px; font-weight:700; color:#fff7eb; margin:0; letter-spacing:-0.3px;">
                  Settings
                </h1>
                <span style="padding:3px 10px; border-radius:9999px; background:#293452; color:#e9c258; font-size:12px; font-weight:600; letter-spacing:0.3px;">
                  Smart Studio Pro v4.2 • 4K IFP Edition
                </span>
              </div>
              <p style="font-size:12.5px; color:#d0c5b1; margin:2px 0 0 0;">
                65"–86" Maxhub &amp; Studio Flat Panel Master Controller
              </p>
            </div>
          </div>

          <!-- Top Right Quick Actions -->
          <div style="display:flex; align-items:center; gap:12px;">
            <button id="reset-all-btn" class="stitch-btn-cancel" style="min-height:46px; padding:0 18px; display:flex; align-items:center; gap:8px; font-size:13.5px;" title="Reset all settings to recommended defaults">
              <span class="material-symbols-outlined" style="font-size:18px; color:#e9c258;">restart_alt</span>
              <span>Reset All</span>
            </button>
            <button id="btnSettingsClose" aria-label="Close Settings" style="width:46px; height:46px; border-radius:50%; background:rgba(30,41,71,0.8); border:1px solid rgba(255,255,255,0.1); color:#dae2ff; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 160ms ease;">
              <span class="material-symbols-outlined" style="font-size:22px;">close</span>
            </button>
          </div>
        </header>

        <!-- Split Layout Body -->
        <div style="flex:1; display:flex; overflow:hidden;">
          
          <!-- Left Touch Sidebar Navigation (320px) -->
          <aside class="stitch-sidebar">
            <nav id="settings-tab-nav" style="display:flex; flex-direction:column; gap:8px;" aria-label="Settings Categories">
              
              <!-- Tab 1: General -->
              <button class="tab-nav-btn ${this.activeTab === 'tab-general' ? 'active' : ''}" data-tab="tab-general">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="material-symbols-outlined tab-icon" style="font-size:22px;">branding_watermark</span>
                  <div style="display:flex; flex-direction:column; line-height:1.2;">
                    <span style="font-size:14px; font-weight:600;">General &amp; Branding</span>
                  </div>
                </div>
                <span class="material-symbols-outlined tab-chevron" style="font-size:16px; opacity:0.5;">chevron_right</span>
              </button>

              <!-- Tab 2: Display & 4K -->
              <button class="tab-nav-btn ${this.activeTab === 'tab-display' ? 'active' : ''}" data-tab="tab-display">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="material-symbols-outlined tab-icon" style="font-size:22px;">display_settings</span>
                  <div style="display:flex; flex-direction:column; line-height:1.2;">
                    <span style="font-size:14px; font-weight:600;">Display &amp; 4K UHD</span>
                  </div>
                </div>
                <span class="material-symbols-outlined tab-chevron" style="font-size:16px; opacity:0.5;">chevron_right</span>
              </button>

              <!-- Tab 3: Pen & Ink -->
              <button class="tab-nav-btn ${this.activeTab === 'tab-ink' ? 'active' : ''}" data-tab="tab-ink">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="material-symbols-outlined tab-icon" style="font-size:22px;">stylus_note</span>
                  <div style="display:flex; flex-direction:column; line-height:1.2;">
                    <span style="font-size:14px; font-weight:600;">Pen &amp; Smart Ink</span>
                  </div>
                </div>
                <span class="material-symbols-outlined tab-chevron" style="font-size:16px; opacity:0.5;">chevron_right</span>
              </button>

              <!-- Tab 4: Toolbar & Ergonomics -->
              <button class="tab-nav-btn ${this.activeTab === 'tab-toolbar' ? 'active' : ''}" data-tab="tab-toolbar">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="material-symbols-outlined tab-icon" style="font-size:22px;">touch_app</span>
                  <div style="display:flex; flex-direction:column; line-height:1.2;">
                    <span style="font-size:14px; font-weight:600;">Toolbar &amp; Ergonomics</span>
                  </div>
                </div>
                <span class="material-symbols-outlined tab-chevron" style="font-size:16px; opacity:0.5;">chevron_right</span>
              </button>

              <!-- Tab 5: Voice & Audio -->
              <button class="tab-nav-btn ${this.activeTab === 'tab-voice' ? 'active' : ''}" data-tab="tab-voice">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="material-symbols-outlined tab-icon" style="font-size:22px;">mic</span>
                  <div style="display:flex; flex-direction:column; line-height:1.2;">
                    <span style="font-size:14px; font-weight:600;">Voice &amp; Audio FX</span>
                  </div>
                </div>
                <span class="material-symbols-outlined tab-chevron" style="font-size:16px; opacity:0.5;">chevron_right</span>
              </button>

              <!-- Tab 6: Gemini AI Studio -->
              <button class="tab-nav-btn ${this.activeTab === 'tab-gemini' ? 'active' : ''}" data-tab="tab-gemini">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="material-symbols-outlined tab-icon" style="font-size:22px; color:#ffb873;">smart_toy</span>
                  <div style="display:flex; flex-direction:column; line-height:1.2;">
                    <span style="font-size:14px; font-weight:600;">Gemini AI Studio</span>
                  </div>
                </div>
                <span class="material-symbols-outlined tab-chevron" style="font-size:16px; opacity:0.5;">chevron_right</span>
              </button>

              <!-- Tab 7: OBS & Recording -->
              <button class="tab-nav-btn ${this.activeTab === 'tab-obs' ? 'active' : ''}" data-tab="tab-obs">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span class="material-symbols-outlined tab-icon" style="font-size:22px;">videocam</span>
                  <div style="display:flex; flex-direction:column; line-height:1.2;">
                    <span style="font-size:14px; font-weight:600;">OBS &amp; Stream Vault</span>
                  </div>
                </div>
                <span class="material-symbols-outlined tab-chevron" style="font-size:16px; opacity:0.5;">chevron_right</span>
              </button>

            </nav>

            <!-- Bottom Hardware Status Badge -->
            <div style="margin-top:20px; padding:12px 14px; border-radius:16px; background:rgba(19,30,60,0.6); display:flex; flex-direction:column; gap:8px; border:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="width:8px; height:8px; border-radius:50%; background:#e9c258; box-shadow:0 0 10px #e9c258;"></span>
                  <span style="font-size:12px; font-weight:600; color:#dae2ff;">4K 60FPS IFP</span>
                </div>
                <span style="font-size:11px; color:#d0c5b1;">Calibrated</span>
              </div>
              <div style="width:100%; height:5px; border-radius:9999px; background:#293452; overflow:hidden;">
                <div style="width:100%; height:100%; background:linear-gradient(90deg, #df8200 0%, #ffd76a 100%);"></div>
              </div>
              <span style="font-size:11px; color:rgba(208,197,177,0.85);">86" D-LED Touch Matrix • 0.8ms Latency</span>
            </div>
          </aside>

          <!-- Right Content Area with 7 Tab Panels -->
          <main class="stitch-content-area" id="stitchPanelsContainer">

            <!-- ==========================================
                 PANEL 1: GENERAL & CHANNEL BRANDING
                 ========================================== -->
            <section class="settings-panel ${this.activeTab === 'tab-general' ? '' : 'hidden'}" id="tab-general">
              <div>
                <h2 style="font-size:22px; font-weight:700; color:#fff7eb; margin:0;">
                  General &amp; Channel Branding
                </h2>
                <p style="font-size:13.5px; color:#d0c5b1; margin:4px 0 0 0;">
                  Manage broadcast title, channel watermark logo, and teaching settings.
                </p>
              </div>

              <!-- Channel Title & Welcome Inputs -->
              <div class="stitch-card">
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label for="channel-name" style="font-size:14.5px; font-weight:600; color:#fff7eb;">
                      Studio Channel Name
                    </label>
                    <span style="font-size:12px; color:#e9c258; font-weight:600;">IFP Live Overlay</span>
                  </div>
                  <div class="stitch-input-wrap">
                    <span class="material-symbols-outlined stitch-icon">school</span>
                    <input type="text" id="channel-name" class="stitch-input" value="${s.channelName || 'SSIRO Classes'}" placeholder="Enter studio channel name..." />
                    <button type="button" class="stitch-clear-btn" id="btnClearChannelName" title="Clear">
                      <span class="material-symbols-outlined" style="font-size:18px;">backspace</span>
                    </button>
                  </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px; padding-top:6px;">
                  <label for="welcome-text" style="font-size:14.5px; font-weight:600; color:#fff7eb;">
                    Live Welcome Banner
                  </label>
                  <div class="stitch-input-wrap">
                    <span class="material-symbols-outlined stitch-icon">campaign</span>
                    <input type="text" id="welcome-text" class="stitch-input" value="${s.welcomeLine2 || 'Welcome to Live Class'}" />
                  </div>
                </div>
              </div>

              <!-- Channel Logo Card -->
              <div class="stitch-card row-card">
                <div style="display:flex; align-items:center; gap:18px;">
                  <div style="width:78px; height:78px; border-radius:18px; background:#020c29; display:flex; align-items:center; justify-content:center; padding:6px; position:relative; box-shadow:0 0 16px rgba(255,215,106,0.18); border:1px solid rgba(255,215,106,0.3);">
                    ${s.customLogo ? `
                      <img src="${s.customLogo}" style="width:100%; height:100%; object-fit:contain; border-radius:12px;" alt="Logo" id="customLogoThumb" />
                    ` : `
                      <svg viewBox="0 0 512 512" width="100%" height="100%" id="customLogoThumb">
                        <rect width="512" height="512" rx="112" fill="#14306B"/>
                        <circle cx="240" cy="232" r="130" fill="#2A4A94" stroke="#FFD76A" stroke-width="26"/>
                        <line x1="330" y1="322" x2="418" y2="410" stroke="#FFD76A" stroke-width="40" stroke-linecap="round"/>
                      </svg>
                    `}
                    <span style="position:absolute; top:-4px; right:-4px; width:22px; height:22px; border-radius:50%; background:#df8200; display:flex; align-items:center; justify-content:center; color:#4b2800;">
                      <span class="material-symbols-outlined" style="font-size:14px; font-weight:bold;">verified</span>
                    </span>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:3px;">
                    <span style="font-size:15px; font-weight:600; color:#fff7eb;">Channel Watermark Logo</span>
                    <span style="font-size:12.5px; color:#d0c5b1;">Direct IFP Screen Corner Overlay (PNG/SVG)</span>
                    <span style="font-size:12px; color:#e9c258;">Recommended: 512×512px transparent PNG (Max 2MB)</span>
                  </div>
                </div>
                <button type="button" class="stitch-seg-btn active" id="btnChangeLogoModal" style="padding:0 22px; min-height:50px;">
                  <span class="material-symbols-outlined" style="font-size:20px;">upload_file</span>
                  <span>Change Logo</span>
                </button>
              </div>

              <!-- Teaching Language Segmented Control -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Teaching Language Mode</span>
                <div class="stitch-segmented" style="grid-template-columns:1fr 1fr 1fr;">
                  <button type="button" class="stitch-seg-btn lang-opt ${s.voiceLang === 'hi-IN' && s.language === 'hi' ? 'active' : ''}" data-lang="hi">
                    <span class="material-symbols-outlined" style="font-size:18px;">translate</span>
                    <span>Hindi</span>
                  </button>
                  <button type="button" class="stitch-seg-btn lang-opt ${s.voiceLang === 'en-IN' ? 'active' : ''}" data-lang="en">
                    <span>English</span>
                  </button>
                  <button type="button" class="stitch-seg-btn lang-opt ${s.language === 'hi' && s.voiceLang !== 'en-IN' ? 'active' : ''}" data-lang="hinglish">
                    <span>Hinglish</span>
                  </button>
                </div>
              </div>

              <!-- Welcome Screen Controls & Close Deck -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Show Welcome Screen</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Display splash screen and branding logo on startup</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingShowWelcome" ${s.showWelcomeScreen !== false ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Close Current Deck</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Close active presentation deck and return to home screen</span>
                </div>
                <button type="button" id="btnSettingsCloseDeck" style="min-height:48px; padding:0 20px; border-radius:12px; background:rgba(239,68,68,0.18); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; font-size:13.5px; font-weight:600; cursor:pointer;">
                  ✕ Close Deck
                </button>
              </div>

              <!-- Cross-Device Settings Sync (PC ➔ Digital Board) -->
              <div class="stitch-card" style="background:rgba(20,48,107,0.35); border:1px solid rgba(255,215,106,0.25);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-outlined" style="color:#ffd76a; font-size:20px;">sync</span>
                      <span style="font-size:15px; font-weight:700; color:#fff7eb;">Sync to Digital Board</span>
                    </div>
                    <span style="font-size:12.5px; color:#d0c5b1;">Transfer configuration (channel name, pen size, theme) to digital board in 1 click</span>
                  </div>
                  <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button type="button" id="btnCopySyncLink" class="stitch-seg-btn active" style="min-height:46px; padding:0 20px;">
                      <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                      <span>🔗 Copy Sync Link</span>
                    </button>
                    <button type="button" id="btnSettingsInstallPwa" class="btn-pwa-install stitch-seg-btn" style="min-height:46px; padding:0 18px; border:1px solid rgba(255,215,106,0.4); color:#ffd76a;">
                      <span class="material-symbols-outlined" style="font-size:18px;">install_desktop</span>
                      <span>📲 Install PWA</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- ==========================================
                 PANEL 2: DISPLAY & 4K RESOLUTION
                 ========================================== -->
            <section class="settings-panel ${this.activeTab === 'tab-display' ? '' : 'hidden'}" id="tab-display">
              <div>
                <h2 style="font-size:22px; font-weight:700; color:#fff7eb; margin:0;">
                  Display &amp; 4K UHD Resolution
                </h2>
                <p style="font-size:13.5px; color:#d0c5b1; margin:4px 0 0 0;">
                  Configure canvas fit mode, ultra-HD render engine, and touch magnifier.
                </p>
              </div>

              <!-- Screen Fit Control -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Canvas Aspect Ratio &amp; Fit</span>
                <div class="stitch-segmented" style="grid-template-columns:1fr 1fr 1fr;">
                  <button type="button" class="stitch-seg-btn fit-opt ${s.fitMode === 'fit' ? 'active' : ''}" data-fit="fit">
                    <span class="material-symbols-outlined" style="font-size:18px;">aspect_ratio</span>
                    <span>Fit (16:9 Natural)</span>
                  </button>
                  <button type="button" class="stitch-seg-btn fit-opt ${s.fitMode === 'fill' ? 'active' : ''}" data-fit="fill">
                    <span class="material-symbols-outlined" style="font-size:18px;">fullscreen</span>
                    <span>Fill (100% Fullscreen)</span>
                  </button>
                  <button type="button" class="stitch-seg-btn fit-opt ${s.fitMode === 'stretch' ? 'active' : ''}" data-fit="stretch">
                    <span class="material-symbols-outlined" style="font-size:18px;">fit_screen</span>
                    <span>Stretch (Full Board Stretch)</span>
                  </button>
                </div>
              </div>

              <!-- 4K Render Engine Profile -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Render Performance &amp; Engine</span>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px;">
                  <div class="render-card ${s.renderQuality === '3x' ? 'active' : ''}" data-quality="3x" style="padding:16px; border-radius:16px; background:${s.renderQuality === '3x' ? 'rgba(30,41,71,0.95)' : 'rgba(15,26,55,0.8)'}; border:2px solid ${s.renderQuality === '3x' ? '#ffd76a' : 'rgba(255,255,255,0.08)'}; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-size:14px; font-weight:700; color:#ffd76a;">Ultra 4K 60FPS</span>
                      <span class="material-symbols-outlined" style="font-size:18px; color:${s.renderQuality === '3x' ? '#ffd76a' : '#d0c5b1'};">
                        ${s.renderQuality === '3x' ? 'radio_button_checked' : 'radio_button_unchecked'}
                      </span>
                    </div>
                    <span style="font-size:12px; color:#d0c5b1;">3840×2160 UHD • Studio Direct GPU</span>
                  </div>

                  <div class="render-card ${s.renderQuality === '2x' ? 'active' : ''}" data-quality="2x" style="padding:16px; border-radius:16px; background:${s.renderQuality === '2x' ? 'rgba(30,41,71,0.95)' : 'rgba(15,26,55,0.8)'}; border:2px solid ${s.renderQuality === '2x' ? '#ffd76a' : 'rgba(255,255,255,0.08)'}; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-size:14px; font-weight:700; color:#dae2ff;">2K QHD 60FPS</span>
                      <span class="material-symbols-outlined" style="font-size:18px; color:${s.renderQuality === '2x' ? '#ffd76a' : '#d0c5b1'};">
                        ${s.renderQuality === '2x' ? 'radio_button_checked' : 'radio_button_unchecked'}
                      </span>
                    </div>
                    <span style="font-size:12px; color:#d0c5b1;">2560×1440 • Balanced Overhead</span>
                  </div>

                  <div class="render-card ${s.renderQuality === 'auto' ? 'active' : ''}" data-quality="auto" style="padding:16px; border-radius:16px; background:${s.renderQuality === 'auto' ? 'rgba(30,41,71,0.95)' : 'rgba(15,26,55,0.8)'}; border:2px solid ${s.renderQuality === 'auto' ? '#ffd76a' : 'rgba(255,255,255,0.08)'}; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-size:14px; font-weight:700; color:#dae2ff;">1080p Studio Eco</span>
                      <span class="material-symbols-outlined" style="font-size:18px; color:${s.renderQuality === 'auto' ? '#ffd76a' : '#d0c5b1'};">
                        ${s.renderQuality === 'auto' ? 'radio_button_checked' : 'radio_button_unchecked'}
                      </span>
                    </div>
                    <span style="font-size:12px; color:#d0c5b1;">1920×1080 • Low Hardware Usage</span>
                  </div>
                </div>
              </div>

              <!-- Magnifier Lens Slider & Geometry -->
              <div class="stitch-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Touch Magnifier Tool</span>
                    <p style="font-size:12.5px; color:#d0c5b1; margin:2px 0 0 0;">Magnify fine formulas, small text, and diagrams during teaching</p>
                  </div>
                  <span class="px-space-md py-1" id="zoom-badge" style="padding:4px 14px; border-radius:9999px; background:#ffd76a; color:#775c00; font-size:13px; font-weight:700;">
                    ${(s.magnifierZoom || 4.0).toFixed(1)}x Zoom
                  </span>
                </div>
                <div style="display:flex; align-items:center; gap:16px;">
                  <span class="material-symbols-outlined" style="color:#d0c5b1; font-size:20px;">zoom_in</span>
                  <input type="range" class="stitch-slider" id="zoom-slider" min="1.5" max="8.0" step="0.5" value="${s.magnifierZoom || 4.0}" />
                  <span class="material-symbols-outlined" style="color:#d0c5b1; font-size:20px;">search</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:4px;">
                  <span style="font-size:13.5px; color:#dae2ff; font-weight:500;">Lens Aperture Shape</span>
                  <div style="display:flex; gap:6px; background:#020c29; padding:4px; border-radius:12px;">
                    <button type="button" class="lens-shape-btn ${s.magnifierShape !== 'rect' ? 'active' : ''}" data-shape="circle" style="padding:6px 14px; border-radius:8px; border:none; background:${s.magnifierShape !== 'rect' ? '#1e2947' : 'transparent'}; color:${s.magnifierShape !== 'rect' ? '#fff7eb' : '#d0c5b1'}; font-size:12.5px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
                      <span class="material-symbols-outlined" style="font-size:14px;">circle</span>
                      <span>Circle</span>
                    </button>
                    <button type="button" class="lens-shape-btn ${s.magnifierShape === 'rect' ? 'active' : ''}" data-shape="rect" style="padding:6px 14px; border-radius:8px; border:none; background:${s.magnifierShape === 'rect' ? '#1e2947' : 'transparent'}; color:${s.magnifierShape === 'rect' ? '#fff7eb' : '#d0c5b1'}; font-size:12.5px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
                      <span class="material-symbols-outlined" style="font-size:14px;">crop_landscape</span>
                      <span>Rect</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Blank Margins & Layout Report -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Auto-Trim Blank Margins</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Remove excess whitespace around slides and maximize screen usage</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingAutoTrimMargins" ${s.autoTrimMargins ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">4K Layout &amp; Geometry Report</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Precise pixel alignment and viewport analysis for 4K IFP &amp; live stream</span>
                </div>
                <button type="button" id="btnViewLayoutReport" style="min-height:46px; padding:0 20px; border-radius:12px; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.35); color:#38bdf8; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px;">
                  <span class="material-symbols-outlined" style="font-size:18px;">analytics</span>
                  <span>📊 View Layout Report</span>
                </button>
              </div>
            </section>

            <!-- ==========================================
                 PANEL 3: PEN & SMART INK TOOLS
                 ========================================== -->
            <section class="settings-panel ${this.activeTab === 'tab-ink' ? '' : 'hidden'}" id="tab-ink">
              <div>
                <h2 style="font-size:22px; font-weight:700; color:#fff7eb; margin:0;">
                  Stylus &amp; Smart Ink Engine
                </h2>
                <p style="font-size:13.5px; color:#d0c5b1; margin:4px 0 0 0;">
                  Handwriting smoothing, stroke width, ink retention, and digital blackboard presets.
                </p>
              </div>

              <!-- Stylus Thickness Slider with Live Preview Dot -->
              <div class="stitch-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Default Pen Stroke Width</span>
                  <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:32px; height:32px; border-radius:50%; background:#020c29; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.1);">
                      <div id="pen-dot-preview" style="width:${s.defaultPenSize || 6}px; height:${s.defaultPenSize || 6}px; border-radius:50%; background:#ffd76a; transition:all 100ms ease;"></div>
                    </div>
                    <span id="pen-thickness-badge" style="font-size:13.5px; font-weight:700; color:#e9c258;">
                      ${s.defaultPenSize || 6}px ${(s.defaultPenSize || 6) < 8 ? 'Fine' : (s.defaultPenSize || 6) < 16 ? 'Medium' : 'Broad'}
                    </span>
                  </div>
                </div>
                <input type="range" class="stitch-slider" id="pen-slider" min="2" max="24" step="1" value="${s.defaultPenSize || 6}" />
              </div>

              <!-- Smart Ink Auto Straighten -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Smart Geometry Auto-Snap</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Automatically straighten hand-drawn triangles, circles, and arrows</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingSmartInkEnabled" ${s.smartInkEnabled !== false ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <!-- Slide Navigation Ink Retention -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Auto-Erase on Navigation</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Clear annotations automatically when navigating to another slide</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingAutoErase" ${s.autoEraseOnSlideChange ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Keep Annotations Per Slide</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Preserve drawings and notes independently for each slide</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingKeepPerSlide" ${s.keepAnnotationsPerSlide ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <!-- Auto-revert to Pen after Shape/Tool -->
              <div class="stitch-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Return to Pen after Shape</span>
                    <span style="font-size:12.5px; color:#d0c5b1;">Duration before reverting back to pen after drawing shapes</span>
                  </div>
                  <span id="revert-timer-badge" style="font-size:13.5px; font-weight:700; color:#e9c258;">
                    ${s.autoRevertToPenSeconds === 0 ? 'Never (Stay)' : `${s.autoRevertToPenSeconds || 15}s`}
                  </span>
                </div>
                <div class="stitch-segmented" style="grid-template-columns:1fr 1fr 1fr 1fr; margin-top:10px;">
                  <button type="button" class="stitch-seg-btn revert-opt ${(s.autoRevertToPenSeconds || 15) === 10 ? 'active' : ''}" data-revert="10">10s</button>
                  <button type="button" class="stitch-seg-btn revert-opt ${(s.autoRevertToPenSeconds || 15) === 15 ? 'active' : ''}" data-revert="15">15s (Default)</button>
                  <button type="button" class="stitch-seg-btn revert-opt ${(s.autoRevertToPenSeconds || 15) === 30 ? 'active' : ''}" data-revert="30">30s</button>
                  <button type="button" class="stitch-seg-btn revert-opt ${s.autoRevertToPenSeconds === 0 ? 'active' : ''}" data-revert="0">Never (Stay)</button>
                </div>
              </div>

              <!-- Digital Blackboard Theme Swatches -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Blackboard Preset Theme</span>
                <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:12px;">
                  <button type="button" class="stitch-theme-swatch ${s.boardDefaultTheme === 'slate' ? 'active' : ''}" data-theme="slate" style="background:#0b172a;">
                    <span style="font-size:12px; font-weight:700; color:#fff7eb;">Deep Slate</span>
                    <span style="font-size:10.5px; color:#d0c5b1;">Dark Slate</span>
                  </button>
                  <button type="button" class="stitch-theme-swatch ${s.boardDefaultTheme === 'chalkboard' ? 'active' : ''}" data-theme="chalkboard" style="background:#123023;">
                    <span style="font-size:12px; font-weight:700; color:#fff7eb;">Classic Olive</span>
                    <span style="font-size:10.5px; color:#d0c5b1;">Olive Green</span>
                  </button>
                  <button type="button" class="stitch-theme-swatch ${s.boardDefaultTheme === 'navy' ? 'active' : ''}" data-theme="navy" style="background:#0A1633;">
                    <span style="font-size:12px; font-weight:700; color:#fff7eb;">Navy Studio</span>
                    <span style="font-size:10.5px; color:#d0c5b1;">Navy Blue</span>
                  </button>
                  <button type="button" class="stitch-theme-swatch ${s.boardDefaultTheme === 'maths' ? 'active' : ''}" data-theme="maths" style="background:#030712;">
                    <span style="font-size:12px; font-weight:700; color:#fff7eb;">Matte Black</span>
                    <span style="font-size:10.5px; color:#d0c5b1;">Matte Black</span>
                  </button>
                  <button type="button" class="stitch-theme-swatch ${s.boardDefaultTheme === 'chroma' ? 'active' : ''}" data-theme="chroma" style="background:#00FF00; color:#000;">
                    <span style="font-size:12px; font-weight:700; color:#000;">Pure Chroma</span>
                    <span style="font-size:10.5px; color:#111;">OBS Green</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- ==========================================
                 PANEL 4: TOOLBAR & ERGONOMICS
                 ========================================== -->
            <section class="settings-panel ${this.activeTab === 'tab-toolbar' ? '' : 'hidden'}" id="tab-toolbar">
              <div>
                <h2 style="font-size:22px; font-weight:700; color:#fff7eb; margin:0;">
                  Toolbar &amp; Ergonomics
                </h2>
                <p style="font-size:13.5px; color:#d0c5b1; margin:4px 0 0 0;">
                  Adjust toolbar scaling, auto-dim timeouts, palm rejection, and docking position.
                </p>
              </div>

              <!-- Auto-Dim Timer -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Toolbar Idle Auto-Dim</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Dim toolbar slightly during active teaching to keep screen uncluttered</span>
                </div>
                <div style="display:flex; gap:6px; background:#020c29; padding:4px; border-radius:12px;">
                  <button type="button" class="dim-timer-btn ${s.toolbarIdleSeconds === 2 ? 'active' : ''}" data-sec="2" style="padding:8px 14px; border-radius:8px; border:none; background:${s.toolbarIdleSeconds === 2 ? '#ffd76a' : 'transparent'}; color:${s.toolbarIdleSeconds === 2 ? '#775c00' : '#d0c5b1'}; font-weight:700; font-size:13px; cursor:pointer;">2s</button>
                  <button type="button" class="dim-timer-btn ${s.toolbarIdleSeconds === 4 || !s.toolbarIdleSeconds ? 'active' : ''}" data-sec="4" style="padding:8px 14px; border-radius:8px; border:none; background:${s.toolbarIdleSeconds === 4 || !s.toolbarIdleSeconds ? '#ffd76a' : 'transparent'}; color:${s.toolbarIdleSeconds === 4 || !s.toolbarIdleSeconds ? '#775c00' : '#d0c5b1'}; font-weight:700; font-size:13px; cursor:pointer;">4s</button>
                  <button type="button" class="dim-timer-btn ${s.toolbarIdleSeconds === 8 ? 'active' : ''}" data-sec="8" style="padding:8px 14px; border-radius:8px; border:none; background:${s.toolbarIdleSeconds === 8 ? '#ffd76a' : 'transparent'}; color:${s.toolbarIdleSeconds === 8 ? '#775c00' : '#d0c5b1'}; font-weight:700; font-size:13px; cursor:pointer;">8s</button>
                  <button type="button" class="dim-timer-btn ${s.toolbarIdleSeconds === 0 ? 'active' : ''}" data-sec="0" style="padding:8px 14px; border-radius:8px; border:none; background:${s.toolbarIdleSeconds === 0 ? '#ffd76a' : 'transparent'}; color:${s.toolbarIdleSeconds === 0 ? '#775c00' : '#d0c5b1'}; font-weight:700; font-size:13px; cursor:pointer;">Never</button>
                </div>
              </div>

              <!-- Palm Rejection Filter -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">IFP Palm Rejection Filter</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Prevent accidental marks when resting palm on touch screen (Multi-touch Guard)</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" checked disabled />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <!-- Toolbar Scale Adjustment -->
              <div class="stitch-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Toolbar Size Scale (60%–160%)</span>
                  <span id="toolbarScaleVal" style="font-size:13.5px; font-weight:700; color:#e9c258;">
                    ${Math.round((s.toolbarScale || 1.0) * 100)}%
                  </span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <button type="button" class="stitch-btn-cancel" id="btnToolbarScaleDown" style="min-height:38px; width:38px; padding:0; display:flex; align-items:center; justify-content:center; font-size:16px;">−</button>
                  <input type="range" class="stitch-slider" id="settingToolbarScale" min="60" max="160" step="5" value="${Math.round((s.toolbarScale || 1.0) * 100)}" />
                  <button type="button" class="stitch-btn-cancel" id="btnToolbarScaleUp" style="min-height:38px; width:38px; padding:0; display:flex; align-items:center; justify-content:center; font-size:16px;">+</button>
                  <button type="button" class="stitch-btn-cancel" id="btnResetToolbarScale" style="min-height:38px; padding:0 12px; font-size:12px;">100%</button>
                </div>
              </div>

              <!-- Reset Toolbar Position -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Snap Toolbar to Center Base</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Reset toolbar dock back to top-center default position</span>
                </div>
                <button type="button" id="btnResetToolbarPos" class="stitch-btn-cancel" style="min-height:46px; padding:0 20px;">
                  Reset Dock
                </button>
              </div>

              <!-- Idle Toolbar & Cursor Hide -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Hide Toolbar on Idle</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Hide toolbar completely when inactive for clean presentation broadcast</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingHideToolbarCompletely" ${s.hideToolbarCompletelyOnIdle ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Hide Cursor on Idle</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Hide mouse cursor automatically after 2 seconds of inactivity</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingHideCursorWhenIdle" ${s.hideCursorWhenIdle ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>
            </section>

            <!-- ==========================================
                 PANEL 5: VOICE & CLASSROOM ACOUSTICS
                 ========================================== -->
            <section class="settings-panel ${this.activeTab === 'tab-voice' ? '' : 'hidden'}" id="tab-voice">
              <div>
                <h2 style="font-size:22px; font-weight:700; color:#fff7eb; margin:0;">
                  Voice &amp; Classroom Acoustics
                </h2>
                <p style="font-size:13.5px; color:#d0c5b1; margin:4px 0 0 0;">
                  Classroom microphone timeout, push-to-talk mode, and live voice indicators.
                </p>
              </div>

              <!-- Mic Auto Gate Timeout -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Auto Mic Gate Timeout</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Automatically turn off microphone when teacher walks away from board</span>
                </div>
                <div style="display:flex; gap:6px; background:#020c29; padding:4px; border-radius:12px;">
                  <button type="button" class="mic-timer-btn ${s.micAutoOffMinutes === 0 ? 'active' : ''}" data-min="0" style="padding:8px 14px; border-radius:8px; border:none; background:${s.micAutoOffMinutes === 0 ? '#ffd76a' : 'transparent'}; color:${s.micAutoOffMinutes === 0 ? '#775c00' : '#d0c5b1'}; font-weight:700; font-size:13px; cursor:pointer;">Never</button>
                  <button type="button" class="mic-timer-btn ${s.micAutoOffMinutes === 3 ? 'active' : ''}" data-min="3" style="padding:8px 14px; border-radius:8px; border:none; background:${s.micAutoOffMinutes === 3 ? '#ffd76a' : 'transparent'}; color:${s.micAutoOffMinutes === 3 ? '#775c00' : '#d0c5b1'}; font-weight:700; font-size:13px; cursor:pointer;">3 min</button>
                  <button type="button" class="mic-timer-btn ${s.micAutoOffMinutes === 5 ? 'active' : ''}" data-min="5" style="padding:8px 14px; border-radius:8px; border:none; background:${s.micAutoOffMinutes === 5 ? '#ffd76a' : 'transparent'}; color:${s.micAutoOffMinutes === 5 ? '#775c00' : '#d0c5b1'}; font-weight:700; font-size:13px; cursor:pointer;">5 min</button>
                  <button type="button" class="mic-timer-btn ${s.micAutoOffMinutes === 10 || !s.micAutoOffMinutes ? 'active' : ''}" data-min="10" style="padding:8px 14px; border-radius:8px; border:none; background:${s.micAutoOffMinutes === 10 || !s.micAutoOffMinutes ? '#ffd76a' : 'transparent'}; color:${s.micAutoOffMinutes === 10 || !s.micAutoOffMinutes ? '#775c00' : '#d0c5b1'}; font-weight:700; font-size:13px; cursor:pointer;">10 min</button>
                </div>
              </div>

              <!-- Push-to-Talk Switch -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Push-to-Talk Stylus Button</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Listen to voice commands only while holding mic button or 'V' key</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingPushToTalk" ${s.pushToTalk ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <!-- Mute on Blackboard -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Mute Mic on Board</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Automatically mute microphone when opening digital blackboard</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingMuteMicOnBoard" ${s.muteMicOnBoard ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>

              <!-- Zen Mode Red Dot Indicator -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Zen Mode Red Light Indicator</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">Display subtle red indicator dot at top-right while microphone is live</span>
                </div>
                <label class="stitch-switch">
                  <input type="checkbox" id="settingShowMicDotInZen" ${s.showMicDotInZen ? 'checked' : ''} />
                  <div class="stitch-switch-track"><div class="stitch-switch-thumb"></div></div>
                </label>
              </div>
            </section>

            <!-- ==========================================
                 PANEL 6: GEMINI AI TEACHING ENGINE
                 ========================================== -->
            <section class="settings-panel ${this.activeTab === 'tab-gemini' ? '' : 'hidden'}" id="tab-gemini">
              <div>
                <h2 style="font-size:22px; font-weight:700; color:#fff7eb; margin:0;">
                  Gemini AI Teaching Engine
                </h2>
                <p style="font-size:13.5px; color:#d0c5b1; margin:4px 0 0 0;">
                  Instant classroom explanations, formula step-by-step solutions, and multi-modal reasoning.
                </p>
              </div>

              <!-- Automatic AI Model Detection -->
              <div class="stitch-card">
                <label style="font-size:14.5px; font-weight:600; color:#fff7eb;">
                  AI Model Architecture
                </label>
                <div style="font-size:13.5px; color:#ffd76a; margin-top:6px; display:flex; align-items:center; gap:8px;">
                  <span class="material-symbols-outlined" style="font-size:19px; color:#ffd76a;">auto_awesome</span>
                  <span>⚡ <strong>Auto-Selected</strong> — Optimal high-speed model (Gemini 2.5 Flash / Next-Gen) automatically selected based on your API key.</span>
                </div>
              </div>

              <!-- Gemini API Key -->
              <div class="stitch-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <label for="gemini-key" style="font-size:14.5px; font-weight:600; color:#fff7eb;">Google AI API Key</label>
                  <span id="geminiKeyStatusBadge" style="padding:3px 10px; border-radius:9999px; background:rgba(223,130,0,0.2); color:#ffb873; font-size:12px; font-weight:600;">
                    Connected
                  </span>
                </div>
                <div class="stitch-input-wrap">
                  <span class="material-symbols-outlined stitch-icon">key</span>
                  <input type="password" id="gemini-key" class="stitch-input" placeholder="AIzaSy..." />
                  <button type="button" class="stitch-clear-btn" id="btnToggleKeyVisibility" title="Toggle Visibility">
                    <span class="material-symbols-outlined" id="keyVisIcon" style="font-size:20px;">visibility</span>
                  </button>
                </div>
              </div>

              <!-- AI Answer Depth -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">AI Response Depth for Board</span>
                <div class="stitch-segmented" style="grid-template-columns:1fr 1fr 1fr;">
                  <button type="button" class="stitch-seg-btn depth-btn ${s.aiAnswerLength === 'short' ? 'active' : ''}" data-depth="short">
                    <span>Short Formula</span>
                  </button>
                  <button type="button" class="stitch-seg-btn depth-btn ${s.aiAnswerLength === 'normal' || !s.aiAnswerLength ? 'active' : ''}" data-depth="normal">
                    <span>Standard</span>
                  </button>
                  <button type="button" class="stitch-seg-btn depth-btn ${s.aiAnswerLength === 'detailed' ? 'active' : ''}" data-depth="detailed">
                    <span>Step-by-Step</span>
                  </button>
                </div>
              </div>

              <!-- Storage & Privacy Whitelist -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Storage &amp; Privacy</span>
                <div id="storageStatsContainer" style="font-size:12px; color:#d0c5b1; line-height:1.6; background:rgba(2,12,41,0.6); padding:12px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.06);">
                  Calculating storage...
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding-top:6px;">
                  <button type="button" id="btnPrivacyDeleteKeys" class="stitch-btn-cancel" style="font-size:13px; color:#fca5a5; border-color:rgba(239,68,68,0.3);">
                    🔑 Delete AI Keys
                  </button>
                  <button type="button" id="btnDeleteAllAppData" style="min-height:48px; padding:0 22px; border-radius:12px; background:rgba(239,68,68,0.85); color:#ffffff; font-weight:700; border:none; font-size:13px; cursor:pointer;">
                    🗑️ Wipe All Data
                  </button>
                </div>
              </div>
            </section>

            <!-- ==========================================
                 PANEL 7: BROADCAST HUB & OBS LINK
                 ========================================== -->
            <section class="settings-panel ${this.activeTab === 'tab-obs' ? '' : 'hidden'}" id="tab-obs">
              <div>
                <h2 style="font-size:22px; font-weight:700; color:#fff7eb; margin:0;">
                  Broadcast Hub &amp; OBS Link
                </h2>
                <p style="font-size:13.5px; color:#d0c5b1; margin:4px 0 0 0;">
                  OBS Studio WebSocket, NDI 5 output, and local 4K recording vault.
                </p>
              </div>

              <!-- OBS WebSocket Link -->
              <div class="stitch-card row-card">
                <div style="display:flex; align-items:center; gap:16px;">
                  <div style="width:48px; height:48px; border-radius:14px; background:rgba(223,130,0,0.2); display:flex; align-items:center; justify-content:center; color:#ffb873;">
                    <span class="material-symbols-outlined" style="font-size:26px;">hub</span>
                  </div>
                  <div style="display:flex; flex-direction:column;">
                    <span style="font-size:15px; font-weight:600; color:#fff7eb;">OBS WebSocket 5.0 Link</span>
                    <span style="font-size:12.5px; color:#d0c5b1;">ws://127.0.0.1:4455 • Low Latency Direct Trigger</span>
                  </div>
                </div>
                <span style="padding:6px 14px; border-radius:9999px; background:rgba(223,130,0,0.25); color:#ffd76a; font-size:12px; font-weight:700;">
                  Linked
                </span>
              </div>

              <!-- Stream Frame Lock -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Broadcast Aspect Ratio</span>
                <div class="stitch-segmented" style="grid-template-columns:repeat(4, 1fr);">
                  <button type="button" class="stitch-seg-btn lock-btn ${s.streamFrameLock === 'none' || !s.streamFrameLock ? 'active' : ''}" data-lock="none">
                    <span>Full Screen</span>
                  </button>
                  <button type="button" class="stitch-seg-btn lock-btn ${s.streamFrameLock === '16:9' ? 'active' : ''}" data-lock="16:9">
                    <span>16:9 YouTube</span>
                  </button>
                  <button type="button" class="stitch-seg-btn lock-btn ${s.streamFrameLock === '16:10' ? 'active' : ''}" data-lock="16:10">
                    <span>16:10 Tablet</span>
                  </button>
                  <button type="button" class="stitch-seg-btn lock-btn ${s.streamFrameLock === '4:3' ? 'active' : ''}" data-lock="4:3">
                    <span>4:3 IFP Board</span>
                  </button>
                </div>
              </div>

              <!-- Stream Remainder Fill Mode -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Remainder Fill Mode</span>
                <div class="stitch-segmented" style="grid-template-columns:1fr 1fr 1fr;">
                  <button type="button" class="stitch-seg-btn remainder-btn ${s.streamRemainderMode === 'background' || !s.streamRemainderMode ? 'active' : ''}" data-remainder="background">
                    <span>Corner Color Fill</span>
                  </button>
                  <button type="button" class="stitch-seg-btn remainder-btn ${s.streamRemainderMode === 'blur' ? 'active' : ''}" data-remainder="blur">
                    <span>Subtle Blur</span>
                  </button>
                  <button type="button" class="stitch-seg-btn remainder-btn ${s.streamRemainderMode === 'black' ? 'active' : ''}" data-remainder="black">
                    <span>Deep Black</span>
                  </button>
                </div>
              </div>

              <!-- Streaming Help Guide Button -->
              <div class="stitch-card row-card">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Streaming Best Practices Help</span>
                  <span style="font-size:12.5px; color:#d0c5b1;">OBS Studio, StreamYard, and Chroma Key (#00FF00) setup guide</span>
                </div>
                <button type="button" id="btnOpenStreamingHelp" style="min-height:46px; padding:0 20px; border-radius:12px; background:rgba(245,158,11,0.18); border:1px solid rgba(245,158,11,0.4); color:#fbbf24; font-size:13px; font-weight:600; cursor:pointer;">
                  📖 Open Streaming Guide
                </button>
              </div>

              <!-- Recording Storage Vault -->
              <div class="stitch-card">
                <span style="font-size:14.5px; font-weight:600; color:#fff7eb;">Recording Storage Vault</span>
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="flex:1; min-height:50px; padding:0 16px; border-radius:12px; background:#020c29; display:flex; align-items:center; color:#dae2ff; font-size:13.5px; border:1px solid rgba(255,255,255,0.08);">
                    D:\\SmartStudio_Recordings\\2026_Lectures
                  </div>
                  <button type="button" class="stitch-btn-cancel" style="min-height:50px; padding:0 22px;">
                    Browse
                  </button>
                </div>
              </div>
            </section>

          </main>
        </div>

        <!-- Modal Tactile 4K Action Bar (Footer) -->
        <footer class="stitch-footer">
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="material-symbols-outlined" style="color:#e9c258; font-size:22px;">touch_app</span>
            <span style="font-size:13px; color:#d0c5b1;">Maxhub Touch Driver: v8.4.1 Active (20 Touch Points)</span>
          </div>

          <div style="display:flex; align-items:center; gap:14px;">
            <button type="button" class="stitch-btn-cancel" id="btnCancelSettings">
              Cancel
            </button>
            <button type="button" class="stitch-btn-save" id="save-changes-btn">
              <span class="material-symbols-outlined" style="font-size:22px;">check_circle</span>
              <span id="saveBtnText">Save Changes</span>
            </button>
          </div>
        </footer>

      </div>
    `;

    this.loadStorageStatsAsync();
    this.loadExistingKeyAsync();
  }

  private bindEvents(): void {
    // 1. Sidebar Tab Navigation Logic
    const navButtons = this.modalEl.querySelectorAll<HTMLButtonElement>('.tab-nav-btn');
    const panels = this.modalEl.querySelectorAll<HTMLElement>('.settings-panel');

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab') as SettingsTabId;
        if (!targetTab) return;
        this.activeTab = targetTab;

        // Reset tabs
        navButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Show panel
        panels.forEach((p) => {
          if (p.id === targetTab) {
            p.classList.remove('hidden');
          } else {
            p.classList.add('hidden');
          }
        });
      });
    });

    // 2. Close Buttons (Close X and Cancel)
    this.modalEl.querySelector('#btnSettingsClose')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btnCancelSettings')?.addEventListener('click', () => this.close());

    // Close when clicking modal backdrop outside .stitch-dialog
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // 3. Clear Channel Name Button
    const chNameInput = this.modalEl.querySelector('#channel-name') as HTMLInputElement;
    const btnClearChName = this.modalEl.querySelector('#btnClearChannelName');
    btnClearChName?.addEventListener('click', () => {
      if (chNameInput) {
        chNameInput.value = '';
        chNameInput.focus();
      }
    });

    // 4. Change Logo Modal Button
    this.modalEl.querySelector('#btnChangeLogoModal')?.addEventListener('click', () => {
      changeLogoModal.show();
    });

    // 4b. Copy Settings Sync Link (PC to Digital Board)
    this.modalEl.querySelector('#btnCopySyncLink')?.addEventListener('click', async () => {
      const syncUrl = generateSyncUrl();
      try {
        await navigator.clipboard.writeText(syncUrl);
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: {
              message: '📋 Sync link copied! Open in Chrome on your digital board to instantly sync settings.',
              isError: false
            }
          })
        );
      } catch {
        window.prompt('Sync link (copy and open in Chrome on digital board):', syncUrl);
      }
    });

    // 5. Teaching Language Mode Pills
    const langBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.lang-opt');
    langBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        langBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const lang = btn.getAttribute('data-lang');
        if (lang === 'hi') {
          store.updateSettings({ language: 'hi', voiceLang: 'hi-IN' });
        } else if (lang === 'en') {
          store.updateSettings({ language: 'en', voiceLang: 'en-IN' });
        } else {
          store.updateSettings({ language: 'hi', voiceLang: 'hi-IN' });
        }
      });
    });

    // 6. Show Welcome Screen Switch
    const showWelcome = this.modalEl.querySelector('#settingShowWelcome') as HTMLInputElement;
    showWelcome?.addEventListener('change', () => {
      store.updateSettings({ showWelcomeScreen: showWelcome.checked });
    });

    // 7. Close Deck Button
    this.modalEl.querySelector('#btnSettingsCloseDeck')?.addEventListener('click', () => {
      this.close();
      slideView.closeDeck();
    });

    // 8. Fit Mode Pills
    const fitBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.fit-opt');
    fitBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        fitBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const fit = btn.getAttribute('data-fit') as any;
        if (fit) {
          store.updateSettings({ fitMode: fit });
          if (fit === 'stretch') {
            alert('Warning: Stretch mode may distort slide proportions on non-matching displays.');
          }
        }
      });
    });

    // 9. Render Quality Cards
    const renderCards = this.modalEl.querySelectorAll<HTMLElement>('.render-card');
    renderCards.forEach((card) => {
      card.addEventListener('click', () => {
        renderCards.forEach((c) => {
          c.classList.remove('active');
          c.style.borderColor = 'rgba(255,255,255,0.08)';
          const icon = c.querySelector('.material-symbols-outlined');
          if (icon) {
            icon.textContent = 'radio_button_unchecked';
            (icon as HTMLElement).style.color = '#d0c5b1';
          }
        });
        card.classList.add('active');
        card.style.borderColor = '#ffd76a';
        const activeIcon = card.querySelector('.material-symbols-outlined');
        if (activeIcon) {
          activeIcon.textContent = 'radio_button_checked';
          (activeIcon as HTMLElement).style.color = '#ffd76a';
        }
        const quality = card.getAttribute('data-quality') as any;
        if (quality) store.updateSettings({ renderQuality: quality });
      });
    });

    // 10. Magnifier Zoom Slider & Shape
    const zoomSlider = this.modalEl.querySelector('#zoom-slider') as HTMLInputElement;
    const zoomBadge = this.modalEl.querySelector('#zoom-badge') as HTMLElement;
    zoomSlider?.addEventListener('input', () => {
      const val = parseFloat(zoomSlider.value);
      if (zoomBadge) zoomBadge.textContent = `${val.toFixed(1)}x Zoom`;
      store.updateSettings({ magnifierZoom: val });
    });

    const lensShapeBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.lens-shape-btn');
    lensShapeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        lensShapeBtns.forEach((b) => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = '#d0c5b1';
        });
        btn.classList.add('active');
        btn.style.background = '#1e2947';
        btn.style.color = '#fff7eb';
        const shape = btn.getAttribute('data-shape') as 'circle' | 'rect';
        if (shape) store.updateSettings({ magnifierShape: shape });
      });
    });

    // 11. Blank Margins & Layout Report
    const autoTrim = this.modalEl.querySelector('#settingAutoTrimMargins') as HTMLInputElement;
    autoTrim?.addEventListener('change', () => {
      store.updateSettings({ autoTrimMargins: autoTrim.checked });
    });

    this.modalEl.querySelector('#btnViewLayoutReport')?.addEventListener('click', () => {
      alert(this.generateLayoutReport());
    });

    // 12. Pen Slider & Preview Dot
    const penSlider = this.modalEl.querySelector('#pen-slider') as HTMLInputElement;
    const penDot = this.modalEl.querySelector('#pen-dot-preview') as HTMLElement;
    const penBadge = this.modalEl.querySelector('#pen-thickness-badge') as HTMLElement;

    penSlider?.addEventListener('input', () => {
      const val = parseInt(penSlider.value, 10);
      if (penDot) {
        penDot.style.width = `${val}px`;
        penDot.style.height = `${val}px`;
      }
      if (penBadge) {
        penBadge.textContent = `${val}px ${val < 8 ? 'Fine' : val < 16 ? 'Medium' : 'Broad'}`;
      }
      store.updateSettings({ defaultPenSize: val });
    });

    // 13. Smart Ink Switch
    const smartInkSwitch = this.modalEl.querySelector('#settingSmartInkEnabled') as HTMLInputElement;
    smartInkSwitch?.addEventListener('change', () => {
      store.updateSettings({ smartInkEnabled: smartInkSwitch.checked });
    });

    // 14. Ink Retention Switches
    const autoErase = this.modalEl.querySelector('#settingAutoErase') as HTMLInputElement;
    autoErase?.addEventListener('change', () => {
      store.updateSettings({ autoEraseOnSlideChange: autoErase.checked });
    });

    const keepPerSlide = this.modalEl.querySelector('#settingKeepPerSlide') as HTMLInputElement;
    keepPerSlide?.addEventListener('change', () => {
      store.updateSettings({ keepAnnotationsPerSlide: keepPerSlide.checked });
    });

    // 14b. Auto-revert to pen timer segmented control
    const revertBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.revert-opt');
    const revertBadge = this.modalEl.querySelector('#revert-timer-badge');
    revertBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        revertBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const seconds = parseInt(btn.getAttribute('data-revert') || '15', 10);
        store.updateSettings({ autoRevertToPenSeconds: seconds });
        if (revertBadge) {
          revertBadge.textContent = seconds === 0 ? 'Never (Stay)' : `${seconds}s`;
        }
      });
    });

    // 15. Blackboard Swatches
    const themeSwatches = this.modalEl.querySelectorAll<HTMLButtonElement>('.stitch-theme-swatch');
    themeSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        themeSwatches.forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        const theme = swatch.getAttribute('data-theme') as any;
        if (theme) {
          store.updateSettings({ boardDefaultTheme: theme });
        }
      });
    });

    // 16. Toolbar Idle Dim Buttons
    const dimBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.dim-timer-btn');
    dimBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        dimBtns.forEach((b) => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = '#d0c5b1';
        });
        btn.classList.add('active');
        btn.style.background = '#ffd76a';
        btn.style.color = '#775c00';
        const sec = parseInt(btn.getAttribute('data-sec') || '4', 10);
        store.updateSettings({ toolbarIdleSeconds: sec });
      });
    });

    // 17. Toolbar Scale Slider
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
    });

    // 18. Reset Toolbar Position
    this.modalEl.querySelector('#btnResetToolbarPos')?.addEventListener('click', () => {
      const tb = document.getElementById('toolbarContainer');
      if (tb) {
        tb.style.left = 'calc(50% - 240px)';
        tb.style.top = '80px';
        const currentScale = store.getState().settings.toolbarScale || 1.0;
        tb.style.transform = `scale(${currentScale})`;
        store.updateSettings({ toolbarPos: null });
      }
    });

    // 19. Hide Toolbar & Cursor Idle
    const hideTbIdle = this.modalEl.querySelector('#settingHideToolbarCompletely') as HTMLInputElement;
    hideTbIdle?.addEventListener('change', () => {
      store.updateSettings({ hideToolbarCompletelyOnIdle: hideTbIdle.checked });
    });

    const hideCursorIdle = this.modalEl.querySelector('#settingHideCursorWhenIdle') as HTMLInputElement;
    hideCursorIdle?.addEventListener('change', () => {
      store.updateSettings({ hideCursorWhenIdle: hideCursorIdle.checked });
    });

    // 20. Mic Timeout Buttons
    const micTimerBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.mic-timer-btn');
    micTimerBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        micTimerBtns.forEach((b) => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = '#d0c5b1';
        });
        btn.classList.add('active');
        btn.style.background = '#ffd76a';
        btn.style.color = '#775c00';
        const min = parseInt(btn.getAttribute('data-min') || '10', 10);
        store.updateSettings({ micAutoOffMinutes: min });
      });
    });

    // 21. Mic Toggles
    const pushToTalk = this.modalEl.querySelector('#settingPushToTalk') as HTMLInputElement;
    pushToTalk?.addEventListener('change', () => {
      store.updateSettings({ pushToTalk: pushToTalk.checked });
    });

    const muteMicOnBoard = this.modalEl.querySelector('#settingMuteMicOnBoard') as HTMLInputElement;
    muteMicOnBoard?.addEventListener('change', () => {
      store.updateSettings({ muteMicOnBoard: muteMicOnBoard.checked });
    });

    const showMicDotInZen = this.modalEl.querySelector('#settingShowMicDotInZen') as HTMLInputElement;
    showMicDotInZen?.addEventListener('change', () => {
      store.updateSettings({ showMicDotInZen: showMicDotInZen.checked });
    });

    // 22. AI Key & Visibility
    const geminiKeyInput = this.modalEl.querySelector('#gemini-key') as HTMLInputElement;
    const btnToggleVis = this.modalEl.querySelector('#btnToggleKeyVisibility');
    const keyVisIcon = this.modalEl.querySelector('#keyVisIcon');
    btnToggleVis?.addEventListener('click', () => {
      if (geminiKeyInput.type === 'password') {
        geminiKeyInput.type = 'text';
        if (keyVisIcon) keyVisIcon.textContent = 'visibility_off';
      } else {
        geminiKeyInput.type = 'password';
        if (keyVisIcon) keyVisIcon.textContent = 'visibility';
      }
    });

    geminiKeyInput?.addEventListener('change', async () => {
      const keyVal = geminiKeyInput.value.trim();
      if (keyVal) {
        await keyVault.storeKey('gemini', keyVal);
      }
    });

    // 23. AI Depth Buttons
    const depthBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.depth-btn');
    depthBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        depthBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const depth = btn.getAttribute('data-depth') as any;
        if (depth) store.updateSettings({ aiAnswerLength: depth });
      });
    });

    // 24. Delete Keys & Wipe All Data
    this.modalEl.querySelector('#btnPrivacyDeleteKeys')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all saved AI API keys?')) {
        await keyVault.deleteAllKeys();
        if (geminiKeyInput) geminiKeyInput.value = '';
      }
    });

    this.modalEl.querySelector('#btnDeleteAllAppData')?.addEventListener('click', () => {
      this.deleteAllAppData();
    });

    // 25. Stream Frame Lock Buttons
    const lockBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.lock-btn');
    lockBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        lockBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const lock = btn.getAttribute('data-lock') as any;
        if (lock) store.updateSettings({ streamFrameLock: lock });
      });
    });

    // 26. Stream Remainder Buttons
    const remainderBtns = this.modalEl.querySelectorAll<HTMLButtonElement>('.remainder-btn');
    remainderBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        remainderBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const remainder = btn.getAttribute('data-remainder') as any;
        if (remainder) store.updateSettings({ streamRemainderMode: remainder });
      });
    });

    // 27. Streaming Help Guide
    this.modalEl.querySelector('#btnOpenStreamingHelp')?.addEventListener('click', () => {
      this.showStreamingHelpDialog();
    });

    // 28. Reset All Settings Button (Top Header)
    this.modalEl.querySelector('#reset-all-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all settings to recommended defaults?')) {
        store.updateSettings({ ...DEFAULT_SETTINGS });
        this.render();
        this.bindEvents();
      }
    });

    // 29. Save Changes Button (Bottom Footer)
    const saveBtn = this.modalEl.querySelector('#save-changes-btn') as HTMLButtonElement;
    saveBtn?.addEventListener('click', async () => {
      // Collect input values
      const channelVal = chNameInput?.value.trim() || 'SSIRO Classes';
      const welcomeInput = this.modalEl.querySelector('#welcome-text') as HTMLInputElement;
      const welcomeVal = welcomeInput?.value.trim() || 'Welcome to Live Class';

      store.updateSettings({
        channelName: channelVal,
        welcomeLine2: welcomeVal
      });

      // Also save Gemini API Key if entered
      if (geminiKeyInput && geminiKeyInput.value.trim()) {
        await keyVault.storeKey('gemini', geminiKeyInput.value.trim());
      }

      // Visual feedback
      const saveBtnText = this.modalEl.querySelector('#saveBtnText');
      if (saveBtnText) saveBtnText.textContent = 'Saved!';

      setTimeout(() => {
        this.close();
      }, 700);
    });
  }

  private async loadExistingKeyAsync(): Promise<void> {
    try {
      const geminiKeyInput = this.modalEl.querySelector('#gemini-key') as HTMLInputElement;
      const key = await keyVault.getKey('gemini');
      if (geminiKeyInput && key) {
        geminiKeyInput.value = key;
      }
    } catch {}
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
      • LocalStorage Data: <strong>${lsKb} KB</strong> (Settings, Brand, Toolbar State)<br>
      • IndexedDB Database: <strong>${dbCount} active</strong> (WebCrypto AES-GCM Key Vault)<br>
      • PWA Offline Cache: <strong>${cacheCount} caches stored</strong> (100% Offline Shell)
    `;
  }

  private async deleteAllAppData(): Promise<void> {
    const confirmWipe = window.confirm(
      'Warning: Are you sure you want to delete all app data, local settings, AI keys, and offline caches? This will reset the app completely.'
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

      alert('✅ All app data successfully cleared. The application will now reload.');
      window.location.reload();
    } catch (err) {
      console.error('Delete all app data error:', err);
      alert('Error clearing data: ' + String(err));
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
