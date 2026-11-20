// INKFIX: Smart Ink Settings & Inspector UI (Part D, E, F, H1)
import { store } from '../state/store';
import { smartInkInspector } from '../smartink/inspector';

export class SmartInkSettingsSection {
  renderSection(): string {
    const s = store.getState().settings;

    const history = smartInkInspector.getHistory();
    const inspectorRows = history.length === 0
      ? `<tr><td colspan="6" style="text-align:center; padding:12px; color:var(--text-muted); font-size:12px;">No decisions recorded yet</td></tr>`
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
        <div class="settings-section-title">✍️ Smart Ink & Auto-Beautify</div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">Enable Smart Ink</span>
            <span class="setting-desc">Auto-beautify freehand shapes, lines, and handwriting</span>
          </div>
          <input type="checkbox" id="settingSmartInkEnabled" ${s.smartInkEnabled !== false ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">Sensitivity Thresholds</span>
            <span class="setting-desc">Shape recognition tolerance (Normal default)</span>
          </div>
          <select id="settingSmartInkSensitivity" class="header-btn" style="background:#111;">
            <option value="normal" ${s.smartInkSensitivity === 'normal' ? 'selected' : ''}>Normal (Balanced default)</option>
            <option value="forgiving" ${s.smartInkSensitivity === 'forgiving' ? 'selected' : ''}>Forgiving (1.25× tolerance)</option>
            <option value="strict" ${s.smartInkSensitivity === 'strict' ? 'selected' : ''}>Strict (Accurate)</option>
          </select>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">Hold-to-Snap (0.5s)</span>
            <span class="setting-desc">Hold stylus steady at end of stroke to instantly snap shape</span>
          </div>
          <input type="checkbox" id="settingSmartInkHoldToSnap" ${s.smartInkHoldToSnap !== false ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">Shape Snap Delay</span>
            <span class="setting-desc">Time after stylus lift to trigger shape recognition (0.45s default)</span>
          </div>
          <input type="range" id="settingSmartInkShapeDelay" min="0.2" max="1.5" step="0.05" value="${(s.smartInkShapeDelayMs || 450) / 1000}" class="popover-slider" style="width:120px;" />
          <span id="shapeDelayVal">${((s.smartInkShapeDelayMs || 450) / 1000).toFixed(2)}s</span>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">Convert Text Mode</span>
            <span class="setting-desc">Convert handwriting into digital typography (Word-by-word default)</span>
          </div>
          <select id="settingSmartInkConvertText" class="header-btn" style="background:#111;">
            <option value="word" ${s.smartInkConvertText === 'word' ? 'selected' : ''}>Word by word (Default)</option>
            <option value="line" ${s.smartInkConvertText === 'line' ? 'selected' : ''}>Whole line (2.0s delay)</option>
            <option value="off" ${s.smartInkConvertText === 'off' ? 'selected' : ''}>Off (Keep raw ink)</option>
          </select>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">Text Delay</span>
            <span class="setting-desc">Time after writing before OCR triggers (1.0s default)</span>
          </div>
          <input type="range" id="settingSmartInkTextDelay" min="0.6" max="3.0" step="0.1" value="${(s.smartInkTextDelayMs || 1000) / 1000}" class="popover-slider" style="width:120px;" />
          <span id="textDelayVal">${((s.smartInkTextDelayMs || 1000) / 1000).toFixed(1)}s</span>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">AI-Assisted Shape Recognition</span>
            <span class="setting-desc">Secondary opinion from AI for ambiguous strokes (Fast tier)</span>
          </div>
          <input type="checkbox" id="settingSmartInkAiAssist" ${s.smartInkAiAssist !== false ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <span class="setting-name">Correction Level</span>
            <span class="setting-desc">Glossary and spelling correction level</span>
          </div>
          <select id="settingSmartInkCorrectionLevel" class="header-btn" style="background:#111;">
            <option value="light" ${s.smartInkCorrectionLevel === 'light' ? 'selected' : ''}>Light spelling fix</option>
            <option value="full" ${s.smartInkCorrectionLevel === 'full' ? 'selected' : ''}>Full glossary match</option>
            <option value="none" ${s.smartInkCorrectionLevel === 'none' ? 'selected' : ''}>None (Exact ink text)</option>
          </select>
        </div>

        <!-- H1: Smart Ink Inspector -->
        <div class="setting-item" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:14px; margin-top:8px;">
          <div class="setting-label">
            <span class="setting-name">🔬 Smart Ink Inspector</span>
            <span class="setting-desc">Diagnostics: Review recent 20 conversion decisions (100% in-device)</span>
          </div>
          <input type="checkbox" id="settingSmartInkInspectorEnabled" ${s.smartInkInspectorEnabled ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary-accent);" />
        </div>

        ${s.smartInkInspectorEnabled ? `
          <div id="inspectorContainer" style="margin-top:10px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:12px; font-weight:600; color:var(--primary-accent);">Recent 20 Decisions (Decision History)</span>
              <div style="display:flex; gap:8px;">
                <button class="header-btn" id="btnCopyInspectorReport" style="font-size:11px; padding:4px 10px; background:rgba(56,189,248,0.15); border-color:var(--primary-accent);">
                  📋 Copy Report
                </button>
                <button class="header-btn" id="btnClearInspectorReport" style="font-size:11px; padding:4px 10px; background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.5); color:#fca5a5;">
                  Clear
                </button>
              </div>
            </div>
            <div style="max-height:220px; overflow-y:auto; border:1px solid rgba(255,255,255,0.06); border-radius:4px;">
              <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                  <tr style="background:rgba(255,255,255,0.05); font-size:11px; color:var(--text-muted);">
                    <th style="padding:6px 8px;">Time</th>
                    <th style="padding:6px 8px;">Tool</th>
                    <th style="padding:6px 8px;">Branch</th>
                    <th style="padding:6px 8px;">Result</th>
                    <th style="padding:6px 8px;">Speed</th>
                    <th style="padding:6px 8px;">Reason</th>
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
            detail: { message: '📋 Report copied to clipboard!' }
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
          detail: { message: 'Inspector decision history cleared.' }
        })
      );
    });
  }
}

export const smartInkSettingsSection = new SmartInkSettingsSection();
