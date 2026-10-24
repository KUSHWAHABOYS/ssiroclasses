// MIC-AI: Multi-Provider AI Teaching Assistant Panel wired to central aiRouter
// ECON: Resizable & Dockable UI, Token-Minimizing Slide Explain, Markdown Rendering, Quick Chips, Friendly Errors
import { store } from '../state/store';
import { aiRouter, AIRunResult } from '../ai/aiRouter';
import { keyVault } from '../ai/keyVault';
import { layerManager } from '../core/layers';
import { textLineDetector } from '../smartink/textLines';
import { annotationStore, Stroke } from '../draw/annotationStore';
import { quotaManager, FriendlyErrorResult } from '../ai/quotaManager';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
  friendlyError?: FriendlyErrorResult;
  model?: string;
  provider?: string;
  cached?: boolean;
}

export type PanelDockMode = 'right' | 'left' | 'bottom' | 'floating';

interface PanelState {
  dock: PanelDockMode;
  width: number;
  height: number;
  top?: number;
  left?: number;
  fontSize: number;
  isMaximized: boolean;
  isMinimized: boolean;
}

const PANEL_STORAGE_KEY = 'ssiro_gemini_panel_state_v1';

export class GeminiPanel {
  private panelEl!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private modelLabelEl: HTMLElement | null = null;
  private usageMeterEl: HTMLElement | null = null;
  private history: ChatHistoryItem[] = [];
  private isProcessing = false;
  private lastUserQuestion = '';

  private state: PanelState = {
    dock: 'right',
    width: 380,
    height: 600,
    fontSize: 14,
    isMaximized: false,
    isMinimized: false
  };

  // Resize drag tracking
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialWidth = 0;
  private initialHeight = 0;
  private initialLeft = 0;
  private initialTop = 0;
  private activeHandle: string | null = null;

  init(): void {
    this.panelEl = document.getElementById('geminiPanel') as HTMLElement;
    this.loadState();
    this.render();
    this.applyState();
    this.bindEvents();
    this.updateUsageMeter();
  }

  private loadState(): void {
    try {
      const raw = localStorage.getItem(PANEL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = {
          ...this.state,
          ...parsed,
          isMaximized: false,
          isMinimized: false
        };
      }
    } catch {}
  }

  private saveState(): void {
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  private render(): void {
    this.panelEl.innerHTML = `
      <!-- Resize Handles -->
      <div class="panel-resize-handle edge-left" data-handle="left"></div>
      <div class="panel-resize-handle edge-right" data-handle="right"></div>
      <div class="panel-resize-handle edge-top" data-handle="top"></div>
      <div class="panel-resize-handle corner-top-left" data-handle="top-left"></div>
      <div class="panel-resize-handle corner-bottom-left" data-handle="bottom-left"></div>

      <!-- Main Header -->
      <div class="gemini-header">
        <div class="gemini-title" style="display:flex; flex-direction:column; gap:2px; overflow:hidden;">
          <div style="display:flex; align-items:center; gap:6px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>
            <span style="font-weight:700; font-size:14px; white-space:nowrap;">AI सहायक</span>
            <span id="aiActiveModelLabel" style="font-size:11px; font-weight:normal; color:var(--primary-accent); background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Gemini Flash-Lite</span>
          </div>
          <div id="aiUsageMeter" style="font-size:10px; color:rgba(255,255,255,0.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            Calls: 0 • ~0 tok
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:4px;">
          <!-- Font Size Buttons -->
          <button class="header-btn" id="btnFontDec" title="छोटा फॉन्ट (Smaller text)" style="padding:4px 8px; font-size:12px; font-weight:700;">A−</button>
          <button class="header-btn" id="btnFontInc" title="बड़ा फॉन्ट (Larger text)" style="padding:4px 8px; font-size:12px; font-weight:700;">A+</button>
          <!-- Dock Cycle Button -->
          <button class="header-btn" id="btnDockCycle" title="स्थान बदलें (Dock mode)" style="padding:4px 8px; font-size:12px;">⎘</button>
          <!-- Minimize Button -->
          <button class="header-btn" id="btnMinimize" title="छोटा करें (Minimize)" style="padding:4px 8px; font-size:12px;">−</button>
          <!-- Maximize Button -->
          <button class="header-btn" id="btnMaximize" title="पूर्ण स्क्रीन (Maximize)" style="padding:4px 8px; font-size:12px;">⛶</button>
          <!-- Close Button -->
          <button class="media-win-btn" id="btnGeminiClose" title="बंद करें (Close)" style="font-size:16px;">✕</button>
        </div>
      </div>

      <!-- Action Button: Explain Slide (Text-First) -->
      <button class="gemini-vision-action" id="btnExplainSlide" style="margin: 8px 12px; border-radius: 8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>यह स्लाइड समझाएं (Explain Slide)</span>
      </button>

      <!-- Quick Action Chips (Part C6.3) -->
      <div class="quick-action-chips" id="quickActionChips" style="display:flex; gap:6px; overflow-x:auto; padding:0 12px 6px; scrollbar-width:none;">
        <button class="quick-chip" data-prompt="स्लाइड का सार संक्षेप में हिंदी में बताएं।">स्लाइड का सार</button>
        <button class="quick-chip" data-prompt="इस स्लाइड के 3-4 मुख्य बिंदु (key points) बुलेट में दें।">मुख्य बिंदु</button>
        <button class="quick-chip" data-prompt="सरल और बोलचाल की हिंदी में यह विषय समझाएं।">सरल हिंदी</button>
        <button class="quick-chip" data-prompt="इस स्लाइड से 5 बहुविकल्पीय क्विज़ प्रश्न और उत्तर बनाएं।">5 क्विज़ प्रश्न</button>
        <button class="quick-chip" data-prompt="यहाँ छात्रों को क्या समझने में कठिनाई हो सकती है और उसका समाधान क्या है?">कठिन बिंदु</button>
      </div>

      <!-- Messages Area -->
      <div class="gemini-messages" id="geminiMessages" style="flex:1; overflow-y:auto; overflow-x:hidden; padding:12px; display:flex; flex-direction:column; gap:10px;">
        <div class="chat-bubble model" style="overflow-wrap:anywhere; word-break:break-word;">
          नमस्ते! मैं डिकोडिंग इंडोलॉजी का AI शिक्षण सहायक हूँ। आप मुझसे इस स्लाइड या किसी भी विषय पर हिंदी या अंग्रेज़ी में सवाल पूछ सकते हैं।
        </div>
      </div>

      <!-- Chrome Gemini Footnote (Part C6.6) -->
      <div class="chrome-gemini-hint" style="font-size:10px; color:rgba(255,255,255,0.45); text-align:center; padding:2px 8px; overflow-wrap:anywhere;">
        दूसरा तरीका: Chrome के ऊपरी Ask Gemini बटन से भी पूछ सकते हैं
      </div>

      <!-- Input Row -->
      <div class="gemini-input-row" style="padding:8px 12px; display:flex; gap:6px; border-top:1px solid var(--border-glass);">
        <input type="text" class="gemini-input" id="geminiChatInput" placeholder="AI से पूछें (Ask AI Assistant)..." style="flex:1; padding:10px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.3); color:#fff; font-size:14px;" />
        <button class="header-btn" id="btnGeminiSend" style="background: var(--primary-accent); color: #000; font-weight: 700; padding:0 16px; border-radius:8px;">भेजें</button>
      </div>

      <!-- Minimized Restore Bar (hidden by default) -->
      <div class="gemini-minimized-bar hidden" id="geminiMinimizedBar" style="padding:8px 12px; display:flex; align-items:center; justify-content:space-between; background:var(--bg-surface-elevated); border-radius:8px; cursor:pointer;">
        <span style="font-weight:700; font-size:13px; color:var(--primary-accent);">AI सहायक (Teaching Assistant)</span>
        <button class="header-btn" id="btnRestorePanel" style="padding:2px 8px; font-size:12px;">खोलें</button>
      </div>
    `;

    this.messagesContainer = this.panelEl.querySelector('#geminiMessages') as HTMLElement;
    this.inputEl = this.panelEl.querySelector('#geminiChatInput') as HTMLInputElement;
    this.modelLabelEl = this.panelEl.querySelector('#aiActiveModelLabel');
    this.usageMeterEl = this.panelEl.querySelector('#aiUsageMeter');
  }

  private applyState(): void {
    const el = this.panelEl;
    el.style.fontSize = `${this.state.fontSize}px`;

    // Reset styles
    el.classList.remove('dock-right', 'dock-left', 'dock-bottom', 'dock-floating', 'maximized', 'minimized');

    if (this.state.isMinimized) {
      el.classList.add('minimized');
      el.style.height = 'auto';
      el.style.width = '240px';
      el.style.top = 'auto';
      el.style.bottom = '16px';
      el.style.right = '16px';
      el.style.left = 'auto';
      return;
    }

    if (this.state.isMaximized) {
      el.classList.add('maximized');
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '100vw';
      el.style.height = '100vh';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      return;
    }

    switch (this.state.dock) {
      case 'left':
        el.classList.add('dock-left');
        el.style.top = '0';
        el.style.left = '0';
        el.style.bottom = '0';
        el.style.right = 'auto';
        el.style.width = `${Math.min(this.state.width, window.innerWidth * 0.8)}px`;
        el.style.height = '100vh';
        break;

      case 'bottom':
        el.classList.add('dock-bottom');
        el.style.bottom = '0';
        el.style.left = '0';
        el.style.right = '0';
        el.style.top = 'auto';
        el.style.width = '100vw';
        el.style.height = `${Math.max(240, Math.min(this.state.height, window.innerHeight * 0.7))}px`;
        break;

      case 'floating':
        el.classList.add('dock-floating');
        el.style.top = `${this.state.top ?? 80}px`;
        el.style.left = `${this.state.left ?? (window.innerWidth - this.state.width - 40)}px`;
        el.style.width = `${Math.min(this.state.width, window.innerWidth * 0.8)}px`;
        el.style.height = `${Math.min(this.state.height, window.innerHeight * 0.85)}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        break;

      case 'right':
      default:
        el.classList.add('dock-right');
        el.style.top = '0';
        el.style.right = '0';
        el.style.bottom = '0';
        el.style.left = 'auto';
        el.style.width = `${Math.min(this.state.width, window.innerWidth * 0.8)}px`;
        el.style.height = '100vh';
        break;
    }
  }

  private bindEvents(): void {
    // Close / Minimize / Maximize
    this.panelEl.querySelector('#btnGeminiClose')?.addEventListener('click', () => this.close());
    this.panelEl.querySelector('#btnMinimize')?.addEventListener('click', () => this.toggleMinimize());
    this.panelEl.querySelector('#btnMaximize')?.addEventListener('click', () => this.toggleMaximize());
    this.panelEl.querySelector('#btnRestorePanel')?.addEventListener('click', () => this.toggleMinimize());

    // Font size controls
    this.panelEl.querySelector('#btnFontInc')?.addEventListener('click', () => {
      if (this.state.fontSize < 22) {
        this.state.fontSize += 2;
        this.applyState();
        this.saveState();
      }
    });

    this.panelEl.querySelector('#btnFontDec')?.addEventListener('click', () => {
      if (this.state.fontSize > 12) {
        this.state.fontSize -= 2;
        this.applyState();
        this.saveState();
      }
    });

    // Dock toggle button
    this.panelEl.querySelector('#btnDockCycle')?.addEventListener('click', () => {
      const modes: PanelDockMode[] = ['right', 'left', 'bottom', 'floating'];
      const nextIdx = (modes.indexOf(this.state.dock) + 1) % modes.length;
      this.state.dock = modes[nextIdx];
      this.applyState();
      this.saveState();
    });

    // Chat sending
    this.panelEl.querySelector('#btnGeminiSend')?.addEventListener('click', () => this.sendMessage());
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // Explain Slide button
    this.panelEl.querySelector('#btnExplainSlide')?.addEventListener('click', () => this.explainCurrentSlide());

    // Quick chips
    const chipBtns = this.panelEl.querySelectorAll('.quick-chip');
    chipBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const prompt = (e.currentTarget as HTMLElement).getAttribute('data-prompt') || '';
        this.inputEl.value = prompt;
        this.sendMessage();
      });
    });

    // Esc key handler
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && store.getState().isGeminiOpen) {
        this.close();
      }
    });

    // Global toggle event
    window.addEventListener('toggle-gemini', () => this.toggle());

    // Setup resize handles
    this.setupResizeListeners();
  }

  private setupResizeListeners(): void {
    const handles = this.panelEl.querySelectorAll('.panel-resize-handle');
    handles.forEach((handle) => {
      handle.addEventListener('pointerdown', (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        this.isDragging = true;
        this.activeHandle = (handle as HTMLElement).dataset.handle || 'left';
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.initialWidth = this.panelEl.offsetWidth;
        this.initialHeight = this.panelEl.offsetHeight;
        this.initialLeft = this.panelEl.offsetLeft;
        this.initialTop = this.panelEl.offsetTop;

        (handle as HTMLElement).setPointerCapture(e.pointerId);

        const onPointerMove = (moveEv: PointerEvent) => {
          if (!this.isDragging) return;
          const dx = moveEv.clientX - this.dragStartX;
          const dy = moveEv.clientY - this.dragStartY;

          const minW = 280;
          const maxW = Math.floor(window.innerWidth * 0.85);
          const minH = 240;
          const maxH = window.innerHeight;

          if (this.state.dock === 'right' || this.activeHandle === 'left') {
            const newW = Math.max(minW, Math.min(maxW, this.initialWidth - dx));
            this.state.width = newW;
            this.panelEl.style.width = `${newW}px`;
          } else if (this.state.dock === 'left' || this.activeHandle === 'right') {
            const newW = Math.max(minW, Math.min(maxW, this.initialWidth + dx));
            this.state.width = newW;
            this.panelEl.style.width = `${newW}px`;
          } else if (this.state.dock === 'bottom' || this.activeHandle === 'top') {
            const newH = Math.max(minH, Math.min(maxH, this.initialHeight - dy));
            this.state.height = newH;
            this.panelEl.style.height = `${newH}px`;
          } else if (this.state.dock === 'floating') {
            if (this.activeHandle?.includes('left')) {
              const newW = Math.max(minW, Math.min(maxW, this.initialWidth - dx));
              this.state.width = newW;
              this.state.left = this.initialLeft + dx;
              this.panelEl.style.width = `${newW}px`;
              this.panelEl.style.left = `${this.state.left}px`;
            }
            if (this.activeHandle?.includes('bottom')) {
              const newH = Math.max(minH, Math.min(maxH, this.initialHeight + dy));
              this.state.height = newH;
              this.panelEl.style.height = `${newH}px`;
            }
          }
        };

        const onPointerUp = (upEv: PointerEvent) => {
          this.isDragging = false;
          this.activeHandle = null;
          try {
            (handle as HTMLElement).releasePointerCapture(upEv.pointerId);
          } catch {}
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          this.saveState();
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
    });
  }

  toggleMaximize(): void {
    this.state.isMaximized = !this.state.isMaximized;
    this.state.isMinimized = false;
    this.applyState();
  }

  toggleMinimize(): void {
    this.state.isMinimized = !this.state.isMinimized;
    this.state.isMaximized = false;
    this.applyState();

    const minBar = this.panelEl.querySelector('#geminiMinimizedBar');
    const header = this.panelEl.querySelector('.gemini-header');
    const msgs = this.panelEl.querySelector('#geminiMessages');
    const inputRow = this.panelEl.querySelector('.gemini-input-row');
    const chips = this.panelEl.querySelector('#quickActionChips');
    const visionBtn = this.panelEl.querySelector('#btnExplainSlide');
    const hint = this.panelEl.querySelector('.chrome-gemini-hint');

    if (this.state.isMinimized) {
      minBar?.classList.remove('hidden');
      header?.classList.add('hidden');
      msgs?.classList.add('hidden');
      inputRow?.classList.add('hidden');
      chips?.classList.add('hidden');
      visionBtn?.classList.add('hidden');
      hint?.classList.add('hidden');
    } else {
      minBar?.classList.add('hidden');
      header?.classList.remove('hidden');
      msgs?.classList.remove('hidden');
      inputRow?.classList.remove('hidden');
      chips?.classList.remove('hidden');
      visionBtn?.classList.remove('hidden');
      hint?.classList.remove('hidden');
    }
  }

  open(): void {
    store.setState({ isGeminiOpen: true });
    this.panelEl.classList.remove('hidden');
    this.inputEl?.focus();
    this.updateUsageMeter();

    if (!keyVault.hasAnyKey()) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message: 'कोई AI कुंजी सेट नहीं है। कृपया सेटिंग्स → AI में अपनी API कुंजी जोड़ें।',
            isError: true
          }
        })
      );
    }
  }

  close(): void {
    store.setState({ isGeminiOpen: false });
    this.panelEl.classList.add('hidden');
    aiRouter.cancelCurrent();
  }

  toggle(): void {
    if (store.getState().isGeminiOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private updateUsageMeter(): void {
    const stats = aiRouter.getUsageStats();
    if (this.usageMeterEl) {
      this.usageMeterEl.textContent = `कॉल: ${stats.callsToday} आज • ~${stats.totalTokensToday} टोकन`;
    }
    if (this.modelLabelEl) {
      this.modelLabelEl.textContent = `${stats.currentProvider} • ${stats.currentModel}`;
    }
  }

  private async sendMessage(isBetterAnswer = false): Promise<void> {
    const text = isBetterAnswer ? this.lastUserQuestion : this.inputEl.value.trim();
    if (!text || this.isProcessing) return;

    if (!keyVault.hasAnyKey()) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message: 'कृपया सेटिंग्स → AI में अपनी API Key दर्ज करें।',
            isError: true
          }
        })
      );
      return;
    }

    if (!isBetterAnswer) {
      this.lastUserQuestion = text;
      this.appendMessage('user', text);
      this.history.push({ role: 'user', text });
      this.inputEl.value = '';
    }

    this.isProcessing = true;
    const sendBtn = this.panelEl.querySelector('#btnGeminiSend') as HTMLButtonElement | null;
    if (sendBtn) sendBtn.disabled = true;

    const thinkingBubble = this.appendMessage(
      'assistant',
      isBetterAnswer ? 'उच्च-गुणवत्ता मॉडल से उत्तर तैयार हो रहा है... (Better answer generating...)' : 'विचार कर रहा हूँ... (Thinking...)'
    );

    try {
      // ECON: Chat history trimming: last 4 turns / 1500 tokens budget (Part C2.4)
      const trimmedMessages = this.getTrimmedChatHistory();

      // Extract slide text context for caching and relevancy
      const slideText = this.getSlideText();

      const result = await aiRouter.run(
        'chat',
        { messages: trimmedMessages },
        {
          betterAnswer: isBetterAnswer,
          slideTextContext: slideText
        }
      );

      this.updateBubbleWithResult(thinkingBubble, result, text);
      this.history.push({
        role: 'assistant',
        text: result.text,
        model: result.model,
        provider: result.provider,
        cached: result.cached
      });

      this.updateUsageMeter();
    } catch (err: any) {
      this.updateBubbleWithError(thinkingBubble, err);
    } finally {
      this.isProcessing = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /**
   * ECON: Text before pixels for Explain Current Slide (Part C2.3)
   * If PDF text layer exists with > 50 chars, send text only (zero image tokens).
   * Otherwise downscale canvas to <= 1024px JPEG 0.8.
   */
  private async explainCurrentSlide(): Promise<void> {
    if (this.isProcessing) return;

    if (!keyVault.hasAnyKey()) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message: 'कृपया सेटिंग्स → AI में अपनी API Key दर्ज करें।',
            isError: true
          }
        })
      );
      return;
    }

    const slideText = this.getSlideText();
    const hasSufficientText = slideText.length >= 50;

    this.appendMessage('user', '📸 [स्लाइड विश्लेषण का अनुरोध किया]');
    this.isProcessing = true;
    const sendBtn = this.panelEl.querySelector('#btnGeminiSend') as HTMLButtonElement | null;
    if (sendBtn) sendBtn.disabled = true;

    const thinkingBubble = this.appendMessage('assistant', 'स्लाइड का विश्लेषण हो रहा है... (Analyzing slide...)');

    try {
      let result: AIRunResult;

      if (hasSufficientText) {
        // Text-First path: Send extracted text layer, ZERO image tokens!
        const prompt = `कृपया इस स्लाइड की सामग्री, मुख्य बिंदु और अवधारणाओं की व्याख्या सरल हिंदी में करें:\n\n${slideText}`;
        result = await aiRouter.run('chat', prompt, { slideTextContext: slideText });
      } else {
        // Pixel fallback: Downscale slide to <= 1024px on long side and JPEG quality 0.8
        const jpegBase64 = this.captureDownscaledSlideJpeg();
        const prompt =
          'कृपया इस स्लाइड की सामग्री और महत्वपूर्ण अवधारणाओं की व्याख्या सरल हिंदी में करें ताकि छात्रों को आसानी से समझ आ सके।';
        result = await aiRouter.run('slide-explain', {
          image: jpegBase64,
          prompt,
          mimeType: 'image/jpeg'
        });
      }

      this.updateBubbleWithResult(thinkingBubble, result, 'स्लाइड विश्लेषण');
      this.history.push({
        role: 'assistant',
        text: result.text,
        model: result.model,
        provider: result.provider,
        cached: result.cached
      });

      this.updateUsageMeter();
    } catch (err: any) {
      this.updateBubbleWithError(thinkingBubble, err);
    } finally {
      this.isProcessing = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /**
   * Extracts text from PDF textLayer spans in DOM
   */
  private getSlideText(): string {
    const textLayer = document.querySelector('.textLayer');
    if (!textLayer) return '';

    const spans = textLayer.querySelectorAll('span');
    const lines: string[] = [];
    spans.forEach((s) => {
      const t = (s.textContent || '').trim();
      if (t) lines.push(t);
    });

    const combined = lines.join(' ');
    // Trim to 1500 characters
    return combined.slice(0, 1500);
  }

  /**
   * Captures downscaled JPEG image (max 1024px, quality 0.8) per Part C2.3
   */
  private captureDownscaledSlideJpeg(): string {
    const slideCanvas = layerManager.slideCanvas;
    const maxSide = 1024;
    let w = slideCanvas.width || 1920;
    let h = slideCanvas.height || 1080;

    if (w > maxSide || h > maxSide) {
      if (w >= h) {
        h = Math.round((h * maxSide) / w);
        w = maxSide;
      } else {
        w = Math.round((w * maxSide) / h);
        h = maxSide;
      }
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      ctx.drawImage(slideCanvas, 0, 0, w, h);
    }

    const dataUrl = offscreen.toDataURL('image/jpeg', 0.8);
    return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
  }

  /**
   * ECON: Trim chat history to last 4 turns / 1500 tokens budget (Part C2.4)
   * Earlier assistant answers truncated to first 200 characters.
   */
  private getTrimmedChatHistory(): { role: 'user' | 'assistant'; content: string }[] {
    const recent = this.history.slice(-4);
    return recent.map((item, index) => {
      let content = item.text;
      // Earlier assistant answers send first 200 characters
      if (item.role === 'assistant' && index < recent.length - 1) {
        content = content.slice(0, 200);
      }
      return {
        role: item.role,
        content
      };
    });
  }

  private appendMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role === 'assistant' ? 'model' : 'user'}`;
    bubble.style.overflowWrap = 'anywhere';
    bubble.style.wordBreak = 'break-word';
    bubble.textContent = text;
    this.messagesContainer.appendChild(bubble);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    return bubble;
  }

  private updateBubbleWithResult(bubble: HTMLElement, result: AIRunResult, userPrompt: string): void {
    bubble.innerHTML = '';

    // Model and cached badge
    const badgeRow = document.createElement('div');
    badgeRow.style.display = 'flex';
    badgeRow.style.alignItems = 'center';
    badgeRow.style.gap = '6px';
    badgeRow.style.fontSize = '11px';
    badgeRow.style.color = 'rgba(255,255,255,0.6)';
    badgeRow.style.marginBottom = '6px';

    const modelBadge = document.createElement('span');
    modelBadge.textContent = `${result.provider} • ${result.model}`;
    badgeRow.appendChild(modelBadge);

    if (result.cached) {
      const cacheBadge = document.createElement('span');
      cacheBadge.textContent = '✓ cached';
      cacheBadge.style.color = '#10b981';
      cacheBadge.style.fontWeight = '700';
      badgeRow.appendChild(cacheBadge);
    }
    bubble.appendChild(badgeRow);

    // Markdown content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'markdown-content';
    contentDiv.innerHTML = this.renderMarkdown(result.text);
    bubble.appendChild(contentDiv);

    // Message actions row
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.flexWrap = 'wrap';
    actionRow.style.gap = '6px';
    actionRow.style.marginTop = '8px';
    actionRow.style.borderTop = '1px solid rgba(255,255,255,0.08)';
    actionRow.style.paddingTop = '6px';

    // Copy Button
    const btnCopy = document.createElement('button');
    btnCopy.className = 'header-btn';
    btnCopy.style.fontSize = '11px';
    btnCopy.style.padding = '3px 8px';
    btnCopy.innerHTML = '📋 कॉपी';
    btnCopy.title = 'उत्तर कॉपी करें (Copy to clipboard)';
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(result.text);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: '✓ उत्तर क्लिपबोर्ड पर कॉपी हो गया (Copied to clipboard)' }
        })
      );
    };
    actionRow.appendChild(btnCopy);

    // Put on Slide Button
    const btnPutOnSlide = document.createElement('button');
    btnPutOnSlide.className = 'header-btn';
    btnPutOnSlide.style.fontSize = '11px';
    btnPutOnSlide.style.padding = '3px 8px';
    btnPutOnSlide.innerHTML = '✍️ स्लाइड पर लिखें';
    btnPutOnSlide.title = 'स्लाइड पर टेक्स्ट ऑब्जेक्ट बनाएं (Put on slide as text)';
    btnPutOnSlide.onclick = () => {
      this.putAnswerOnSlide(result.text);
    };
    actionRow.appendChild(btnPutOnSlide);

    // Better Answer Button (Part C1.4)
    const btnBetter = document.createElement('button');
    btnBetter.className = 'header-btn';
    btnBetter.style.fontSize = '11px';
    btnBetter.style.padding = '3px 8px';
    btnBetter.style.color = 'var(--primary-accent)';
    btnBetter.innerHTML = '⭐ बेहतर जवाब (Better answer)';
    btnBetter.title = 'अगले सक्षम मॉडल से दोबारा पूछें';
    btnBetter.onclick = () => {
      this.sendMessage(true);
    };
    actionRow.appendChild(btnBetter);

    bubble.appendChild(actionRow);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * ECON: Friendly error card rendering per Part C4
   * Short Hindi/English message, no URLs, no JSON, collapsible Details expander.
   */
  private updateBubbleWithError(bubble: HTMLElement, error: any): void {
    bubble.innerHTML = '';
    const friendly: FriendlyErrorResult = error.friendly || quotaManager.formatFriendlyError(error);

    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '6px';

    const hindiMsg = document.createElement('div');
    hindiMsg.style.fontWeight = '600';
    hindiMsg.style.color = '#ef4444';
    hindiMsg.textContent = `⚠️ ${friendly.friendlyHindi}`;
    card.appendChild(hindiMsg);

    const engMsg = document.createElement('div');
    engMsg.style.fontSize = '12px';
    engMsg.style.color = 'rgba(255,255,255,0.7)';
    engMsg.textContent = friendly.friendlyEnglish;
    card.appendChild(engMsg);

    // Technical details expander
    if (friendly.technicalDetails) {
      const details = document.createElement('details');
      details.style.marginTop = '6px';
      details.style.fontSize = '11px';
      details.style.color = 'rgba(255,255,255,0.5)';

      const summary = document.createElement('summary');
      summary.style.cursor = 'pointer';
      summary.textContent = 'विवरण देखें / Technical Details';
      details.appendChild(summary);

      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.overflowWrap = 'anywhere';
      pre.style.wordBreak = 'break-word';
      pre.style.background = 'rgba(0,0,0,0.3)';
      pre.style.padding = '6px';
      pre.style.borderRadius = '4px';
      pre.style.marginTop = '4px';
      pre.textContent = friendly.technicalDetails;
      details.appendChild(pre);

      card.appendChild(details);
    }

    bubble.appendChild(card);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Creates an editable text object on current slide canvas (Part C6.2)
   */
  private putAnswerOnSlide(text: string): void {
    const cleanText = text.replace(/[*_#`]/g, '').trim().slice(0, 300);
    const stroke: Stroke = {
      id: `text-${Date.now()}`,
      tool: 'text',
      color: store.getState().activeColor || '#f59e0b',
      size: 26,
      alpha: 1,
      points: [{ x: 100, y: 200 }],
      text: cleanText,
      box: { x: 100, y: 200, width: 800, height: 200 },
      timestamp: Date.now()
    };

    annotationStore.addStroke(stroke);
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { message: '✓ उत्तर स्लाइड पर जोड़ा गया (Added to slide as text object)' }
      })
    );
  }

  /**
   * Lightweight safe Markdown parser (bold, bullet lists, code, headers)
   */
  private renderMarkdown(md: string): string {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings ###
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin:6px 0; font-size:15px; color:var(--primary-accent);">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin:8px 0; font-size:16px; color:var(--primary-accent);">$1</h3>');

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:4px; font-size:12px;">$1</code>');

    // Bullet lists
    html = html.replace(/^\s*[\*\-]\s+(.*)$/gim, '<li style="margin-left:16px;">$1</li>');

    // Line breaks
    html = html.replace(/\n\n/g, '<br/><br/>');

    return html;
  }
}

export const geminiPanel = new GeminiPanel();
