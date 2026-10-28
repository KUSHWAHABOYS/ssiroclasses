import { describe, it, expect } from 'vitest';
import { matchCommandFromDict, normalizeSpeech, NUMBER_WORDS } from '../src/voice/commandsDict';

describe('MIC-4 Local Command Grammar Suite', () => {
  const navPhrases = [
      // Next variants
      { phrase: 'Page Next', expected: 'next' },
      { phrase: 'page next', expected: 'next' },
      { phrase: 'Slide Next', expected: 'next' },
      { phrase: 'slide next', expected: 'next' },
      { phrase: 'next page', expected: 'next' },
      { phrase: 'पेज नेक्स्ट', expected: 'next' },
      { phrase: 'स्लाइड नेक्स्ट', expected: 'next' },
      { phrase: 'अगली स्लाइड', expected: 'next' },
      { phrase: 'आगे चलो', expected: 'next' },
      { phrase: 'अगला पेज', expected: 'next' },
      { phrase: 'next slide', expected: 'next' },
      { phrase: 'next', expected: 'next' },
      { phrase: 'आगे बढ़ो', expected: 'next' },
      { phrase: 'aage chalo', expected: 'next' },

      // Prev variants
      { phrase: 'Page Back', expected: 'prev' },
      { phrase: 'page back', expected: 'prev' },
      { phrase: 'Slide Back', expected: 'prev' },
      { phrase: 'slide back', expected: 'prev' },
      { phrase: 'previous page', expected: 'prev' },
      { phrase: 'पेज बैक', expected: 'prev' },
      { phrase: 'स्लाइड बैक', expected: 'prev' },
      { phrase: 'पिछली स्लाइड', expected: 'prev' },
      { phrase: 'पीछे चलो', expected: 'prev' },
      { phrase: 'पिछला पेज', expected: 'prev' },
      { phrase: 'previous slide', expected: 'prev' },
      { phrase: 'back', expected: 'prev' },
      { phrase: 'peeche chalo', expected: 'prev' },

      // First & Last variants
      { phrase: 'पहली स्लाइड', expected: 'goto:1' },
      { phrase: 'पहला पेज', expected: 'goto:1' },
      { phrase: 'first slide', expected: 'goto:1' },
      { phrase: 'आख़िरी स्लाइड', expected: 'goto:last' },
      { phrase: 'आखिरी स्लाइड', expected: 'goto:last' },
      { phrase: 'last slide', expected: 'goto:last' },

      // Ordinals & Number Words (Hindi & English)
      { phrase: 'दूसरी स्लाइड', expected: 'goto:2' },
      { phrase: 'तीसरी स्लाइड', expected: 'goto:3' },
      { phrase: 'चौथी स्लाइड', expected: 'goto:4' },
      { phrase: 'पाँचवी स्लाइड', expected: 'goto:5' },
      { phrase: 'दसवीं स्लाइड', expected: 'goto:10' },
      { phrase: 'पंद्रहवीं स्लाइड', expected: 'goto:15' },
      { phrase: 'बीसवीं स्लाइड', expected: 'goto:20' },
      { phrase: 'पच्चीसवीं स्लाइड', expected: 'goto:25' },
      { phrase: 'second slide', expected: 'goto:2' },
      { phrase: 'third slide', expected: 'goto:3' },
      { phrase: 'fourth slide', expected: 'goto:4' },
      { phrase: 'fifth slide', expected: 'goto:5' },
      { phrase: 'slide 7', expected: 'goto:7' },
      { phrase: 'slide 12', expected: 'goto:12' },
      { phrase: 'स्लाइड ५', expected: 'goto:5' },
      { phrase: 'स्लाइड १०', expected: 'goto:10' },
      { phrase: 'दूसरी स्लाइड पर चलो', expected: 'goto:2' }
    ];

  describe('1. Navigation Phrases (Next / Prev / First / Last / Ordinals / Digits)', () => {
    navPhrases.forEach(({ phrase, expected }) => {
      it(`matches navigation phrase: "${phrase}" -> ${expected}`, () => {
        const result = matchCommandFromDict(phrase);
        expect(result).not.toBeNull();
        expect(result?.action).toBe(expected);
      });
    });
  });

  describe('2. Tools, Colours, Sizes, Board, Zoom & Actions', () => {
    const featurePhrases = [
      // Tools
      { phrase: 'पेन ले लो', expected: 'tool:pen' },
      { phrase: 'कलम', expected: 'tool:pen' },
      { phrase: 'select pen', expected: 'tool:pen' },
      { phrase: 'मार्कर', expected: 'tool:marker' },
      { phrase: 'हाईलाइटर', expected: 'tool:marker' },
      { phrase: 'highlighter', expected: 'tool:marker' },
      { phrase: 'इरेज़र', expected: 'tool:eraser' },
      { phrase: 'eraser', expected: 'tool:eraser' },
      { phrase: 'रबर ले आओ', expected: 'tool:eraser' },
      { phrase: 'मैग्नीफ़ायर', expected: 'tool:lens' },
      { phrase: 'magnifier', expected: 'tool:lens' },

      // Colours
      { phrase: 'लाल रंग', expected: 'color:#ef4444' },
      { phrase: 'red color', expected: 'color:#ef4444' },
      { phrase: 'नीला रंग', expected: 'color:#3b82f6' },
      { phrase: 'blue', expected: 'color:#3b82f6' },
      { phrase: 'हरा रंग', expected: 'color:#22c55e' },
      { phrase: 'green', expected: 'color:#22c55e' },
      { phrase: 'पीला रंग', expected: 'color:#eab308' },
      { phrase: 'yellow', expected: 'color:#eab308' },
      { phrase: 'सफ़ेद रंग', expected: 'color:#ffffff' },
      { phrase: 'white', expected: 'color:#ffffff' },
      { phrase: 'काला रंग', expected: 'color:#000000' },
      { phrase: 'black', expected: 'color:#000000' },

      // Sizes
      { phrase: 'मोटा पेन', expected: 'size_thicker' },
      { phrase: 'mota karo', expected: 'size_thicker' },
      { phrase: 'make it thicker', expected: 'size_thicker' },
      { phrase: 'पतला पेन', expected: 'size_thinner' },
      { phrase: 'patla karo', expected: 'size_thinner' },
      { phrase: 'make it thinner', expected: 'size_thinner' },

      // Board & Zoom & Fullscreen
      { phrase: 'ब्लैकबोर्ड खोलो', expected: 'board:toggle' },
      { phrase: 'board', expected: 'board:toggle' },
      { phrase: 'blackboard', expected: 'board:toggle' },
      { phrase: 'ज़ूम इन', expected: 'zoom:in' },
      { phrase: 'zoom in', expected: 'zoom:in' },
      { phrase: 'ज़ूम आउट', expected: 'zoom:out' },
      { phrase: 'zoom out', expected: 'zoom:out' },
      { phrase: 'ज़ूम रीसेट', expected: 'zoom:reset' },
      { phrase: 'reset zoom', expected: 'zoom:reset' },
      { phrase: 'फुलस्क्रीन', expected: 'fullscreen:toggle' },
      { phrase: 'fullscreen', expected: 'fullscreen:toggle' },
      { phrase: 'स्पॉटलाइट', expected: 'spotlight:toggle' },

      // Clear & Undo & Mic off
      { phrase: 'सब साफ़ करो', expected: 'action:clear' },
      { phrase: 'clear all', expected: 'action:clear' },
      { phrase: 'वापस करो', expected: 'action:undo' },
      { phrase: 'undo', expected: 'action:undo' },
      { phrase: 'माइक बंद करो', expected: 'mic:off' },
      { phrase: 'stop listening', expected: 'mic:off' },
      { phrase: 'mute mic', expected: 'mic:off' },
      { phrase: 'turn off microphone', expected: 'mic:off' }
    ];

    featurePhrases.forEach(({ phrase, expected }) => {
      it(`matches feature phrase: "${phrase}" -> ${expected}`, () => {
        const result = matchCommandFromDict(phrase);
        expect(result).not.toBeNull();
        expect(result?.action).toBe(expected);
      });
    });

    it('total verified voice phrases exceeds 60', () => {
      expect(navPhrases.length + featurePhrases.length).toBeGreaterThanOrEqual(60);
    });
  });

  describe('3. Unmatched Speech Returns Null (No accidental execution)', () => {
    const unmatchedPhrases = [
      'नमस्कार छात्रों आज हम संधि पढ़ेंगे',
      'today we are going to learn calculus',
      'what is the weather today',
      'कृपया ध्यान से सुनिए',
      'this sentence should never trigger a tool change'
    ];

    unmatchedPhrases.forEach((phrase) => {
      it(`does nothing for non-command: "${phrase}"`, () => {
        const result = matchCommandFromDict(phrase);
        expect(result).toBeNull();
      });
    });
  });
});
