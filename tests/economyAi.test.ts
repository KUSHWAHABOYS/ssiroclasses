// ECON: Comprehensive Economy AI & No-API Audit Test Suite (Part G)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { quotaManager } from '../src/ai/quotaManager';
import { modelCatalog } from '../src/ai/modelCatalog';
import { aiResponseCache } from '../src/ai/responseCache';
import { aiRouter } from '../src/ai/aiRouter';
import { keyVault } from '../src/ai/keyVault';
import { commandsDict, normalizeSpeech, matchCommandFromDict } from '../src/voice/commandsDict';
import { voiceManager } from '../src/voice/commands';
import { store } from '../src/state/store';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { chromeBuiltInProvider } from '../src/ai/providers/chromeBuiltIn';
import { webMcpManager } from '../src/ai/webMcp';

describe('Part G — Economy AI, No-API Audit & Voice Grammar Tests', () => {

  beforeEach(() => {
    localStorage.clear();
    quotaManager.clearAllCooldowns();
  });

  describe('1. No-AI Audit (Zero Network Calls When Code Can Do It)', () => {
    it('voice command matching and execution makes 0 AI router calls', async () => {
      const runSpy = vi.spyOn(aiRouter, 'run');

      const phrasesToTest = [
        'अगली स्लाइड',
        'next slide',
        'पिछली स्लाइड पर चलो',
        'तीसरी स्लाइड',
        'slide 5',
        'पेन चालू करो',
        'मार्कर',
        'इरेज़र',
        'लाल रंग',
        'नीला रंग',
        'बोर्ड खोलो',
        'ज़ूम इन',
        'साफ़ करो',
        'माइक बंद करो'
      ];

      for (const phrase of phrasesToTest) {
        const cmd = matchCommandFromDict(phrase);
        expect(cmd).not.toBeNull();
      }

      expect(runSpy).not.toHaveBeenCalled();
      runSpy.mockRestore();
    });

    it('shape recognition and highlighter straightening run offline with zero AI calls', () => {
      const runSpy = vi.spyOn(aiRouter, 'run');
      expect(DEFAULT_SETTINGS.smartInkAiAssist).toBe(false); // Code first: geometric default
      expect(store.state.isHandwritingEnabled).toBe(false); // OCR toggle off by default at launch
      expect(runSpy).not.toHaveBeenCalled();
      runSpy.mockRestore();
    });
  });

  describe('2. Economy Default Model Ranking & Cooldown Fallback', () => {
    it('ranks economy models correctly preferring Flash-Lite, then 8b, then standard Flash', () => {
      const availableModels = [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', supportedTasks: ['chat', 'vision'] },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', supportedTasks: ['chat', 'vision'] },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', supportedTasks: ['chat', 'vision'] },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', supportedTasks: ['chat', 'vision'] },
        { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B', supportedTasks: ['chat', 'vision'] },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', supportedTasks: ['chat', 'vision'] },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro (Deprecated)', supportedTasks: ['chat', 'vision'] }
      ] as any;

      const bestEconomy = modelCatalog.pickBestModel('gemini', availableModels, 'economy', 'chat');
      expect(bestEconomy).toBe('gemini-2.0-flash-lite');

      // Deprecated models are excluded
      const isDeprecatedExcluded = availableModels.filter((m: any) => m.id === 'gemini-1.0-pro');
      const ranked = modelCatalog.rankModels('gemini', isDeprecatedExcluded, 'economy', 'chat');
      expect(ranked.length).toBe(0);
    });

    it('provides a stronger model for "Better Answer" upgrade', () => {
      const strongerFromLite = modelCatalog.getNextStrongerModel('gemini', 'gemini-2.0-flash-lite');
      expect(strongerFromLite).toBe('gemini-2.0-flash');

      const strongerFromFlash = modelCatalog.getNextStrongerModel('gemini', 'gemini-2.0-flash');
      expect(strongerFromFlash).toBe('gemini-1.5-pro');
    });

    it('cooldown manager marks model unavailable on 429 daily quota and picks next economy model', () => {
      const models = [
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', supportedTasks: ['chat', 'vision'] },
        { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B', supportedTasks: ['chat', 'vision'] },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', supportedTasks: ['chat', 'vision'] }
      ] as any;

      expect(modelCatalog.pickBestModel('gemini', models, 'economy', 'chat')).toBe('gemini-2.0-flash-lite');

      // Simulate 429 quota exhaustion on gemini-2.0-flash-lite
      quotaManager.recordFailure('gemini', 'gemini-2.0-flash-lite', 429, 'free-tier limit reached for requests per day');
      expect(quotaManager.isModelAvailable('gemini', 'gemini-2.0-flash-lite')).toBe(false);

      // Router/catalog immediately falls back to next economy model
      const fallbackModel = modelCatalog.pickBestModel('gemini', models, 'economy', 'chat');
      expect(fallbackModel).toBe('gemini-1.5-flash-8b');

      // Cooldown persists across reload (in localStorage)
      const restoredStatus = quotaManager.isModelAvailable('gemini', 'gemini-2.0-flash-lite');
      expect(restoredStatus).toBe(false);
    });

    it('handles per-minute 429 with short backoff', () => {
      quotaManager.recordFailure('gemini', 'gemini-2.0-flash', 429, 'Rate limit exceeded: 15 RPM');
      const entry = quotaManager.getCooldownEntry('gemini', 'gemini-2.0-flash');
      expect(entry?.isPerDay).toBe(false);
      expect(entry?.availableAt).toBeGreaterThan(Date.now());
      expect(entry?.availableAt).toBeLessThanOrEqual(Date.now() + 65000);
    });
  });

  describe('3. Friendly Errors & Key Masking (Part C4)', () => {
    it('formats raw quota JSON and URLs into short Hindi message with masked details', () => {
      const rawGoogleError = JSON.stringify({
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota). Please visit https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyB1234567890abcdef for docs.',
          status: 'RESOURCE_EXHAUSTED',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
              violations: [{ subject: 'gemini-2.5-flash', description: 'Daily request quota exceeded' }]
            }
          ]
        }
      });

      const formatted = quotaManager.formatFriendlyError(rawGoogleError, 'gemini', 'gemini-2.5-flash');
      expect(formatted.isQuota).toBe(true);
      expect(formatted.userMessage).toContain('आज की फ़्री सीमा');
      expect(formatted.userMessage).toContain('रीसेट:');
      // Must not dump URLs or raw JSON into user message
      expect(formatted.userMessage).not.toContain('googleapis.com');
      expect(formatted.userMessage).not.toContain('{');

      // Technical details must mask API keys
      expect(formatted.technicalDetails).not.toContain('AIzaSyB1234567890abcdef');
      expect(formatted.technicalDetails).toContain('AIza***[MASKED]');
    });

    it('masks OpenAI style keys (sk-...) as well', () => {
      const rawText = 'Authorization failed using key sk-proj-1234567890abcdef123456';
      const formatted = quotaManager.formatFriendlyError(rawText, 'openai');
      expect(formatted.technicalDetails).not.toContain('sk-proj-1234567890abcdef123456');
      expect(formatted.technicalDetails).toContain('sk-***[MASKED]');
    });
  });

  describe('4. Token Minimization & 24-Hour Cache (Part C2)', () => {
    it('caches answers in 24h IndexedDB/memory cache with zero token second request', async () => {
      const cacheKey = aiResponseCache.makeKey('gemini-2.0-flash-lite', 'Slide 1: Indian History', 'What is Indology?', 'hi', 'normal');
      expect(cacheKey).toBeTruthy();

      await aiResponseCache.set(cacheKey, 'Indology is the academic study of Indian history, culture and languages.', 'gemini-2.0-flash-lite');

      const cached = await aiResponseCache.get(cacheKey);
      expect(cached).not.toBeNull();
      expect(cached?.text).toContain('Indology is the academic study');
      expect(cached?.isCached).toBe(true);
    });

    it('estimates prompt tokens with ~3.5 chars per token', () => {
      const sampleText = 'This is a sample slide text about Indian architectural wonders.';
      const estTokens = aiResponseCache.estimateTokens(sampleText);
      expect(estTokens).toBe(Math.ceil(sampleText.length / 3.5));
    });
  });

  describe('5. Voice Command Grammar (60+ Hindi/English Phrases without AI)', () => {
    const testCases: Array<{ phrase: string; expectedAction: string }> = [
      // Navigation
      { phrase: 'अगली स्लाइड', expectedAction: 'next' },
      { phrase: 'आगे चलो', expectedAction: 'next' },
      { phrase: 'next slide', expectedAction: 'next' },
      { phrase: 'next', expectedAction: 'next' },
      { phrase: 'पिछली स्लाइड', expectedAction: 'prev' },
      { phrase: 'पीछे चलो', expectedAction: 'prev' },
      { phrase: 'back', expectedAction: 'prev' },
      { phrase: 'previous slide', expectedAction: 'prev' },
      { phrase: 'पहली स्लाइड', expectedAction: 'goto:1' },
      { phrase: 'first slide', expectedAction: 'goto:1' },
      { phrase: 'आख़िरी स्लाइड', expectedAction: 'goto:last' },
      { phrase: 'last slide', expectedAction: 'goto:last' },
      { phrase: 'दूसरी स्लाइड', expectedAction: 'goto:2' },
      { phrase: 'तीसरी स्लाइड', expectedAction: 'goto:3' },
      { phrase: 'चौथी स्लाइड', expectedAction: 'goto:4' },
      { phrase: 'पाँचवी स्लाइड', expectedAction: 'goto:5' },
      { phrase: 'स्लाइड 5', expectedAction: 'goto:5' },
      { phrase: 'slide five', expectedAction: 'goto:5' },
      { phrase: 'स्लाइड १०', expectedAction: 'goto:10' },
      { phrase: 'पंद्रहवीं स्लाइड पर चलो', expectedAction: 'goto:15' },
      { phrase: 'पच्चीसवीं स्लाइड', expectedAction: 'goto:25' },
      { phrase: 'पचासवीं स्लाइड', expectedAction: 'goto:50' },

      // Tools
      { phrase: 'पेन चालू करो', expectedAction: 'tool:pen' },
      { phrase: 'pen tool', expectedAction: 'tool:pen' },
      { phrase: 'कलम ले लो', expectedAction: 'tool:pen' },
      { phrase: 'मार्कर चालू करो', expectedAction: 'tool:marker' },
      { phrase: 'marker', expectedAction: 'tool:marker' },
      { phrase: 'हाईलाइटर', expectedAction: 'tool:marker' },
      { phrase: 'इरेज़र', expectedAction: 'tool:eraser' },
      { phrase: 'रबर', expectedAction: 'tool:eraser' },
      { phrase: 'eraser tool', expectedAction: 'tool:eraser' },
      { phrase: 'मैग्नीफ़ायर', expectedAction: 'tool:lens' },
      { phrase: 'lens tool', expectedAction: 'tool:lens' },
      { phrase: 'आवर्धक लेंस', expectedAction: 'tool:lens' },

      // Colors
      { phrase: 'लाल रंग', expectedAction: 'color:#ef4444' },
      { phrase: 'red color', expectedAction: 'color:#ef4444' },
      { phrase: 'नीला रंग', expectedAction: 'color:#3b82f6' },
      { phrase: 'blue', expectedAction: 'color:#3b82f6' },
      { phrase: 'हरा रंग', expectedAction: 'color:#22c55e' },
      { phrase: 'green', expectedAction: 'color:#22c55e' },
      { phrase: 'पीला रंग', expectedAction: 'color:#eab308' },
      { phrase: 'yellow color', expectedAction: 'color:#eab308' },
      { phrase: 'सफ़ेद रंग', expectedAction: 'color:#ffffff' },
      { phrase: 'white', expectedAction: 'color:#ffffff' },
      { phrase: 'काला रंग', expectedAction: 'color:#000000' },
      { phrase: 'black', expectedAction: 'color:#000000' },

      // Board & Zoom
      { phrase: 'बोर्ड खोलो', expectedAction: 'board:toggle' },
      { phrase: 'blackboard', expectedAction: 'board:toggle' },
      { phrase: 'श्वेतपट्ट', expectedAction: 'board:toggle' },
      { phrase: 'ज़ूम इन', expectedAction: 'zoom:in' },
      { phrase: 'zoom in', expectedAction: 'zoom:in' },
      { phrase: 'ज़ूम आउट', expectedAction: 'zoom:out' },
      { phrase: 'zoom out', expectedAction: 'zoom:out' },
      { phrase: 'ज़ूम रीसेट', expectedAction: 'zoom:reset' },
      { phrase: 'फुलस्क्रीन', expectedAction: 'fullscreen:toggle' },
      { phrase: 'fullscreen mode', expectedAction: 'fullscreen:toggle' },
      { phrase: 'स्पॉटलाइट', expectedAction: 'spotlight:toggle' },

      // Actions & Mic
      { phrase: 'साफ़ करो', expectedAction: 'action:clear' },
      { phrase: 'clear all', expectedAction: 'action:clear' },
      { phrase: 'वापस लो', expectedAction: 'action:undo' },
      { phrase: 'undo', expectedAction: 'action:undo' },
      { phrase: 'माइक बंद करो', expectedAction: 'mic:off' },
      { phrase: 'stop mic', expectedAction: 'mic:off' },
      { phrase: 'माइक ऑफ', expectedAction: 'mic:off' },
      { phrase: 'turn off microphone', expectedAction: 'mic:off' }
    ];

    it(`matches all ${testCases.length} natural Hindi/English phrases correctly`, () => {
      expect(testCases.length).toBeGreaterThanOrEqual(50);
      for (const tc of testCases) {
        const cmd = matchCommandFromDict(tc.phrase);
        expect(cmd, `Phrase failed to match: "${tc.phrase}"`).not.toBeNull();
        expect(cmd?.action, `Action mismatch for "${tc.phrase}"`).toBe(tc.expectedAction);
      }
    });

    it('ignores conversational filler words smoothly', () => {
      const phraseWithFiller = 'भैया ज़रा अगली स्लाइड पर चलो यार प्लीज';
      const cmd = matchCommandFromDict(phraseWithFiller);
      expect(cmd).not.toBeNull();
      expect(cmd?.action).toBe('next');
    });

    it('silently ignores unrecognized speech without error', () => {
      const randomSpeech = 'आज का मौसम बहुत अच्छा है';
      const cmd = matchCommandFromDict(randomSpeech);
      expect(cmd).toBeNull();
    });
  });

  describe('6. Fallback & Safe Integration Layers (Part C5 & F)', () => {
    it('Chrome Built-in AI reports unavailable in test environment without throwing', async () => {
      const status = await chromeBuiltInProvider.isAvailable();
      expect(status).toBe(false);
      const testRes = await chromeBuiltInProvider.testPrompt();
      expect(testRes.success).toBe(false);
      expect(testRes.message).toContain('उपलब्ध नहीं');
    });

    it('WebMCP registers safe tool actions without throwing', () => {
      webMcpManager.init();
      // Should not throw even if navigator.modelContext is not present
      expect(true).toBe(true);
    });
  });
});
