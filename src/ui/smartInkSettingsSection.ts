// INKFIX: Smart Ink Settings & Inspector UI (Part D, E, F, H1)
import { store } from '../state/store';
import { smartInkInspector } from '../smartink/inspector';

export class SmartInkSettingsSection {
  renderSection(): string {
    const s = store.getState().settings;

    const history = smartInkInspector.getHistory();
    const inspectorRows = history.length === 0
      ? `<tr><td colspan="6" style="text-align:center; padding:12px; color:var(--text-muted); font-size:12px;">कोई निर्णय रिकॉर्ड नहीं हुआ (No decisions recorded yet)</td></tr>`
      : history.map((e) => {
          const resultColor = e.result === 'converted' ? '#4ade80' : e.result === 'rolled_back' ? '#ef4444' : '#94a3b8';
          return `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06); font-size:11px;">
              <td style="padding:6px 8px; color:var(--text-muted);">${e.timeFormatted}</td>
              <td style="padding:6px 8px; font-weight:600;">${e.tool} (${e.strokeCount})</td>
              <td style="padding:6px 8px; color:var(--primary-accent);">${e.branchTaken}</td>
              <td style="padding:6px 8px; color:${resultColor}; font-weight:600;">${e.result}</td>
              <td style="padding:6px 8px;">${e.aiCalled ? `AI (${e.latencyMs}ms)` : `Local (${e.latencyMs}ms)`}</td>
              <td style="padding:6px 8px; color:var(--text-secondary); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${e.reason}">${e.reason}</td>
            </tr>
          `;
        }).join('');

    return `
      <!-- INKFIX: Smart Ink & Pen Section -->
      <div class="settings-section">
        <div class="settings-section-title">✍️ स्मार्ट इंक व पेन सेटिंग्स (Smart Ink & Auto-Beautify)</div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">स्मार्ट इंक स्वतः-सुधार (Enable Smart Ink)</span>
            <span class="setting-desc">मुक्तहस्त आकृतियों, रेखाओं और लिखावट को सुंदर बनाएं</span>
          </div>
          <input type="checkbox" id="settingSmartInkEnabled" ${s.smartInkEnabled !== false ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">संवेदनशीलता (Sensitivity Thresholds)</span>
            <span class="setting-desc">आकृति पहचान सहनशीलता (Normal डिफ़ॉल्ट)</span>
          </div>
          <select id="settingSmartInkSensitivity" class="header-btn" style="background:#111;">
            <option value="normal" ${s.smartInkSensitivity === 'normal' ? 'selected' : ''}>Normal (संतुलित - डिफ़ॉल्ट)</option>
            <option value="forgiving" ${s.smartInkSensitivity === 'forgiving' ? 'selected' : ''}>Forgiving (उदार - 1.25× सहनशीलता)</option>
            <option value="strict" ${s.smartInkSensitivity === 'strict' ? 'selected' : ''}>Strict (कठोर)</option>
          </select>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">होल्ड-टू-स्नैप (Hold-to-Snap 0.5s)</span>
            <span class="setting-desc">स्ट्रोक पूरा कर पेन 0.5s रोके रखने पर तुरंत स्नैप</span>
          </div>
          <input type="checkbox" id="settingSmartInkHoldToSnap" ${s.smartInkHoldToSnap !== false ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">आकृति स्नैप विलंब (Shape Snap Delay)</span>
            <span class="setting-desc">पेन उठाने के बाद आकृति बनने का समय (0.45s डिफ़ॉल्ट)</span>
          </div>
          <input type="range" id="settingSmartInkShapeDelay" min="0.2" max="1.5" step="0.05" value="${(s.smartInkShapeDelayMs || 450) / 1000}" class="popover-slider" style="width:120px;" />
          <span id="shapeDelayVal">${((s.smartInkShapeDelayMs || 450) / 1000).toFixed(2)}s</span>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">टेक्स्ट रूपांतरण मोड (Convert Text Mode)</span>
            <span class="setting-desc">हस्तलेखन को मुद्रित अक्षरों में बदलना (Word-by-word डिफ़ॉल्ट)</span>
          </div>
          <select id="settingSmartInkConvertText" class="header-btn" style="background:#111;">
            <option value="word" ${s.smartInkConvertText === 'word' ? 'selected' : ''}>Word by word (शब्द दर शब्द - डिफ़ॉल्ट)</option>
            <option value="line" ${s.smartInkConvertText === 'line' ? 'selected' : ''}>Whole line (पूरी पंक्ति 2.0s)</option>
            <option value="off" ${s.smartInkConvertText === 'off' ? 'selected' : ''}>Off (केवल स्याही रखें)</option>
          </select>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">टेक्स्ट रूपांतरण विलंब (Text Delay)</span>
            <span class="setting-desc">लिखने के बाद OCR प्रारंभ होने का समय (1.0s डिफ़ॉल्ट)</span>
          </div>
          <input type="range" id="settingSmartInkTextDelay" min="0.6" max="3.0" step="0.1" value="${(s.smartInkTextDelayMs || 1000) / 1000}" class="popover-slider" style="width:120px;" />
          <span id="textDelayVal">${((s.smartInkTextDelayMs || 1000) / 1000).toFixed(1)}s</span>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">AI-सहायता प्राप्त आकार पहचान (AI-Assisted Shape Recognition)</span>
            <span class="setting-desc">संदिग्ध आकृतियों के लिए AI की द्वितीय राय (Fast tier)</span>
          </div>
          <input type="checkbox" id="settingSmartInkAiAssist" ${s.smartInkAiAssist !== false ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">सुधार स्तर (Correction Level)</span>
            <span class="setting-desc">शब्दावली आधारित वर्तनी सुधार</span>
          </div>
          <select id="settingSmartInkCorrectionLevel" class="header-btn" style="background:#111;">
            <option value="light" ${s.smartInkCorrectionLevel === 'light' ? 'selected' : ''}>Light spelling fix (हल्का वर्तनी सुधार)</option>
            <option value="full" ${s.smartInkCorrectionLevel === 'full' ? 'selected' : ''}>Full glossary match (पूर्ण मिलान)</option>
            <option value="none" ${s.smartInkCorrectionLevel === 'none' ? 'selected' : ''}>None (हूबहू वही)</option>
          </select>
        </div>

        <!-- H1: Smart Ink Inspector -->
        <div class="setting-item" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:14px; margin-top:8px;">
          <div class="setting-label">
            <span class="setting-name">🔬 स्मार्ट इंक विश्लेषक (Smart Ink Inspector)</span>
            <span class="setting-desc">निदान: अंतिम 20 रूपांतरण निर्णयों का विवरण देखें (स्थानीय, कोई डेटा बाहर नहीं जाता)</span>
          </div>
          <input type="checkbox" id="settingSmartInkInspectorEnabled" ${s.smartInkInspectorEnabled ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
        </div>

        ${s.smartInkInspectorEnabled ? `
          <div id="inspectorContainer" style="margin-top:10px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:12px; font-weight:600; color:var(--primary-accent);">अंतिम 20 निर्णय लॉग (Decision History)</span>
              <div style="display:flex; gap:8px;">
                <button class="header-btn" id="btnCopyInspectorReport" style="font-size:11px; padding:4px 10px; background:rgba(56,189,248,0.15); border-color:var(--primary-accent);">
                  📋 कॉपी रिपोर्ट (Copy Report)
                </button>
                <button class="header-btn" id="btnClearInspectorReport" style="font-size:11px; padding:4px 10px; background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.5); color:#fca5a5;">
                  रीसेट (Clear)
                </button>
              </div>
            </div>
            <div style="max-height:220px; overflow-y:auto; border:1px solid rgba(255,255,255,0.06); border-radius:4px;">
              <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                  <tr style="background:rgba(255,255,255,0.05); font-size:11px; color:var(--text-muted);">
                    <th style="padding:6px 8px;">समय</th>
                    <th style="padding:6px 8px;">टूल</th>
                    <th style="padding:6px 8px;">ब्रांच</th>
                    <th style="padding:6px 8px;">परिणाम</th>
                    <th style="padding:6px 8px;">गति</th>
                    <th style="padding:6px 8px;">कारण</th>
                  </tr>
                </thead>
                <tbody>
                  ${inspectorRows}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  bindEvents(container: HTMLElement): void {
    // Master switch
    const enabled = container.querySelector('#settingSmartInkEnabled') as HTMLInputElement;
    enabled?.addEventListener('change', () => {
      store.updateSettings({ smartInkEnabled: enabled.checked });
      store.setState({ isHandwritingEnabled: enabled.checked });
    });

    // Sensitivity
    const sensitivity = container.querySelector('#settingSmartInkSensitivity') as HTMLSelectElement;
    sensitivity?.addEventListener('change', () => {
      store.updateSettings({ smartInkSensitivity: sensitivity.value as any });
    });

    // Hold-to-snap
    const hold = container.querySelector('#settingSmartInkHoldToSnap') as HTMLInputElement;
    hold?.addEventListener('change', () => {
      store.updateSettings({ smartInkHoldToSnap: hold.checked });
    });

    // Shape delay
    const shapeSlider = container.querySelector('#settingSmartInkShapeDelay') as HTMLInputElement;
    const shapeVal = container.querySelector('#shapeDelayVal') as HTMLElement;
    shapeSlider?.addEventListener('input', () => {
      const sec = parseFloat(shapeSlider.value);
      if (shapeVal) shapeVal.textContent = `${sec.toFixed(2)}s`;
      store.updateSettings({ smartInkShapeDelayMs: Math.round(sec * 1000) });
    });

    // Convert text mode
    const convertText = container.querySelector('#settingSmartInkConvertText') as HTMLSelectElement;
    convertText?.addEventListener('change', () => {
      store.updateSettings({ smartInkConvertText: convertText.value as any });
    });

    // Text delay
    const textSlider = container.querySelector('#settingSmartInkTextDelay') as HTMLInputElement;
    const textVal = container.querySelector('#textDelayVal') as HTMLElement;
    textSlider?.addEventListener('input', () => {
      const sec = parseFloat(textSlider.value);
      if (textVal) textVal.textContent = `${sec.toFixed(1)}s`;
      store.updateSettings({ smartInkTextDelayMs: Math.round(sec * 1000) });
    });

    // AI Assist
    const aiAssist = container.querySelector('#settingSmartInkAiAssist') as HTMLInputElement;
    aiAssist?.addEventListener('change', () => {
      store.updateSettings({ smartInkAiAssist: aiAssist.checked });
    });

    // Correction level
    const correction = container.querySelector('#settingSmartInkCorrectionLevel') as HTMLSelectElement;
    correction?.addEventListener('change', () => {
      store.updateSettings({ smartInkCorrectionLevel: correction.value as any });
    });

    // Inspector toggle
    const inspectorToggle = container.querySelector('#settingSmartInkInspectorEnabled') as HTMLInputElement;
    inspectorToggle?.addEventListener('change', () => {
      store.updateSettings({ smartInkInspectorEnabled: inspectorToggle.checked });
      // Re-render settings panel to show/hide inspector table
      window.dispatchEvent(new CustomEvent('re-render-settings'));
    });

    // Copy report button
    const btnCopy = container.querySelector('#btnCopyInspectorReport');
    btnCopy?.addEventListener('click', async () => {
      try {
        const report = smartInkInspector.formatReport();
        await navigator.clipboard.writeText(report);
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: '📋 विश्लेषक रिपोर्ट क्लिपबोर्ड पर कॉपी की गई (Report copied)!' }
          })
        );
      } catch (e: any) {
        console.warn('Failed to copy report:', e);
      }
    });

    // Clear report button
    const btnClear = container.querySelector('#btnClearInspectorReport');
    btnClear?.addEventListener('click', () => {
      smartInkInspector.clearHistory();
      window.dispatchEvent(new CustomEvent('re-render-settings'));
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: 'विश्लेषक लॉग साफ़ कर दिया गया (Inspector cleared).' }
        })
      );
    });
  }
}

export const smartInkSettingsSection = new SmartInkSettingsSection();
