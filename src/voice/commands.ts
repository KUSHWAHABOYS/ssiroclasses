import { store } from '../state/store';
import { navigationController } from '../presenter/navigation';
import { annotationStore } from '../draw/annotationStore';
import { blackboardStudio } from '../board/board';
import { fullscreenService } from '../core/fullscreen';

export class VoiceCommandService {
  private recognition: any = null;
  private isListening = false;
  private shouldRestart = true;

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
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Web Speech API is not supported in this browser/WebView');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = store.getState().settings.voiceLang || 'hi-IN';

      this.recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.trim().toLowerCase();
        this.processVoiceCommand(transcript);
      };

      this.recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          this.shouldRestart = false;
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: { message: 'माइक अनुमति अस्वीकृत (Microphone permission denied)', isError: true }
            })
          );
        }
      };

      this.recognition.onend = () => {
        if (this.shouldRestart && this.isListening) {
          try {
            this.recognition.start();
          } catch {}
        }
      };

      // Auto start listening
      this.start();
    } catch (e) {
      console.warn('Speech init failed:', e);
    }
  }

  start(): void {
    if (!this.recognition || this.isListening) return;
    try {
      this.shouldRestart = true;
      this.recognition.start();
      this.isListening = true;
    } catch (e) {
      console.warn('Speech start error:', e);
    }
  }

  stop(): void {
    this.shouldRestart = false;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  private processVoiceCommand(phrase: string): void {
    console.log('Voice Command received:', phrase);

    // Feedback toast
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { message: `🎙️ आवाज आदेश: "${phrase}"` }
      })
    );

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
      const state = store.getState();
      if (state.isBoardMode) blackboardStudio.closeBoard();
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
    }
  }
}

export const voiceCommandService = new VoiceCommandService();
