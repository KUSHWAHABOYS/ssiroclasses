// MIC-AI: Voice Navigation & Command Service with explicit MicController integration
// ECON: Local Grammar First, Extended Ordinals (1-50), Filler Stripping, Icon-Only Feedback (Part E)
import { store } from '../state/store';
import { navigationController } from '../presenter/navigation';
import { annotationStore } from '../draw/annotationStore';
import { blackboardStudio } from '../board/board';
import { fullscreenService } from '../core/fullscreen';
import { zoomController } from '../zoom/zoomController';
import { micController } from './micController';
import { voiceWriteManager } from './writeCommand';
import { FILLER_WORDS, NUMBER_WORDS, COMMANDS_REGISTRY, VoiceCommandDef } from './commandsDict';

export class VoiceCommandService {
  private recognition: any = null;
  private isListening = false;
  private shouldRestart = false;
  private lastNavigationTime = 0;

  init(): void {
    console.log('🎙️ VoiceCommandService initialized (mic is OFF by default, local grammar active).');

    // Trigger events for speech-to-text / voice commands
    window.addEventListener('voice-command', (e: any) => {
      const phrase = e.detail?.phrase || e.detail?.command || (typeof e.detail === 'string' ? e.detail : '');
      if (phrase) {
        this.processVoiceCommand(phrase, true);
      }
    });

    window.addEventListener('app-voice-command', (e: any) => {
      const phrase = e.detail?.phrase || e.detail?.command || (typeof e.detail === 'string' ? e.detail : '');
      if (phrase) {
        this.processVoiceCommand(phrase, true);
      }
    });
  }

  startListening(): Promise<boolean> {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: 'इस ब्राउज़र में स्पीच रिकॉग्निशन समर्थित नहीं है / Web Speech API not supported', isError: true }
        })
      );
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      try {
        if (this.recognition) {
          try {
            this.recognition.abort();
          } catch {}
          this.recognition = null;
        }

        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true; // Instant recognition during conversational teaching
        rec.lang = store.getState().settings.voiceLang || 'hi-IN';

        rec.onaudiostart = () => micController.setInputLevel(1);
        rec.onsoundstart = () => micController.setInputLevel(2);
        rec.onspeechstart = () => micController.setInputLevel(3);
        rec.onspeechend = () => micController.setInputLevel(1);
        rec.onsoundend = () => micController.setInputLevel(0);

        rec.onresult = (event: any) => {
          micController.setInputLevel(2);
          micController.reportActivity();
          for (let i = event.resultIndex || 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res && res[0]) {
              const transcript = res[0].transcript.trim();
              if (transcript) {
                this.processVoiceCommand(transcript);
              }
            }
          }
          setTimeout(() => micController.setInputLevel(0), 400);
        };

        rec.onerror = (e: any) => {
          micController.setInputLevel(0);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            this.shouldRestart = false;
            this.stopListening();
            micController.reportError('माइक अनुमति अवरुद्ध है — सेटिंग्स में अनुमति दें (Microphone blocked)');
            resolve(false);
          } else if (e.error !== 'no-speech') {
            micController.reportActivity();
          }
        };

        rec.onend = () => {
          micController.setInputLevel(0);
          if (this.shouldRestart && this.isListening && micController.getState() === 'listening') {
            try {
              rec.start();
            } catch (err) {
              console.warn('Speech restart error:', err);
            }
          }
        };

        this.recognition = rec;
        this.shouldRestart = true;
        this.isListening = true;
        rec.start();
        resolve(true);
      } catch (err: any) {
        console.warn('Speech recognition start failed:', err);
        this.isListening = false;
        resolve(false);
      }
    });
  }

  stopListening(): void {
    this.shouldRestart = false;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.onaudiostart = null;
        this.recognition.onsoundstart = null;
        this.recognition.onspeechstart = null;
        this.recognition.onspeechend = null;
        this.recognition.onsoundend = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
  }

  /**
   * ECON: Strips conversational fillers and normalizes text
   */
  private cleanTranscript(phrase: string): string {
    let clean = phrase.toLowerCase().replace(/[।.,!?]/g, ' ').trim();
    for (const f of FILLER_WORDS) {
      clean = clean.split(f).join(' ');
    }
    return clean.replace(/\s+/g, ' ').trim();
  }

  /**
   * Feedback suppressed per user request: "कोई गंदा सा पॉपअप नहीं आना चाहिए"
   */
  private showIconFeedback(_icon: string): void {
    // Zero popups over PPT presentation!
  }

  public processVoiceCommand(phrase: string, force = false): boolean {
    if (!force && micController.getState() !== 'listening') return false;

    // 1. Check Voice Write Command first (pure local grammar + anchor logic)
    const writeCmd = voiceWriteManager.parseCommand(phrase);
    if (writeCmd) {
      voiceWriteManager.execute(writeCmd);
      this.showIconFeedback('✍️');
      return true;
    }

    const clean = this.cleanTranscript(phrase);
    if (!clean) return false;

    // 2. Stop listening command
    if (/stop\s*listening|माइक\s*बंद|माइक\s*ऑफ|म्यूट|chup\s*raho/i.test(clean)) {
      this.showIconFeedback('🎙️✕');
      micController.turnOff();
      return true;
    }

    const state = store.getState();

    // Welcome state restrictions
    if (state.appState === 'welcome') {
      if (/board|ब्लैकबोर्ड|बोर्ड/i.test(clean)) {
        this.showIconFeedback('📋');
        blackboardStudio.toggleBoard();
        return true;
      }
      if (/open|खोलो|खोलें/i.test(clean)) {
        this.showIconFeedback('📂');
        const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
        fileInput?.click();
        return true;
      }
      if (/fullscreen|फुलस्क्रीन|पूर्ण स्क्रीन/i.test(clean)) {
        this.showIconFeedback('⛶');
        fullscreenService.toggleZen();
        return true;
      }
      return false; // ignore other commands silently
    }

    const testText = `${phrase} ${clean}`.toLowerCase();

    // 3. Navigation: Slide & Page Next
    // Conversational Hindi teacher phrases:
    // "चलिए अब आगे बढ़ते हैं नेक्स्ट स्लाइड पर", "चलिए आगे बढ़ते हैं", "आगे बढ़ते हैं", "नेक्स्ट स्लाइड पर",
    // "अगली स्लाइड पर", "अगली स्लाइड", "अगला पेज", "next slide", "slide next", etc.
    const isNext = 
      /चलिए\s*(अब\s*)?आगे\s*(बढ़ते|चलते|बढ़ें|चलें)/i.test(testText) ||
      /आगे\s*(बढ़ते\s*हैं|चलते\s*हैं|बढ़ें|चलें|बढ़ो|चलो|badho|chalo)/i.test(testText) ||
      /(नेक्स्ट|अगली|अगला|next)\s*(स्लाइड|पेज|slide|page)(\s*पर)?/i.test(testText) ||
      /(स्लाइड|पेज|slide|page)\s*(नेक्स्ट|अगली|अगला|आगे|next|aage)/i.test(testText) ||
      /^(next|अगला|अगली|आगे|नेक्स्ट|agla|agli|aage)$/i.test(testText) ||
      /\b(next\s*slide|slide\s*next|next\s*page|page\s*next|forward)\b/i.test(testText);

    if (isNext) {
      const now = Date.now();
      if (now - this.lastNavigationTime > 1200) {
        this.lastNavigationTime = now;
        this.executeAction('next', '➡️');
      }
      return true;
    }

    // 4. Navigation: Slide & Page Back
    // Conversational Hindi teacher phrases:
    // "पिछली स्लाइड पर जो देखा", "पिछली स्लाइड पर", "वापस पिछली स्लाइड", "पीछे वाली स्लाइड", "पिछली स्लाइड",
    // "पिछला पेज", "पीछे चलते हैं", "पीछे चलो", "वापस चलो", "previous slide", "slide back", etc.
    const isPrev = 
      /(पिछली|पिछला|पिछले|previous|prev|back|pichla|pichli)\s*(स्लाइड|पेज|slide|page)(\s*पर)?(\s*जो\s*देखा)?/i.test(testText) ||
      /(स्लाइड|पेज|slide|page)\s*(पिछली|पिछला|पिछले|पीछे|back|previous|piche)/i.test(testText) ||
      /(वापस\s*(पिछली|पीछे|चलो|जाओ))/i.test(testText) ||
      /(पीछे\s*(वाली\s*स्लाइड|चलते\s*हैं|चलें|चलो|जाओ|लें|लो|chalo))/i.test(testText) ||
      /^(back|previous|prev|पिछला|पिछली|पीछे|बैक|प्रीवियस|pichla|pichli|peeche|piche)$/i.test(testText) ||
      /\b(previous\s*slide|slide\s*previous|prev\s*slide|slide\s*prev|back\s*slide|slide\s*back|back\s*page|page\s*back)\b/i.test(testText);

    if (isPrev) {
      const now = Date.now();
      if (now - this.lastNavigationTime > 1200) {
        this.lastNavigationTime = now;
        this.executeAction('prev', '⬅️');
      }
      return true;
    }

    // 5. Navigation: Slide jumps with ordinals / numbers up to 50
    // Examples: "तीसरी स्लाइड पर चलो", "स्लाइड पाँच", "slide 7", "पांचवी स्लाइड"
    const slideJumpMatch = clean.match(
      /(?:स्लाइड|slide|page|पृष्ठ|नंबर|number)?\s*([^\s]+)\s*(?:स्लाइड|slide|page|पृष्ठ)?\s*(?:पर चलो|खोलो|दिखाओ|par chalo)?/i
    );

    // Check tokens for number words / ordinals
    const tokens = clean.split(/\s+/);
    for (const tok of tokens) {
      if (NUMBER_WORDS[tok] !== undefined) {
        const pageNum = NUMBER_WORDS[tok];
        if (clean.includes('स्लाइड') || clean.includes('slide') || clean.includes('page') || clean.includes('चलो')) {
          this.showIconFeedback(`📄 ${pageNum}`);
          navigationController.goToPage(pageNum);
          return true;
        }
      }
    }

    // Direct digit check (e.g. "slide 12" or "12")
    const digitMatch = clean.match(/\b([1-9]|[1-4][0-9]|50)\b/);
    if (digitMatch && (clean.includes('slide') || clean.includes('स्लाइड') || clean.includes('page'))) {
      const num = parseInt(digitMatch[1], 10);
      this.showIconFeedback(`📄 ${num}`);
      navigationController.goToPage(num);
      return true;
    }

    // 6. Match against COMMANDS_REGISTRY
    for (const cmd of COMMANDS_REGISTRY) {
      for (const syn of cmd.synonyms) {
        if (clean === syn || clean.includes(syn)) {
          this.executeAction(cmd.action, cmd.icon);
          return true;
        }
      }
    }

    // Unmatched speech ignored silently per Part E
    return false;
  }

  private executeAction(action: string, icon: string): void {
    this.showIconFeedback(icon);
    window.dispatchEvent(
      new CustomEvent('voice-command-executed', {
        detail: { action, icon }
      })
    );

    switch (action) {
      case 'next':
        navigationController.nextPage();
        break;

      case 'prev':
        navigationController.prevPage();
        break;

      case 'first_slide':
        navigationController.goToPage(1);
        break;

      case 'last_slide':
        navigationController.goToPage(store.getState().totalPages || 1);
        break;

      case 'pen':
        store.setState({ activeTool: 'pen' });
        break;

      case 'marker':
        store.setState({ activeTool: 'highlighter' });
        break;

      case 'eraser':
        store.setState({ activeTool: 'eraser' });
        break;

      case 'clear':
        annotationStore.clearAll();
        break;

      case 'undo':
        annotationStore.undo();
        break;

      case 'board':
        blackboardStudio.toggleBoard();
        break;

      case 'magnifier':
        store.setState({ activeTool: 'magnifier' });
        break;

      case 'zoom_in':
        zoomController.animateZoom(zoomController.getScale() * 1.5);
        break;

      case 'zoom_out':
        zoomController.animateZoom(zoomController.getScale() / 1.5);
        break;

      case 'zoom_reset':
        zoomController.resetZoom();
        break;

      case 'spotlight':
        const cur = store.getState().settings.magnifierSpotlight;
        store.updateSettings({ magnifierSpotlight: !cur });
        break;

      case 'fullscreen':
        fullscreenService.toggleZen();
        break;

      case 'close':
        const s = store.getState();
        if (s.isBoardMode) blackboardStudio.closeBoard();
        window.dispatchEvent(new CustomEvent('close-all-overlays'));
        break;

      case 'mic_off':
        micController.turnOff();
        break;

      case 'color_red':
        store.setState({ activeColor: '#ef4444' });
        break;

      case 'color_blue':
        store.setState({ activeColor: '#3b82f6' });
        break;

      case 'color_green':
        store.setState({ activeColor: '#10b981' });
        break;

      case 'color_yellow':
        store.setState({ activeColor: '#f59e0b' });
        break;

      case 'color_white':
        store.setState({ activeColor: '#ffffff' });
        break;

      case 'size_thicker':
        store.setState({
          penSize: Math.min(24, store.getState().penSize + 4),
          highlighterWidth: Math.min(64, store.getState().highlighterWidth + 8)
        });
        break;

      case 'size_thinner':
        store.setState({
          penSize: Math.max(2, store.getState().penSize - 2),
          highlighterWidth: Math.max(16, store.getState().highlighterWidth - 8)
        });
        break;
    }
  }
}

export const voiceCommandService = new VoiceCommandService();

if (typeof window !== 'undefined') {
  (window as any).__SMART_STUDIO_VOICE__ = voiceCommandService;
}
