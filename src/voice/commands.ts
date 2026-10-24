// MIC-AI: Voice Navigation & Command Service with explicit MicController integration
import { store } from '../state/store';
import { navigationController } from '../presenter/navigation';
import { annotationStore } from '../draw/annotationStore';
import { blackboardStudio } from '../board/board';
import { fullscreenService } from '../core/fullscreen';
// SSIRO-UPDATE: Import zoomController for voice zoom commands
import { zoomController } from '../zoom/zoomController';
// MIC-AI: Import micController
import { micController } from './micController';
// INKFIX: Import voiceWriteManager
import { voiceWriteManager } from './writeCommand';

export class VoiceCommandService {
  private recognition: any = null;
  private isListening = false;
  private shouldRestart = false;

  // Number word dictionary for Hindi & English
  private numberWords: Record<string, number> = {
    'one': 1, 'एक': 1, '1': 1,
    'two': 2, 'दो': 2, '2': 2,
    'three': 3, 'तीन': 3, '3': 3,
    'four': 4, 'चार': 4, '4': 4,
    'five': 5, 'पाँच': 5, 'पांच': 5, '5': 5,
    'six': 6, 'छह': 6, 'छः': 6, '6': 6,
    'seven': 7, 'सात': 7, '7': 7,
    'eight': 8, 'आठ': 8, '8': 8,
    'nine': 9, 'नौ': 9, '9': 9,
    'ten': 10, 'दस': 10, '10': 10
  };

  init(): void {
    // MIC-AI: Do NOT start listening automatically on app launch.
    // Mic is strictly off until user explicitly turns it on.
    console.log('🎙️ VoiceCommandService initialized (mic is OFF by default).');
  }

  /**
   * Called only when user explicitly activates the mic
   */
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
        rec.interimResults = false;
        rec.lang = store.getState().settings.voiceLang || 'hi-IN';

        rec.onaudiostart = () => {
          micController.setInputLevel(1);
        };

        rec.onsoundstart = () => {
          micController.setInputLevel(2);
        };

        rec.onspeechstart = () => {
          micController.setInputLevel(3);
        };

        rec.onspeechend = () => {
          micController.setInputLevel(1);
        };

        rec.onsoundend = () => {
          micController.setInputLevel(0);
        };

        rec.onresult = (event: any) => {
          micController.setInputLevel(2);
          micController.reportActivity();
          const last = event.results.length - 1;
          const transcript = event.results[last][0].transcript.trim().toLowerCase();
          this.processVoiceCommand(transcript);
          setTimeout(() => micController.setInputLevel(0), 400);
        };

        rec.onerror = (e: any) => {
          console.warn('Speech recognition error:', e.error);
          micController.setInputLevel(0);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            this.shouldRestart = false;
            this.stopListening();
            micController.reportError('माइक अनुमति अवरुद्ध है — ब्राउज़र/ऐप सेटिंग्स में अनुमति दें (Microphone blocked — allow it in browser/app settings)');
            resolve(false);
          } else if (e.error !== 'no-speech') {
            // Transient error
            micController.reportActivity();
          }
        };

        rec.onend = () => {
          micController.setInputLevel(0);
          // Only restart if micController still wants listening active
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

  /**
   * Truly release the microphone hardware and stop all callbacks
   */
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

  private processVoiceCommand(phrase: string): void {
    // Only process if mic is actively listening
    if (micController.getState() !== 'listening') return;

    // INKFIX: Check Voice Write Command first (Part G: raw spoken command is never toasted or stored)
    const writeCmd = voiceWriteManager.parseCommand(phrase);
    if (writeCmd) {
      voiceWriteManager.execute(writeCmd);
      return;
    }

    console.log('Voice Command received:', phrase);

    // Feedback toast
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { message: `🎙️ आवाज आदेश: "${phrase}"` }
      })
    );

    // MIC-AI: Stop listening voice command ("stop listening / माइक बंद")
    if (/stop\s*listening|माइक\s*बंद|माइक\s*ऑफ|म्यूट/i.test(phrase)) {
      micController.turnOff();
      return;
    }

    // WELCOME-FIX: In welcome state, voice navigation and tools are inert.
    // Only board, open, and fullscreen commands are allowed.
    const state = store.getState();
    if (state.appState === 'welcome') {
      if (/board|ब्लैकबोर्ड|बोर्ड/i.test(phrase)) {
        blackboardStudio.toggleBoard();
        return;
      }
      if (/open|खोलो|खोलें/i.test(phrase)) {
        const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
        fileInput?.click();
        return;
      }
      if (/fullscreen|फुलस्क्रीन|पूर्ण स्क्रीन/i.test(phrase)) {
        fullscreenService.toggleZen();
        return;
      }
      return; // All other voice navigation/drawing commands inert in welcome state
    }

    // Open Deck
    if (/open|खोलो|खोलें/i.test(phrase)) {
      const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
      fileInput?.click();
      return;
    }

    // Next slide
    if (/next|अगला|आगे|नेक्स्ट/i.test(phrase)) {
      navigationController.nextPage();
      return;
    }

    // Previous slide
    if (/back|पीछे|पिछला|बैक/i.test(phrase)) {
      navigationController.prevPage();
      return;
    }

    // Jump to slide (e.g. "slide 3", "स्लाइड पाँच", "page 2")
    const slideMatch = phrase.match(/(?:slide|page|स्लाइड|पृष्ठ)\s*([\w\d]+)/i);
    if (slideMatch && slideMatch[1]) {
      const targetStr = slideMatch[1];
      const parsedNum = this.numberWords[targetStr] || parseInt(targetStr, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        navigationController.goToPage(parsedNum);
        return;
      }
    }

    // Clear ink
    if (/clear|साफ़|साफ|मिटाओ/i.test(phrase)) {
      annotationStore.clearAll();
      return;
    }

    // Blackboard
    if (/board|ब्लैकबोर्ड|बोर्ड/i.test(phrase)) {
      blackboardStudio.toggleBoard();
      return;
    }

    // Close overlays
    if (/close|बंद|हटाओ/i.test(phrase)) {
      const s = store.getState();
      if (s.isBoardMode) blackboardStudio.closeBoard();
      window.dispatchEvent(new CustomEvent('close-all-overlays'));
      return;
    }

    // Fullscreen
    if (/fullscreen|फुलस्क्रीन|पूर्ण स्क्रीन/i.test(phrase)) {
      fullscreenService.toggleZen();
      return;
    }

    // Tools
    if (/pen|पेन/i.test(phrase)) {
      store.setState({ activeTool: 'pen' });
    } else if (/highlighter|marker|हाइलाइटर/i.test(phrase)) {
      store.setState({ activeTool: 'highlighter' });
    } else if (/eraser|रबर|इरेज़र/i.test(phrase)) {
      store.setState({ activeTool: 'eraser' });
    } else if (/magnifier|मैग्नीफ़ायर|मैग्नीफायर|लेंस/i.test(phrase)) {
      // SSIRO-UPDATE: Magnifier Voice Command
      store.setState({ activeTool: 'magnifier' });
    } else if (/zoom\s*in|झूम\s*इन|बड़ा\s*करो/i.test(phrase)) {
      // SSIRO-UPDATE: Zoom In Voice Command
      zoomController.animateZoom(zoomController.getScale() * 1.5);
    } else if (/zoom\s*out|झूम\s*आउट|छोटा\s*करो/i.test(phrase)) {
      // SSIRO-UPDATE: Zoom Out Voice Command
      zoomController.animateZoom(zoomController.getScale() / 1.5);
    } else if (/reset\s*zoom|झूम\s*हटाओ|रीसेट\s*झूम/i.test(phrase)) {
      // SSIRO-UPDATE: Reset Zoom Voice Command
      zoomController.resetZoom();
    } else if (/spotlight|स्पॉटलाइट/i.test(phrase)) {
      // SSIRO-UPDATE: Spotlight Voice Command
      const cur = store.getState().settings.magnifierSpotlight;
      store.updateSettings({ magnifierSpotlight: !cur });
    }
  }
}

export const voiceCommandService = new VoiceCommandService();
