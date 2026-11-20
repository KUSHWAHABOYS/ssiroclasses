import { TranslationResult } from '../ai/translatorService';

export class TranslatorCardManager {
  private cardEl: HTMLElement | null = null;
  private currentResult: TranslationResult | null = null;
  private fontScale = 1.0;

  // Dragging state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialCardLeft = 0;
  private initialCardTop = 0;

  // Resizing state
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private initialCardWidth = 520;
  private initialCardHeight = 360;

  // Touch pinch state
  private initialPinchDist = 0;
  private initialPinchScale = 1.0;

  private isInteractionsBound = false;

  private getHost(): HTMLElement {
    return document.getElementById('stage') || document.body;
  }

  constructor() {
    try {
      const savedScale = localStorage.getItem('smart_studio_trans_font_scale');
      if (savedScale) this.fontScale = Math.max(0.7, Math.min(2.5, parseFloat(savedScale) || 1.0));
    } catch {}
  }

  showLoading(nearX: number = 300, nearY: number = 180): void {
    this.close();
    this.ensureElements();

    if (!this.cardEl) return;
    this.cardEl.innerHTML = `
      <div class="translation-card-header" id="transDragHeader">
        <div class="trans-header-left">
          <div class="trans-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>Translation</span>
          </div>
        </div>
        <div class="trans-actions">
          <button class="trans-btn close" id="btnTransClose" title="Close">✕</button>
        </div>
      </div>
      <div class="translation-loading-wrap">
        <div class="translation-spinner"></div>
        <div class="translation-loading-text">Translating...</div>
      </div>
      <div class="trans-resize-handle" id="transResizeHandle" title="Drag to Resize">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#64748b" stroke-width="2.5">
          <line x1="20" y1="8" x2="8" y2="20"/>
          <line x1="20" y1="13" x2="13" y2="20"/>
          <line x1="20" y1="18" x2="18" y2="20"/>
        </svg>
      </div>
    `;

    this.positionCard(nearX, nearY);
    this.cardEl.classList.remove('hidden');
  }

  showResult(result: TranslationResult, nearX: number = 300, nearY: number = 180): void {
    this.ensureElements();
    if (!this.cardEl) return;

    this.currentResult = result;

    const glossaryHtml =
      result.keyGlossary && result.keyGlossary.length > 0
        ? `
        <div class="trans-key-section">
          <div class="trans-key-label">Key Terms &amp; Definitions:</div>
          <div class="trans-glossary-list">
            ${result.keyGlossary
              .map(
                (g) => `
              <div class="trans-glossary-item">
                <span class="bullet">•</span>
                <span class="term"><b>${this.escapeHtml(g.term)}:</b></span>
                <span class="meaning">${this.escapeHtml(g.meaning)}</span>
              </div>`
              )
              .join('')}
          </div>
        </div>
      `
        : '';

    this.cardEl.innerHTML = `
      <div class="translation-card-header" id="transDragHeader">
        <div class="trans-header-left">
          <div class="trans-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>Hindi Translation</span>
          </div>
        </div>
        <div class="trans-actions">
          <button class="trans-btn scale-btn" id="btnTransScaleDown" title="Decrease font (A−)">A−</button>
          <button class="trans-btn scale-btn" id="btnTransScaleUp" title="Increase font (A+)">A+</button>
          <button class="trans-btn" id="btnTransSpeak" title="Listen in Hindi">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
          <button class="trans-btn" id="btnTransCopy" title="Copy">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="trans-btn close" id="btnTransClose" title="Close">✕</button>
        </div>
      </div>

      <div class="translation-card-body" id="transCardBody" style="--trans-scale: ${this.fontScale};">
        <div class="hindi-translation-text">${this.escapeHtml(result.hindiTranslation)}</div>
        ${glossaryHtml}
      </div>

      <div class="trans-resize-handle" id="transResizeHandle" title="Drag to Resize">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#64748b" stroke-width="2.5">
          <line x1="20" y1="8" x2="8" y2="20"/>
          <line x1="20" y1="13" x2="13" y2="20"/>
          <line x1="20" y1="18" x2="18" y2="20"/>
        </svg>
      </div>
    `;

    this.positionCard(nearX, nearY);
    this.cardEl.classList.remove('hidden');
  }

  showError(errorMsg: string, isMissingKey = false, nearX: number = 300, nearY: number = 180): void {
    this.ensureElements();
    if (!this.cardEl) return;

    this.cardEl.innerHTML = `
      <div class="translation-card-header">
        <div class="trans-header-left">
          <div class="trans-badge" style="color: #ef4444;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>${isMissingKey ? 'Gemini API Key Required' : 'Error'}</span>
          </div>
        </div>
        <div class="trans-actions">
          <button class="trans-btn close" id="btnTransClose" title="Close">✕</button>
        </div>
      </div>
      <div class="translation-card-body" style="padding: 22px;">
        <div style="font-size: 15px; color: #475569; line-height: 1.6;">
          ${
            isMissingKey
              ? 'To use AI Translation, enter your Google Gemini API Key in Settings.'
              : this.escapeHtml(errorMsg)
          }
        </div>
      </div>
      <div class="trans-resize-handle" id="transResizeHandle" title="Drag to Resize">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#64748b" stroke-width="2.5">
          <line x1="20" y1="8" x2="8" y2="20"/>
          <line x1="20" y1="13" x2="13" y2="20"/>
          <line x1="20" y1="18" x2="18" y2="20"/>
        </svg>
      </div>
    `;

    this.positionCard(nearX, nearY);
    this.cardEl.classList.remove('hidden');
  }

  private ensureElements(): void {
    if (!this.cardEl) {
      this.cardEl = document.createElement('div');
      this.cardEl.className = 'translation-card hidden';
      this.cardEl.id = 'translationCard';
      this.getHost().appendChild(this.cardEl);
      this.bindInteractionsOnce();
    }
  }

  private positionCard(nearX: number, nearY: number): void {
    if (!this.cardEl) return;

    let cardWidth = 520;
    let cardHeight = 360;
    try {
      const sw = localStorage.getItem('smart_studio_trans_card_w');
      const sh = localStorage.getItem('smart_studio_trans_card_h');
      if (sw) cardWidth = Math.min(window.innerWidth - 30, Math.max(300, parseInt(sw, 10)));
      if (sh) cardHeight = Math.min(window.innerHeight - 60, Math.max(160, parseInt(sh, 10)));
    } catch {}

    this.cardEl.style.width = `${cardWidth}px`;
    this.cardEl.style.height = `${cardHeight}px`;

    const padding = 20;
    let targetLeft = nearX + 20;
    let targetTop = nearY;

    if (targetLeft + cardWidth > window.innerWidth - padding) {
      targetLeft = Math.max(padding, nearX - cardWidth - 20);
    }

    if (targetTop + cardHeight > window.innerHeight - 80) {
      targetTop = Math.max(76, window.innerHeight - cardHeight - 80);
    }

    targetLeft = Math.max(padding, Math.min(targetLeft, window.innerWidth - cardWidth - padding));
    targetTop = Math.max(76, Math.min(targetTop, window.innerHeight - cardHeight - 40));

    this.cardEl.style.left = `${targetLeft}px`;
    this.cardEl.style.top = `${targetTop}px`;
  }

  private bindInteractionsOnce(): void {
    if (this.isInteractionsBound || !this.cardEl) return;
    this.isInteractionsBound = true;

    // PointerDown on card: Handles resize handle & header dragging
    this.cardEl.addEventListener('pointerdown', (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      // 1. Resizing from corner handle
      const resizeHandle = target.closest('#transResizeHandle, .trans-resize-handle') as HTMLElement | null;
      if (resizeHandle) {
        e.stopPropagation();
        e.preventDefault();
        this.isResizing = true;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        const rect = this.cardEl!.getBoundingClientRect();
        this.initialCardWidth = rect.width;
        this.initialCardHeight = rect.height;
        try {
          resizeHandle.setPointerCapture(e.pointerId);
        } catch {}
        return;
      }

      // 2. Dragging card from header
      if (target.closest('.translation-card-header') && !target.closest('button')) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const rect = this.cardEl!.getBoundingClientRect();
        this.initialCardLeft = rect.left;
        this.initialCardTop = rect.top;
        try {
          target.setPointerCapture(e.pointerId);
        } catch {}
      }
    });

    // Window PointerMove: Smooth resizing and dragging
    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        if (this.isResizing && this.cardEl) {
          const dx = e.clientX - this.resizeStartX;
          const dy = e.clientY - this.resizeStartY;
          const newW = Math.max(300, Math.min(window.innerWidth - 20, this.initialCardWidth + dx));
          const newH = Math.max(160, Math.min(window.innerHeight - 40, this.initialCardHeight + dy));
          this.cardEl.style.width = `${newW}px`;
          this.cardEl.style.height = `${newH}px`;
          return;
        }

        if (this.isDragging && this.cardEl) {
          const dx = e.clientX - this.dragStartX;
          const dy = e.clientY - this.dragStartY;
          const newLeft = Math.max(8, Math.min(window.innerWidth - 80, this.initialCardLeft + dx));
          const newTop = Math.max(60, Math.min(window.innerHeight - 80, this.initialCardTop + dy));
          this.cardEl.style.left = `${newLeft}px`;
          this.cardEl.style.top = `${newTop}px`;
        }
      },
      { passive: true }
    );

    // Stop Resizing & Dragging
    const stopInteractions = (e: PointerEvent) => {
      if (this.isResizing && this.cardEl) {
        this.isResizing = false;
        const rect = this.cardEl.getBoundingClientRect();
        try {
          localStorage.setItem('smart_studio_trans_card_w', String(Math.round(rect.width)));
          localStorage.setItem('smart_studio_trans_card_h', String(Math.round(rect.height)));
        } catch {}
      }
      if (this.isDragging) {
        this.isDragging = false;
      }
    };

    window.addEventListener('pointerup', stopInteractions, { passive: true });
    window.addEventListener('pointercancel', stopInteractions, { passive: true });

    // Click Delegation for Buttons
    this.cardEl.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#btnTransClose')) {
        this.close();
      } else if (target.closest('#btnTransScaleUp')) {
        e.stopPropagation();
        this.fontScale = Math.min(2.5, Math.round((this.fontScale + 0.15) * 100) / 100);
        this.applyFontScale();
      } else if (target.closest('#btnTransScaleDown')) {
        e.stopPropagation();
        this.fontScale = Math.max(0.7, Math.round((this.fontScale - 0.15) * 100) / 100);
        this.applyFontScale();
      } else if (target.closest('#btnTransSpeak')) {
        e.stopPropagation();
        this.speakHindi();
      } else if (target.closest('#btnTransCopy')) {
        e.stopPropagation();
        this.copyToClipboard();
      }
    });

    // Touch pinch gesture on translation card for 2-finger scaling
    this.cardEl.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.initialPinchDist = Math.hypot(dx, dy);
        this.initialPinchScale = this.fontScale;
      }
    }, { passive: true });

    this.cardEl.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 2 && this.initialPinchDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scaleFactor = dist / this.initialPinchDist;
        this.fontScale = Math.max(0.7, Math.min(2.5, Math.round(this.initialPinchScale * scaleFactor * 100) / 100));
        this.applyFontScale();
      }
    }, { passive: true });

    this.cardEl.addEventListener('touchend', (e: TouchEvent) => {
      if (e.touches.length < 2) {
        this.initialPinchDist = 0;
      }
    }, { passive: true });
  }

  private applyFontScale(): void {
    const body = this.cardEl?.querySelector('#transCardBody') as HTMLElement | null;
    if (body) {
      body.style.setProperty('--trans-scale', String(this.fontScale));
    }
    try {
      localStorage.setItem('smart_studio_trans_font_scale', String(this.fontScale));
    } catch {}
  }

  private speakHindi(): void {
    if (!this.currentResult || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(this.currentResult.hindiTranslation);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const hiVoice = voices.find((v) => v.lang.startsWith('hi'));
    if (hiVoice) utterance.voice = hiVoice;

    const speakBtn = this.cardEl?.querySelector('#btnTransSpeak');
    speakBtn?.classList.add('active-speak');
    utterance.onend = () => speakBtn?.classList.remove('active-speak');
    utterance.onerror = () => speakBtn?.classList.remove('active-speak');

    window.speechSynthesis.speak(utterance);
  }

  private copyToClipboard(): void {
    if (!this.currentResult) return;
    navigator.clipboard?.writeText(this.currentResult.hindiTranslation).then(() => {
      const copyBtn = this.cardEl?.querySelector('#btnTransCopy') as HTMLElement | null;
      if (copyBtn) {
        copyBtn.innerHTML = '✓';
        copyBtn.style.color = '#16a34a';
        setTimeout(() => {
          if (copyBtn) {
            copyBtn.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>`;
            copyBtn.style.color = '';
          }
        }, 1500);
      }
    }).catch(() => {});
  }

  close(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.cardEl) {
      this.cardEl.classList.add('hidden');
    }
    this.currentResult = null;
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
