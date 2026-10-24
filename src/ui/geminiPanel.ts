// MIC-AI: Multi-Provider AI Teaching Assistant Panel wired to central aiRouter
import { store } from '../state/store';
import { aiRouter } from '../ai/aiRouter';
import { keyVault } from '../ai/keyVault';
import { layerManager } from '../core/layers';

interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

export class GeminiPanel {
  private panelEl!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private modelLabelEl: HTMLElement | null = null;
  private history: ChatHistoryItem[] = [];
  private isProcessing = false;

  init(): void {
    this.panelEl = document.getElementById('geminiPanel') as HTMLElement;
    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.panelEl.innerHTML = `
      <div class="gemini-header">
        <div class="gemini-title" style="display:flex; align-items:center; gap:8px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>
          <span>AI सहायक (Teaching Assistant)</span>
          <span id="aiActiveModelLabel" style="font-size:11px; font-weight:normal; color:var(--primary-accent); margin-left:6px; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;"></span>
        </div>
        <button class="media-win-btn" id="btnGeminiClose" style="font-size: 16px;">✕</button>
      </div>

      <button class="gemini-vision-action" id="btnExplainSlide">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>यह स्लाइड समझाएं (Explain Slide with Vision)</span>
      </button>

      <div class="gemini-messages" id="geminiMessages">
        <div class="chat-bubble model">
          नमस्ते! मैं डिकोडिंग इंडोलॉजी का AI शिक्षण सहायक हूँ। आप मुझसे इस स्लाइड या किसी भी विषय पर हिंदी या अंग्रेज़ी में सवाल पूछ सकते हैं।
        </div>
      </div>

      <div class="gemini-input-row">
        <input type="text" class="gemini-input" id="geminiChatInput" placeholder="AI से कुछ भी पूछें (Ask AI Assistant)..." />
        <button class="header-btn" id="btnGeminiSend" style="background: var(--primary-accent); color: #000; font-weight: 700;">भेजें</button>
      </div>
    `;

    this.messagesContainer = this.panelEl.querySelector('#geminiMessages') as HTMLElement;
    this.inputEl = this.panelEl.querySelector('#geminiChatInput') as HTMLInputElement;
    this.modelLabelEl = this.panelEl.querySelector('#aiActiveModelLabel');
  }

  private bindEvents(): void {
    this.panelEl.querySelector('#btnGeminiClose')?.addEventListener('click', () => {
      this.close();
    });

    this.panelEl.querySelector('#btnGeminiSend')?.addEventListener('click', () => {
      this.sendMessage();
    });

    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    this.panelEl.querySelector('#btnExplainSlide')?.addEventListener('click', () => {
      this.explainCurrentSlide();
    });

    window.addEventListener('toggle-gemini', () => {
      this.toggle();
    });
  }

  open(): void {
    store.setState({ isGeminiOpen: true });
    this.panelEl.classList.remove('hidden');
    this.inputEl?.focus();

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

  private async sendMessage(): Promise<void> {
    const text = this.inputEl.value.trim();
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

    this.appendMessage('user', text);
    this.history.push({ role: 'user', text });
    this.inputEl.value = '';
    this.isProcessing = true;

    const thinkingBubble = this.appendMessage('model', 'विचार कर रहा हूँ... (Thinking...)');

    try {
      const messages = this.history.map((h) => ({
        role: (h.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: h.text
      }));

      const result = await aiRouter.run('chat', { messages });
      thinkingBubble.textContent = result.text;
      this.history.push({ role: 'model', text: result.text });

      if (this.modelLabelEl) {
        this.modelLabelEl.textContent = `${result.provider} • ${result.model}`;
      }
    } catch (err: any) {
      thinkingBubble.textContent = `त्रुटि (Error): ${err.message}`;
    } finally {
      this.isProcessing = false;
    }
  }

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

    // Capture current slideCanvas as base64 PNG
    const slideCanvas = layerManager.slideCanvas;
    const dataUrl = slideCanvas.toDataURL('image/png');
    const base64Png = dataUrl.replace(/^data:image\/png;base64,/, '');

    const userPrompt =
      'कृपया इस स्लाइड की सामग्री, महत्वपूर्ण अवधारणाओं और ऐतिहासिक/वैज्ञानिक संदर्भ की व्याख्या हिंदी में करें ताकि छात्रों को आसानी से समझ आ सके।';

    this.appendMessage('user', '📸 [स्लाइड विश्लेषण का अनुरोध किया]');
    this.history.push({ role: 'user', text: userPrompt });
    this.isProcessing = true;

    const thinkingBubble = this.appendMessage('model', 'स्लाइड का विश्लेषण हो रहा है... (Analyzing slide image...)');

    try {
      const result = await aiRouter.run('slide-explain', {
        image: base64Png,
        prompt: userPrompt
      });
      thinkingBubble.textContent = result.text;
      this.history.push({ role: 'model', text: result.text });

      if (this.modelLabelEl) {
        this.modelLabelEl.textContent = `${result.provider} • ${result.model}`;
      }
    } catch (err: any) {
      thinkingBubble.textContent = `त्रुटि (Error): ${err.message}`;
    } finally {
      this.isProcessing = false;
    }
  }

  private appendMessage(role: 'user' | 'model', text: string): HTMLElement {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = text;
    this.messagesContainer.appendChild(bubble);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    return bubble;
  }
}

export const geminiPanel = new GeminiPanel();
