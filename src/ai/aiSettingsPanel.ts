// MIC-AI: Settings → AI Multi-Provider UI Component
import { store } from '../state/store';
import { keyVault } from './keyVault';
import { PROVIDERS_REGISTRY, detectProviderFromKeyShape, probeCandidateProviders } from './providers/registry';
import { discoverModels, clearModelCache, getCachedModels } from './modelDiscovery';
import { aiRouter } from './aiRouter';
import { AITask, QualityPreference } from './providers/types';
import { chromeBuiltInProvider } from './providers/chromeBuiltIn';

export class AISettingsPanel {
  private containerEl: HTMLElement | null = null;
  private providerStatuses: Record<string, { status: string; color: string; modelCount?: number }> = {};

  renderSection(): string {
    const s = store.getState().settings;
    const configuredProviders = keyVault.getAllConfiguredProviders();
    const sessionCalls = aiRouter.getSessionCallCount();

    const providerRowsHtml = configuredProviders.length === 0
      ? `<div style="padding:12px; font-size:13px; color:var(--text-muted); text-align:center; background:rgba(255,255,255,0.03); border-radius:8px;">
          कोई AI कुंजी सहेजी नहीं गई है। नीचे दी गई सूची से किसी भी प्रदाता की कुंजी जोड़ें।
         </div>`
      : configuredProviders.map((pId) => {
          const meta = PROVIDERS_REGISTRY[pId] || { name: pId, keyHint: '' };
          const masked = keyVault.getMaskedKey(pId) || '••••••••';
          const cachedModels = getCachedModels(pId);
          const modelCount = cachedModels ? cachedModels.length : 0;
          const statusInfo = this.providerStatuses[pId] || {
            status: modelCount > 0 ? `${modelCount} मॉडल उपलब्ध` : 'सक्रिय (Active)',
            color: '#10b981'
          };

          return `
            <div class="ai-key-row" data-provider="${pId}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:rgba(255,255,255,0.04); border-radius:8px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.08); gap:12px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:10px; min-width:180px;">
                <span style="font-weight:700; font-size:14px; color:#ffffff;">${meta.name}</span>
                <span style="font-size:11px; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.08); color:${statusInfo.color}; font-weight:600;">
                  ${statusInfo.status}
                </span>
              </div>
              <div style="font-family:monospace; font-size:13px; color:var(--primary-accent); letter-spacing:1px;">
                ${masked}
              </div>
              <div style="display:flex; gap:6px;">
                <button class="header-btn btn-ai-test" data-provider="${pId}" style="font-size:12px; padding:4px 10px;">जांचें (Test)</button>
                <button class="header-btn btn-ai-replace" data-provider="${pId}" style="font-size:12px; padding:4px 10px;">बदलें (Replace)</button>
                <button class="header-btn btn-ai-delete" data-provider="${pId}" style="font-size:12px; padding:4px 10px; color:#f87171;">हटाएं (Delete)</button>
              </div>
            </div>
          `;
        }).join('');

    const tasks: { id: AITask; name: string }[] = [
      { id: 'chat', name: 'AI चैट (Assistant Chat & Reasoning)' },
      { id: 'slide-explain', name: 'स्लाइड व्याख्या (Slide Vision Explain)' },
      { id: 'handwriting-ocr', name: 'स्मार्ट इंक हस्तलेखन (Handwriting OCR)' },
      { id: 'text-fix', name: 'टेक्स्ट सुधार (Grammar & Fix)' },
      { id: 'quick-answer', name: 'त्वरित उत्तर (Quick Answer)' }
    ];

    const taskOverridesHtml = tasks.map((t) => {
      const pinned = s.aiTaskPinnedModels?.[t.id];
      const pinnedLabel = pinned ? `${pinned.provider}: ${pinned.model}` : 'Auto (अनुशंसित / Best Model)';
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="font-size:13px; color:var(--text-muted);">${t.name}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; font-weight:600; color:var(--primary-accent);">${pinnedLabel}</span>
            ${pinned ? `<button class="header-btn btn-clear-pin" data-task="${t.id}" style="font-size:11px; padding:2px 6px;">Reset</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="settings-section" id="aiSettingsSection">
        <div class="settings-section-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span>🤖 बहु-प्रदाता AI राउटर (Multi-Provider AI Router)</span>
          <button class="header-btn" id="btnAiRefreshModels" style="font-size:11px; padding:3px 8px;">🔄 मॉडल पुनः खोजें (Re-detect)</button>
        </div>

        <!-- Add API Key Form -->
        <div class="setting-item" style="flex-direction:column; align-items:stretch; gap:10px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <select id="selectAiProvider" class="header-btn" style="background:#111; min-width:140px;">
              <option value="auto">Auto-detect (स्वतः पहचानें)</option>
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI</option>
              <option value="grok">xAI Grok</option>
              <option value="groq">Groq</option>
              <option value="mistral">Mistral AI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="perplexity">Perplexity</option>
              <option value="custom">Custom Endpoint</option>
            </select>
            <input type="password" id="inputAiNewKey" placeholder="API Key यहाँ पेस्ट करें... (Paste API key)" class="gemini-input" style="flex:1; min-width:200px;" />
            <button class="header-btn" id="btnAiSaveKey" style="background:var(--primary-accent); color:#000; font-weight:700; white-space:nowrap;">
              सहेजें व जांचें (Save & Validate)
            </button>
          </div>
          <div id="aiValidationStatus" style="font-size:12px; min-height:18px; color:var(--text-muted);"></div>
        </div>

        <!-- Saved Keys List -->
        <div style="margin-top:12px;">
          <div style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
            सहेजी गई API कुंजियाँ (Configured Keys)
          </div>
          ${providerRowsHtml}
        </div>

        <!-- Quality Preference & Safeguards -->
        <div style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">गुणवत्ता प्राथमिकता (Quality Preference)</span>
              <span class="setting-desc">किफ़ायती (Economy) में Flash-Lite मॉडल डिफ़ॉल्ट रहता है</span>
            </div>
            <select id="settingAiQuality" class="header-btn" style="background:#111;">
              <option value="economy" ${s.aiQualityPreference === 'economy' || !s.aiQualityPreference ? 'selected' : ''}>किफ़ायती / Economy (Flash-Lite — अनुशंसित व न्यूनतम टोकन)</option>
              <option value="balanced" ${s.aiQualityPreference === 'balanced' ? 'selected' : ''}>संतुलित / Balanced (चैट: स्टैंडर्ड Flash, इंक: तीव्र)</option>
              <option value="best" ${s.aiQualityPreference === 'best' ? 'selected' : ''}>सर्वोत्तम गुणवत्ता / Best Quality (हमेशा सर्वश्रेष्ठ तर्क)</option>
            </select>
          </div>

          <!-- ECON: Answer Length Setting (Part C2.1) -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">उत्तर की लंबाई (Answer Length)</span>
              <span class="setting-desc">टोकन खपत को नियंत्रित करने के लिए आउटपुट सीमा</span>
            </div>
            <select id="settingAiAnswerLength" class="header-btn" style="background:#111;">
              <option value="short" ${s.aiAnswerLength === 'short' ? 'selected' : ''}>संक्षिप्त / Short (~300 टोकन)</option>
              <option value="normal" ${s.aiAnswerLength === 'normal' || !s.aiAnswerLength ? 'selected' : ''}>सामान्य / Normal (~600 टोकन — डिफ़ॉल्ट)</option>
              <option value="detailed" ${s.aiAnswerLength === 'detailed' ? 'selected' : ''}>विस्तृत / Detailed (~1500 टोकन)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">सत्र AI कॉल सीमा चेतावनी (Warn after N calls)</span>
              <span class="setting-desc">अत्यधिक टोकन खपत से बचने के लिए सतर्कता</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="number" id="settingAiWarnCalls" min="0" max="500" step="5" value="${s.aiWarnAfterCalls || 0}" class="gemini-input" style="width:80px; text-align:center;" />
              <span style="font-size:11px; color:var(--text-muted);">(0 = बंद, सत्र में अब तक: ${sessionCalls})</span>
            </div>
          </div>

          <!-- ECON: Optional Chrome Built-in AI (Part C5) -->
          <div class="setting-item" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
            <div class="setting-label">
              <span class="setting-name">Chrome ऑन-डिवाइस AI (Chrome Built-in AI)</span>
              <span class="setting-desc">डेस्कटॉप क्रोम में ऑन-डिवाइस जेमिनी नैनो (मुफ़्त, अंग्रेज़ी हेतु)</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button class="header-btn" id="btnTestChromeAi" style="font-size:12px; padding:4px 10px;">जांचें (Test)</button>
              <span id="chromeAiStatusLabel" style="font-size:11px; color:var(--text-muted);">जांच लंबित</span>
            </div>
          </div>

          <!-- ECON: Optional WebMCP browser AI agents toggle (Part F) -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-name">ब्राउज़र AI एजेंट नियंत्रण (Allow browser AI agents - WebMCP)</span>
              <span class="setting-desc">प्रयोगात्मक: क्रोम एजेंट को स्लाइड नियंत्रण की अनुमति दें</span>
            </div>
            <input type="checkbox" id="settingWebMcp" ${s.webMcpEnabled ? 'checked' : ''} />
          </div>
        </div>

        <!-- Task Assignment Summary -->
        <div style="margin-top:14px; background:rgba(0,0,0,0.25); border-radius:8px; padding:12px; border:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:12px; font-weight:600; color:#ffffff; margin-bottom:8px;">
            📋 कार्य अनुसार चयनित मॉडल (Task Model Allocations)
          </div>
          ${taskOverridesHtml}
        </div>

        <!-- Honest Privacy & Security Notice -->
        <div style="margin-top:12px; padding:10px; background:rgba(217,119,6,0.08); border-left:3px solid #f59e0b; border-radius:4px;">
          <div style="font-size:11px; color:#fef3c7; line-height:1.5;">
            🔒 <strong>गोपनीयता व सुरक्षा गारंटी (Privacy Note):</strong><br>
            • कुंजियाँ इस डिवाइस पर AES-GCM 256-bit एन्क्रिप्टेड रहती हैं और केवल अनुरोध के समय मेमोरी में खोली जाती हैं।<br>
            • अनुरोध सीधे आपके डिवाइस से संबंधित प्रदाता के सर्वर पर जाते हैं। कोई मध्यस्थ या ट्रैकिंग सर्वर नहीं है।<br>
            • स्लाइड की छवियां व हस्तलेखन केवल आपके द्वारा चुने गए प्रदाता को विश्लेषण हेतु भेजे जाते हैं।<br>
            • माइक्रोफ़ोन का ऑडियो कभी किसी AI प्रदाता को नहीं भेजा जाता।
          </div>
        </div>
      </div>
    `;
  }

  bindEvents(container: HTMLElement): void {
    this.containerEl = container;

    // Save and validate key
    const btnSave = container.querySelector('#btnAiSaveKey');
    const inputKey = container.querySelector('#inputAiNewKey') as HTMLInputElement;
    const selectProvider = container.querySelector('#selectAiProvider') as HTMLSelectElement;
    const statusEl = container.querySelector('#aiValidationStatus') as HTMLElement;

    btnSave?.addEventListener('click', async () => {
      const raw = inputKey?.value.trim();
      if (!raw) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#f87171;">⚠️ कृपया मान्य API कुंजी दर्ज करें।</span>';
        return;
      }

      if (statusEl) statusEl.innerHTML = '⏳ कुंजी की पहचान व सत्यापन हो रहा है...';

      try {
        let detectedProvider = selectProvider.value;
        if (detectedProvider === 'auto') {
          // Auto-detect step 1: Key shape
          const shapeMatch = detectProviderFromKeyShape(raw);
          if (shapeMatch) {
            detectedProvider = shapeMatch;
          } else {
            // Auto-detect step 2: Parallel candidate probe
            const probeMatch = await probeCandidateProviders(raw);
            if (probeMatch) {
              detectedProvider = probeMatch;
            } else {
              // Ambiguous: ask user to choose provider manually
              if (statusEl) {
                statusEl.innerHTML = '<span style="color:#f59e0b;">⚠️ कुंजी के प्रदाता की स्वतः पहचान नहीं हो सकी। कृपया ड्रॉपडाउन से प्रदाता चुनें।</span>';
              }
              return;
            }
          }
        }

        // Validate key with provider
        const meta = PROVIDERS_REGISTRY[detectedProvider];
        if (!meta) {
          throw new Error(`अज्ञात प्रदाता: ${detectedProvider}`);
        }

        const isValid = await meta.adapter.validateKey(raw);
        if (!isValid) {
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#f87171;">❌ ${meta.name} द्वारा कुंजी अस्वीकृत (Invalid key or quota exceeded).</span>`;
          }
          return;
        }

        // Save key in vault
        await keyVault.storeKey(detectedProvider, raw);
        inputKey.value = '';

        // Discover and cache models
        try {
          await discoverModels(detectedProvider, raw, true);
        } catch {}

        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#10b981;">✅ ${meta.name} कुंजी सफलतापूर्वक सत्यापित और सहेजी गई!</span>`;
        }

        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: `AI प्रदाता ${meta.name} सक्रिय हो गया!` }
          })
        );

        // Re-render
        this.refreshSection();
      } catch (err: any) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#f87171;">❌ त्रुटि: ${err.message || 'Validation failed'}</span>`;
        }
      }
    });

    // Test Key Buttons
    container.querySelectorAll('.btn-ai-test').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-provider');
        if (!pId) return;
        const meta = PROVIDERS_REGISTRY[pId];
        const key = await keyVault.getKey(pId);
        if (!key || !meta) return;

        const row = (e.currentTarget as HTMLElement).closest('.ai-key-row');
        const badge = row?.querySelector('span[style*="border-radius:4px"]') as HTMLElement;
        if (badge) badge.textContent = 'जांच हो रही है...';

        try {
          const ok = await meta.adapter.validateKey(key);
          const models = await discoverModels(pId, key, true);
          if (ok) {
            this.providerStatuses[pId] = {
              status: `सत्यापित (${models.length} मॉडल)`,
              color: '#10b981',
              modelCount: models.length
            };
            if (badge) {
              badge.textContent = `सत्यापित (${models.length} मॉडल)`;
              badge.style.color = '#10b981';
            }
            window.dispatchEvent(
              new CustomEvent('app-toast', {
                detail: { message: `✅ ${meta.name} कनेक्शन सफल!` }
              })
            );
          } else {
            this.providerStatuses[pId] = { status: 'अमान्य', color: '#f87171' };
            if (badge) {
              badge.textContent = 'अमान्य कुंजी';
              badge.style.color = '#f87171';
            }
          }
        } catch (err: any) {
          const isCors = err?.message?.includes('CORS') || err?.message?.includes('ब्राउज़र');
          const msg = isCors ? 'Blocked by Browser' : 'त्रुटि';
          this.providerStatuses[pId] = { status: msg, color: '#f59e0b' };
          if (badge) {
            badge.textContent = msg;
            badge.style.color = '#f59e0b';
          }
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { message: err?.message || 'Connection test failed', isError: true }
            })
          );
        }
      });
    });

    // Delete Key Buttons
    container.querySelectorAll('.btn-ai-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-provider');
        if (!pId) return;
        const meta = PROVIDERS_REGISTRY[pId];
        if (confirm(`क्या आप वाकई ${meta?.name || pId} की API कुंजी को मिटाना चाहते हैं?`)) {
          keyVault.deleteKey(pId);
          clearModelCache(pId);
          delete this.providerStatuses[pId];
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { message: `${meta?.name || pId} कुंजी हटा दी गई।` }
            })
          );
          this.refreshSection();
        }
      });
    });

    // Replace Key Buttons
    container.querySelectorAll('.btn-ai-replace').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-provider');
        if (!pId) return;
        if (selectProvider) selectProvider.value = pId;
        if (inputKey) {
          inputKey.value = '';
          inputKey.placeholder = `नया ${PROVIDERS_REGISTRY[pId]?.name || pId} API Key दर्ज करें...`;
          inputKey.focus();
        }
      });
    });

    // Quality Preference Change
    const qualitySelect = container.querySelector('#settingAiQuality') as HTMLSelectElement;
    qualitySelect?.addEventListener('change', () => {
      store.updateSettings({ aiQualityPreference: qualitySelect.value as QualityPreference });
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: `AI गुणवत्ता: ${qualitySelect.value}` }
        })
      );
    });

    // Warn Calls Threshold
    const warnInput = container.querySelector('#settingAiWarnCalls') as HTMLInputElement;
    warnInput?.addEventListener('change', () => {
      const val = Math.max(0, parseInt(warnInput.value, 10) || 0);
      store.updateSettings({ aiWarnAfterCalls: val });
    });

    // ECON: Answer Length change listener (Part C2.1)
    const answerLenSelect = container.querySelector('#settingAiAnswerLength') as HTMLSelectElement;
    answerLenSelect?.addEventListener('change', () => {
      store.updateSettings({ aiAnswerLength: answerLenSelect.value as any });
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: `AI उत्तर सीमा: ${answerLenSelect.value}` }
        })
      );
    });

    // ECON: WebMCP toggle listener (Part F)
    const webMcpCheckbox = container.querySelector('#settingWebMcp') as HTMLInputElement;
    webMcpCheckbox?.addEventListener('change', () => {
      store.updateSettings({ webMcpEnabled: webMcpCheckbox.checked });
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: `WebMCP एजेंट: ${webMcpCheckbox.checked ? 'सक्रिय' : 'निष्क्रिय'}` }
        })
      );
    });

    // ECON: Chrome Built-in AI test listener (Part C5)
    const btnTestChrome = container.querySelector('#btnTestChromeAi');
    const chromeStatusLabel = container.querySelector('#chromeAiStatusLabel');
    btnTestChrome?.addEventListener('click', async () => {
      if (chromeStatusLabel) chromeStatusLabel.textContent = 'परीक्षण जारी...';
      const status = await chromeBuiltInProvider.getStatus();
      if (!status.available) {
        if (chromeStatusLabel) chromeStatusLabel.textContent = status.statusText;
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: `Chrome AI: ${status.statusText}`, isError: true }
          })
        );
        return;
      }
      try {
        const testRes = await chromeBuiltInProvider.testPrompt();
        if (chromeStatusLabel) chromeStatusLabel.textContent = `सफल (${status.statusText})`;
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: `Chrome AI उत्तर: "${testRes}"` }
          })
        );
      } catch (e: any) {
        if (chromeStatusLabel) chromeStatusLabel.textContent = 'त्रुटि';
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: `Chrome AI परीक्षण त्रुटि: ${e?.message || 'Failed'}`, isError: true }
          })
        );
      }
    });

    // Re-detect models button
    const btnRefresh = container.querySelector('#btnAiRefreshModels');
    btnRefresh?.addEventListener('click', async () => {
      clearModelCache();
      const configured = keyVault.getAllConfiguredProviders();
      let totalDiscovered = 0;
      for (const pId of configured) {
        const k = await keyVault.getKey(pId);
        if (k) {
          try {
            const m = await discoverModels(pId, k, true);
            totalDiscovered += m.length;
          } catch {}
        }
      }
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: `🔄 मॉडल रिफ्रेश पूर्ण: कुल ${totalDiscovered} मॉडल प्राप्त हुए` }
        })
      );
      this.refreshSection();
    });

    // Clear pin override buttons
    container.querySelectorAll('.btn-clear-pin').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task');
        if (!taskId) return;
        const currentPins = { ...(store.getState().settings.aiTaskPinnedModels || {}) };
        delete currentPins[taskId];
        store.updateSettings({ aiTaskPinnedModels: currentPins });
        this.refreshSection();
      });
    });
  }

  private refreshSection(): void {
    if (!this.containerEl) return;
    const oldSec = this.containerEl.querySelector('#aiSettingsSection');
    if (!oldSec) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this.renderSection();
    const newSec = tempDiv.firstElementChild;
    if (newSec) {
      oldSec.replaceWith(newSec);
      this.bindEvents(this.containerEl);
    }
  }
}

export const aiSettingsPanel = new AISettingsPanel();
