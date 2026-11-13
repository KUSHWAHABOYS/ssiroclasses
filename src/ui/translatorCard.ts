import { TranslationResult } from '../ai/translatorService';
import { layerManager } from '../core/layers';

export class TranslatorCardManager {
  private cardEl: HTMLElement | null = null;
  private minPillEl: HTMLElement | null = null;
  private currentResult: TranslationResult | null = null;
  private isMinimized = false;

  // Dragging state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialCardLeft = 0;
  private initialCardTop = 0;

  private getHost(): HTMLElement {
    return document.getElementById('stage') || document.body;
  }

  showLoading(nearX: number = 300, nearY: number = 180): void {
    this.close();
    this.ensureElements();

    if (!this.cardEl) return;
    this.cardEl.innerHTML = `
      <div class="translation-card-header">
        <div class="card-title-group">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span>AI अनुवाद लेंस (AI Smart Lens)</span>
        </div>
        <div class="card-actions-group">
          <button class="card-chip-btn close" id="btnTransClose" title="बंद करें">✕</button>
        </div>
      </div>
      <div class="translation-loading-wrap">
        <div class="translation-spinner"></div>
        <div style="font-size: 16px; font-weight: 600; color: #ffd76a;">
          ⚡ AI अनुवाद तैयार हो रहा है...
        </div>
        <div style="font-size: 13px; color: #cbd5e1; text-align: center;">
          अंग्रेजी / पालि / संस्कृत टेक्स्ट की पहचान एवं शुद्ध हिंदी अनुवाद किया जा रहा है।
        </div>
      </div>
    `;

    this.positionCard(nearX, nearY);
    this.cardEl.classList.remove('hidden');
    this.cardEl.querySelector('#btnTransClose')?.addEventListener('click', () => this.close());
  }

  showResult(result: TranslationResult, nearX: number = 300, nearY: number = 180): void {
    this.ensureElements();
    if (!this.cardEl) return;

    this.currentResult = result;
    this.isMinimized = false;
    this.minPillEl?.classList.add('hidden');

    const glossaryHtml = result.keyGlossary && result.keyGlossary.length > 0
      ? `
        <div class="section-label">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          मुख्य पारिभाषिक शब्दावली व अर्थ (Glossary)
        </div>
        <div class="glossary-container">
          ${result.keyGlossary
            .map(
              (g) => `
            <div class="glossary-row">
              <span style="color:#ffd76a;">•</span>
              <span><b>${this.escapeHtml(g.term)}:</b> ${this.escapeHtml(g.meaning)}</span>
            </div>`
            )
            .join('')}
        </div>
      `
      : '';

    const originalHtml = result.originalText
      ? `
        <div id="origTextWrapper" style="display:none; margin-top:8px;">
          <div class="section-label" style="font-size:12px; margin-bottom:4px;">पहचाना गया मूल टेक्स्ट (OCR Source):</div>
          <div class="original-text-block">${this.escapeHtml(result.originalText)}</div>
        </div>
      `
      : '';

    const langDisplay = result.detectedLanguage.includes('हिंदी')
      ? this.escapeHtml(result.detectedLanguage)
      : `${this.escapeHtml(result.detectedLanguage)} ➔ <strong>हिंदी</strong>`;

    this.cardEl.innerHTML = `
      <div class="translation-card-header" id="transDragHeader">
        <div class="card-title-group">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span>AI अनुवाद लेंस (AI Smart Lens)</span>
        </div>
        <div class="card-actions-group">
          <button class="card-chip-btn whole" id="btnTransWholeSlide" title="पूरी स्लाइड का अनुवाद करें">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg>
            पूरी स्लाइड
          </button>
          <button class="card-chip-btn" id="btnTransMinimize" title="छोटा करें">🗕 छोटा करें</button>
          <button class="card-chip-btn pin" id="btnTransPin" title="स्लाइड पर हमेशा के लिए चिपकाएं">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 17v5M9 2h6l1 7H8l1-7zM7 9h10v3l-2 3H9l-2-3V9z"/></svg>
            स्लाइड पर रखें
          </button>
          <button class="card-chip-btn close" id="btnTransClose" title="बंद करें">✕</button>
        </div>
      </div>

      <div class="translation-card-body">
        <div class="translation-lang-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          पहचानी गई भाषा: <strong>${langDisplay}</strong>
        </div>

        <div class="section-label">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          सरल व शुद्ध हिंदी अनुवाद (Hindi Translation)
        </div>

        <div class="hindi-translation-text">${this.escapeHtml(result.hindiTranslation)}</div>

        ${glossaryHtml}

        ${originalHtml}
      </div>

      <div class="translation-card-footer">
        <div style="display:flex; gap:8px;">
          <button class="footer-action-btn" id="btnTransSpeak">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            हिंदी में सुनें
          </button>
          <button class="footer-action-btn" id="btnTransCopy">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            कॉपी
          </button>
        </div>
        ${
          result.originalText
            ? `<button class="footer-action-btn" id="btnToggleOrigText" style="color:#ffd76a;">मूल पाठ देखें ▾</button>`
            : ''
        }
      </div>
    `;

    this.positionCard(nearX, nearY);
    this.cardEl.classList.remove('hidden');
    this.bindCardEvents();
  }

  showError(errorMsg: string, isMissingKey = false, nearX: number = 300, nearY: number = 180): void {
    this.ensureElements();
    if (!this.cardEl) return;

    this.cardEl.innerHTML = `
      <div class="translation-card-header">
        <div class="card-title-group" style="color:#fca5a5;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>${isMissingKey ? '🔑 Gemini API Key आवश्यक है' : '⚠️ अनुवाद में त्रुटि आई'}</span>
        </div>
        <div class="card-actions-group">
          <button class="card-chip-btn close" id="btnTransClose" title="बंद करें">✕</button>
        </div>
      </div>
      <div class="translation-card-body" style="padding: 24px;">
        <div style="font-size: 16px; color: #fff; line-height: 1.6;">
          ${
            isMissingKey
              ? 'AI लाइव अनुवाद सुविधा का उपयोग करने के लिए आपको अपनी Google Gemini API Key जोड़नी होगी। यह कुंजी आपके डिजिटल बोर्ड पर सुरक्षित (AES-256 Encrypted) रहेगी।'
              : this.escapeHtml(errorMsg)
          }
        </div>
        ${
          isMissingKey
            ? `
          <div style="margin-top: 12px; display:flex; justify-content:center;">
            <button id="btnOpenGeminiSettings" class="translator-guide-btn" style="padding:10px 24px; font-size:14px; background:linear-gradient(135deg, #ffd76a, #e8890c); color:#060e22; border:none; box-shadow:0 6px 18px rgba(232,137,12,0.4);">
              ⚙️ सेटिंग्स में API Key डालें (Open Settings)
            </button>
          </div>
        `
            : ''
        }
      </div>
    `;

    this.positionCard(nearX, nearY);
    this.cardEl.classList.remove('hidden');

    this.cardEl.querySelector('#btnTransClose')?.addEventListener('click', () => this.close());
    this.cardEl.querySelector('#btnOpenGeminiSettings')?.addEventListener('click', () => {
      this.close();
      window.dispatchEvent(new CustomEvent('toggle-settings', { detail: { tab: 'tab-gemini' } }));
    });
  }

  private ensureElements(): void {
    if (!this.cardEl) {
      this.cardEl = document.createElement('div');
      this.cardEl.className = 'translation-card hidden';
      this.cardEl.id = 'translationCard';
      this.getHost().appendChild(this.cardEl);
      this.bindDragging();
    }

    if (!this.minPillEl) {
      this.minPillEl = document.createElement('div');
      this.minPillEl.className = 'translation-min-pill hidden';
      this.minPillEl.id = 'translationMinPill';
      this.minPillEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span id="minPillText">🌐 अनुवाद देखें</span>
        <span style="font-size:11px; opacity:0.85;">▲</span>
      `;
      this.getHost().appendChild(this.minPillEl);

      this.minPillEl.addEventListener('click', () => {
        this.restoreFromMin();
      });
    }
  }

  private positionCard(nearX: number, nearY: number): void {
    if (!this.cardEl) return;
    const cardWidth = 580;
    const cardHeight = 440;
    const padding = 20;

    let targetLeft = nearX + 24;
    let targetTop = nearY;

    // Flip to left if not enough space on right
    if (targetLeft + cardWidth > window.innerWidth - padding) {
      targetLeft = Math.max(padding, nearX - cardWidth - 24);
    }

    // Flip or clamp vertically
    if (targetTop + cardHeight > window.innerHeight - 80) {
      targetTop = Math.max(76, window.innerHeight - cardHeight - 80);
    }

    targetLeft = Math.max(padding, Math.min(targetLeft, window.innerWidth - cardWidth - padding));
    targetTop = Math.max(76, Math.min(targetTop, window.innerHeight - cardHeight - 40));

    this.cardEl.style.left = `${targetLeft}px`;
    this.cardEl.style.top = `${targetTop}px`;
  }

  private bindCardEvents(): void {
    if (!this.cardEl) return;

    // Close button
    this.cardEl.querySelector('#btnTransClose')?.addEventListener('click', () => this.close());

    // Whole slide button
    this.cardEl.querySelector('#btnTransWholeSlide')?.addEventListener('click', () => {
      (window as any).__SMART_STUDIO_TRANSLATOR_OVERLAY__?.translateFullSlide();
    });

    // Minimize button
    this.cardEl.querySelector('#btnTransMinimize')?.addEventListener('click', () => this.minimize());

    // Pin button (sticky note on slide)
    this.cardEl.querySelector('#btnTransPin')?.addEventListener('click', () => this.pinToSlide());

    // Speak / TTS button
    this.cardEl.querySelector('#btnTransSpeak')?.addEventListener('click', () => this.speakHindi());

    // Copy button
    this.cardEl.querySelector('#btnTransCopy')?.addEventListener('click', () => this.copyToClipboard());

    // Toggle original text
    const btnToggleOrig = this.cardEl.querySelector('#btnToggleOrigText');
    const origWrapper = this.cardEl.querySelector('#origTextWrapper') as HTMLElement;
    btnToggleOrig?.addEventListener('click', () => {
      if (origWrapper) {
        const isHidden = origWrapper.style.display === 'none';
        origWrapper.style.display = isHidden ? 'block' : 'none';
        btnToggleOrig.textContent = isHidden ? 'मूल पाठ छिपाएं ▴' : 'मूल पाठ देखें ▾';
      }
    });
  }

  private bindDragging(): void {
    if (!this.cardEl) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      // Only drag from header, ignore buttons inside header
      if (!target.closest('.translation-card-header') || target.closest('button')) return;

      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.cardEl!.getBoundingClientRect();
      this.initialCardLeft = rect.left;
      this.initialCardTop = rect.top;

      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging || !this.cardEl) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      const newLeft = Math.max(10, Math.min(window.innerWidth - 100, this.initialCardLeft + dx));
      const newTop = Math.max(60, Math.min(window.innerHeight - 100, this.initialCardTop + dy));

      this.cardEl.style.left = `${newLeft}px`;
      this.cardEl.style.top = `${newTop}px`;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    };

    this.cardEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
  }

  minimize(): void {
    if (!this.cardEl || !this.currentResult) return;
    this.isMinimized = true;
    this.cardEl.classList.add('hidden');

    if (this.minPillEl) {
      const summaryText = this.currentResult.hindiTranslation.slice(0, 32) + '...';
      const pillText = this.minPillEl.querySelector('#minPillText');
      if (pillText) {
        pillText.textContent = `🌐 अनुवाद: ${summaryText}`;
      }
      this.minPillEl.classList.remove('hidden');
    }
  }

  restoreFromMin(): void {
    this.isMinimized = false;
    this.minPillEl?.classList.add('hidden');
    this.cardEl?.classList.remove('hidden');
  }

  pinToSlide(): void {
    if (!this.currentResult) return;
    const mediaLayer = document.getElementById('mediaLayer');
    if (!mediaLayer) return;

    const note = document.createElement('div');
    note.className = 'pinned-translation-note';
    note.style.left = `${Math.min(window.innerWidth - 480, Math.max(60, parseInt(this.cardEl?.style.left || '100', 10)))}px`;
    note.style.top = `${Math.min(window.innerHeight - 300, Math.max(100, parseInt(this.cardEl?.style.top || '120', 10)))}px`;

    note.innerHTML = `
      <div class="pinned-note-header">
        <span>📌 हिंदी अनुवाद नोट (${this.escapeHtml(this.currentResult.detectedLanguage)})</span>
        <button class="pinned-note-close" title="नोट हटाएं">✕</button>
      </div>
      <div style="font-size:15.5px; line-height:1.6; color:#ffffff; font-weight:500;">
        ${this.escapeHtml(this.currentResult.hindiTranslation)}
      </div>
    `;

    note.querySelector('.pinned-note-close')?.addEventListener('click', () => {
      note.remove();
    });

    // Make pinned note draggable across slide
    let isDraggingNote = false;
    let startX = 0, startY = 0, noteLeft = 0, noteTop = 0;
    note.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.pinned-note-close')) return;
      isDraggingNote = true;
      startX = e.clientX;
      startY = e.clientY;
      noteLeft = parseInt(note.style.left || '0', 10);
      noteTop = parseInt(note.style.top || '0', 10);
      try { note.setPointerCapture(e.pointerId); } catch {}
    });
    note.addEventListener('pointermove', (e) => {
      if (!isDraggingNote) return;
      note.style.left = `${noteLeft + (e.clientX - startX)}px`;
      note.style.top = `${noteTop + (e.clientY - startY)}px`;
    });
    note.addEventListener('pointerup', (e) => {
      isDraggingNote = false;
      try { note.releasePointerCapture(e.pointerId); } catch {}
    });

    mediaLayer.appendChild(note);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: '📌 अनुवाद स्लाइड पर पिन कर दिया गया।' } }));
    this.close();
  }

  private speakHindi(): void {
    if (!this.currentResult || !('speechSynthesis' in window)) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'ब्राउज़र में स्पीच समर्थित नहीं है', isError: true } }));
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(this.currentResult.hindiTranslation);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95;

    // Try finding Hindi voice
    const voices = window.speechSynthesis.getVoices();
    const hiVoice = voices.find((v) => v.lang.startsWith('hi'));
    if (hiVoice) {
      utterance.voice = hiVoice;
    }

    window.speechSynthesis.speak(utterance);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: '🔊 हिंदी में अनुवाद सुनाया जा रहा है...' } }));
  }

  private copyToClipboard(): void {
    if (!this.currentResult) return;
    const textToCopy = `${this.currentResult.hindiTranslation}\n\n[भाषा: ${this.currentResult.detectedLanguage}]`;
    navigator.clipboard?.writeText(textToCopy).then(() => {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: '📋 हिंदी अनुवाद क्लिपबोर्ड पर कॉपी हो गया।' } }));
    }).catch(() => {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'कॉपी करने में असमर्थ', isError: true } }));
    });
  }

  close(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.cardEl) {
      this.cardEl.classList.add('hidden');
    }
    if (this.minPillEl) {
      this.minPillEl.classList.add('hidden');
    }
    this.currentResult = null;
    this.isMinimized = false;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const translatorCardManager = new TranslatorCardManager();
