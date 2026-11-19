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
  private handledResultIndices = new Set<number>();

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

        this.handledResultIndices.clear();
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
            if (this.handledResultIndices.has(i)) continue;
            const res = event.results[i];
            if (res && res[0]) {
              const transcript = res[0].transcript.trim();
              if (transcript) {
                const executed = this.processVoiceCommand(transcript);
                if (executed) {
                  // Mark this result index as consumed to prevent multiple triggers
                  this.handledResultIndices.add(i);
                }
              }
            }
          }
          if (this.handledResultIndices.size > 100) {
            const arr = Array.from(this.handledResultIndices).slice(-30);
            this.handledResultIndices = new Set(arr);
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
   * Senses specific slide jump targets from spoken phrases (Hindi & English)
   * Handles:
   * - "पहली स्लाइड", "पहला पेज", "first slide"
   * - "पाँचवीं स्लाइड", "पांचवी स्लाइड", "5th slide"
   * - "लास्ट स्लाइड", "आखिरी स्लाइड", "अंतिम स्लाइड", "last slide"
   * - "स्लाइड 15", "पेज 22", "15 नंबर स्लाइड", "45वीं स्लाइड"
   */
  private parseSlideJumpTarget(clean: string, totalPages: number): number | null {
    // 1. First slide
    if (/(पहली|पहला|प्रथम|first|start)\s*(स्लाइड|पेज|slide|page)/i.test(clean) ||
        /^(पहली|पहला|प्रथम|first|start)\s*(स्लाइड|पेज|slide|page)?$/i.test(clean) ||
        /(स्लाइड|पेज|slide|page)\s*(1|एक|first|पहला|पहली)/i.test(clean)) {
      return 1;
    }

    // 2. Last slide
    if (/(लास्ट|आखिरी|आख़िरी|अंतिम|last|final|end)\s*(स्लाइड|पेज|slide|page)/i.test(clean) ||
        /^(लास्ट|आखिरी|आख़िरी|अंतिम|last|final|end)\s*(स्लाइड|पेज|slide|page)?$/i.test(clean) ||
        /(स्लाइड|पेज|slide|page)\s*(लास्ट|आखिरी|आख़िरी|अंतिम|last|final|end)/i.test(clean)) {
      return totalPages;
    }

    // 3. Digit match with slide/page context (e.g. "स्लाइड 15", "पेज 8", "15 नंबर स्लाइड", "5वीं स्लाइड", "slide 25")
    const digitMatch = clean.match(/(?:स्लाइड|slide|page|पेज|पृष्ठ)\s*(?:नंबर\s*)?(\d+)/i) ||
                       clean.match(/(\d+)\s*(?:नंबर\s*)?(?:वीं|वां|th|st|nd|rd)?\s*(?:स्लाइड|slide|page|पेज)/i) ||
                       clean.match(/(?:गो\s*टू|go\s*to)\s*(?:slide\s*|स्लाइड\s*)?(\d+)/i);
    if (digitMatch) {
      const n = parseInt(digitMatch[1], 10);
      if (!isNaN(n) && n >= 1) {
        return Math.max(1, Math.min(n, totalPages));
      }
    }

    // 4. Hindi ordinals and number words
    const ordinalsMap: Record<string, number> = {
      'पहली': 1, 'पहला': 1, 'प्रथम': 1, 'एक': 1, 'first': 1, 'ek': 1,
      'दूसरी': 2, 'दूसरा': 2, 'द्वितीय': 2, 'दो': 2, 'second': 2, 'do': 2,
      'तीसरी': 3, 'तीसरा': 3, 'तृतीय': 3, 'तीन': 3, 'third': 3, 'teen': 3,
      'चौथी': 4, 'चौथा': 4, 'चतुर्थ': 4, 'चार': 4, 'fourth': 4, 'chaar': 4,
      'पांचवीं': 5, 'पाँचवीं': 5, 'पांचवी': 5, 'पाँचवी': 5, 'पांचवा': 5, 'पाँचवा': 5, 'पांच': 5, 'पाँच': 5, 'fifth': 5, 'paanch': 5,
      'छठी': 6, 'छठा': 6, 'छह': 6, 'छः': 6, 'sixth': 6, 'chhah': 6,
      'सातवीं': 7, 'सातवां': 7, 'सात': 7, 'seventh': 7, 'saat': 7,
      'आठवीं': 8, 'आठवां': 8, 'आठ': 8, 'eighth': 8, 'aath': 8,
      'नौवीं': 9, 'नौवां': 9, 'नौ': 9, 'ninth': 9, 'nau': 9,
      'दसवीं': 10, 'दसवां': 10, 'दस': 10, 'tenth': 10, 'das': 10,
      'ग्यारहवीं': 11, 'ग्यारह': 11, 'eleven': 11,
      'बारहवीं': 12, 'बारह': 12, 'twelve': 12,
      'तेरहवीं': 13, 'तेरह': 13, 'thirteen': 13,
      'चौदहवीं': 14, 'चौदह': 14, 'fourteen': 14,
      'पंद्रहवीं': 15, 'पंद्रहवां': 15, 'पंद्रह': 15, 'fifteen': 15,
      'सोलहवीं': 16, 'सोलह': 16, 'sixteen': 16,
      'सत्रहवीं': 17, 'सत्रह': 17, 'seventeen': 17,
      'अठारहवीं': 18, 'अठारह': 18, 'eighteen': 18,
      'उन्नीसवीं': 19, 'उन्नीस': 19, 'nineteen': 19,
      'बीसवीं': 20, 'बीस': 20, 'twenty': 20,
      'पच्चीसवीं': 25, 'पच्चीस': 25,
      'तीसवीं': 30, 'तीस': 30,
      'चालीसवीं': 40, 'चालीस': 40,
      'पचासवीं': 50, 'पचास': 50
    };

    const tokens = clean.split(/\s+/);
    for (const tok of tokens) {
      if (ordinalsMap[tok] !== undefined) {
        if (clean.includes('स्लाइड') || clean.includes('slide') || clean.includes('page') || clean.includes('पेज') || clean.includes('चलो') || clean.includes('खोलो')) {
          return Math.max(1, Math.min(ordinalsMap[tok], totalPages));
        }
      }
    }

    return null;
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

    // 3. Navigation: Direct Slide Jumps ("पहली स्लाइड", "पाँचवीं स्लाइड", "लास्ट स्लाइड", "स्लाइड 15")
    const totalPages = state.totalPages || 1;
    const jumpTarget = this.parseSlideJumpTarget(clean, totalPages);
    if (jumpTarget !== null) {
      const now = Date.now();
      if (now - this.lastNavigationTime > 900) {
        this.lastNavigationTime = now;
        this.showIconFeedback(`📄 ${jumpTarget}`);
        navigationController.goToPage(jumpTarget, 'jump');
      }
      return true;
    }

    // 4. Navigation: Slide & Page Back (Strictly 1 slide back)
    const isPrev = 
      /^(back|previous|prev|पिछला|पिछली|पीछे|बैक|बॅक|बैग|वापस|प्रीवियस|pichla|pichli|peeche|piche|wapas|vapas)$/i.test(clean) ||
      /(पिछली|पिछला|पिछले|previous|prev|back|pichla|pichli|wapas|vapas)\s*(स्लाइड|पेज|slide|page)(\s*पर)?(\s*जो\s*देखा)?/i.test(testText) ||
      /(स्लाइड|पेज|slide|page)\s*(पिछली|पिछला|पिछले|पीछे|back|previous|piche)/i.test(testText) ||
      /(वापस\s*(पिछली|पीछे|चलो|जाओ))/i.test(testText) ||
      /(पीछे\s*(वाली\s*स्लाइड|चलते\s*हैं|चलें|चलो|जाओ|लें|लो|chalo))/i.test(testText) ||
      /\b(previous\s*slide|slide\s*previous|prev\s*slide|slide\s*prev|back\s*slide|slide\s*back|back\s*page|page\s*back)\b/i.test(testText);

    if (isPrev) {
      const now = Date.now();
      if (now - this.lastNavigationTime > 900) {
        this.lastNavigationTime = now;
        this.executeAction('prev', '⬅️');
      }
      return true;
    }

    // 5. Navigation: Slide & Page Next (Strictly 1 slide forward)
    const isNext = 
      /^(next|अगला|अगली|आगे|नेक्स्ट|नेक्सट|नैकस्ट|agla|agli|aage|forward)$/i.test(clean) ||
      /चलिए\s*(अब\s*)?आगे\s*(बढ़ते|चलते|बढ़ें|चलें)/i.test(testText) ||
      /आगे\s*(बढ़ते\s*हैं|चलते\s*हैं|बढ़ें|चलें|बढ़ो|चलो|badho|chalo)/i.test(testText) ||
      /(नेक्स्ट|अगली|अगला|next)\s*(स्लाइड|पेज|slide|page)(\s*पर)?/i.test(testText) ||
      /(स्लाइड|पेज|slide|page)\s*(नेक्स्ट|अगली|अगला|आगे|next|aage)/i.test(testText) ||
      /\b(next\s*slide|slide\s*next|next\s*page|page\s*next|forward)\b/i.test(testText);

    if (isNext) {
      const now = Date.now();
      if (now - this.lastNavigationTime > 900) {
        this.lastNavigationTime = now;
        this.executeAction('next', '➡️');
      }
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
