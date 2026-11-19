import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceCommandService } from '../src/voice/commands';
import { navigationController } from '../src/presenter/navigation';
import { slideRenderer } from '../src/presenter/renderer';
import { store } from '../src/state/store';
import { drawingEngine } from '../src/draw/engine';

describe('Voice Navigation & Shape Tool Enhancements', () => {
  let voiceService: VoiceCommandService;

  beforeEach(() => {
    vi.spyOn(slideRenderer, 'renderSlide').mockResolvedValue({} as any);
    vi.spyOn(slideRenderer, 'preRenderAdjacent').mockResolvedValue({} as any);
    store.setState({
      appState: 'deck',
      currentPage: 3,
      totalPages: 10,
      activeTool: 'pen',
      currentDeck: {
        id: 'test-deck',
        name: 'Test Presentation',
        totalPages: 10,
        pages: Array.from({ length: 10 }, (_, i) => ({
          pageNumber: i + 1,
          width: 1920,
          height: 1080
        })) as any
      }
    });

    voiceService = new VoiceCommandService();
  });

  describe('1. Slide Jump Target Parsing', () => {
    it('detects first slide from Hindi & English phrases', () => {
      const fn = (voiceService as any).parseSlideJumpTarget.bind(voiceService);
      expect(fn('पहली स्लाइड', 10)).toBe(1);
      expect(fn('पहला पेज', 10)).toBe(1);
      expect(fn('first slide', 10)).toBe(1);
    });

    it('detects last slide from Hindi & English phrases', () => {
      const fn = (voiceService as any).parseSlideJumpTarget.bind(voiceService);
      expect(fn('लास्ट स्लाइड', 10)).toBe(10);
      expect(fn('आखिरी स्लाइड', 10)).toBe(10);
      expect(fn('अंतिम स्लाइड', 10)).toBe(10);
      expect(fn('last slide', 10)).toBe(10);
    });

    it('detects fifth slide (पाँचवीं / पांचवी)', () => {
      const fn = (voiceService as any).parseSlideJumpTarget.bind(voiceService);
      expect(fn('पाँचवीं स्लाइड', 10)).toBe(5);
      expect(fn('पांचवी स्लाइड', 10)).toBe(5);
      expect(fn('5th slide', 10)).toBe(5);
    });

    it('detects arbitrary slide numbers', () => {
      const fn = (voiceService as any).parseSlideJumpTarget.bind(voiceService);
      expect(fn('स्लाइड 8', 10)).toBe(8);
      expect(fn('8 नंबर स्लाइड', 10)).toBe(8);
      expect(fn('पेज 7', 10)).toBe(7);
      expect(fn('slide 4', 10)).toBe(4);
      expect(fn('स्लाइड 99', 10)).toBe(10); // Clamped to totalPages
    });
  });

  describe('2. Voice Navigation Back vs Next Single Step', () => {
    it('executes prevPage exactly once when "बैक" is spoken', () => {
      const prevSpy = vi.spyOn(navigationController, 'prevPage');
      const nextSpy = vi.spyOn(navigationController, 'nextPage');

      const handled = voiceService.processVoiceCommand('बैक', true);
      expect(handled).toBe(true);
      expect(prevSpy).toHaveBeenCalledTimes(1);
      expect(nextSpy).not.toHaveBeenCalled();
    });

    it('executes nextPage exactly once when "नेक्स्ट" is spoken', () => {
      const prevSpy = vi.spyOn(navigationController, 'prevPage');
      const nextSpy = vi.spyOn(navigationController, 'nextPage');

      const handled = voiceService.processVoiceCommand('नेक्स्ट', true);
      expect(handled).toBe(true);
      expect(nextSpy).toHaveBeenCalledTimes(1);
      expect(prevSpy).not.toHaveBeenCalled();
    });

    it('executes goToPage with jump direction when direct slide jump is spoken', () => {
      const jumpSpy = vi.spyOn(navigationController, 'goToPage');

      const handled = voiceService.processVoiceCommand('पाँचवीं स्लाइड', true);
      expect(handled).toBe(true);
      expect(jumpSpy).toHaveBeenCalledWith(5, 'jump');
    });
  });

  describe('3. Shape Tool Persistence (No 400ms Auto-Revert)', () => {
    it('retains shape tool active after shape drawing without fast revert', () => {
      store.setState({ activeTool: 'shape', activeShape: 'rect' });
      vi.useFakeTimers();

      drawingEngine.scheduleAutoRevertToPen();

      // At 500ms, should STILL be shape (was previously kicking user out at 400ms!)
      vi.advanceTimersByTime(500);
      expect(store.getState().activeTool).toBe('shape');

      // At 2000ms, should STILL be shape
      vi.advanceTimersByTime(1500);
      expect(store.getState().activeTool).toBe('shape');

      vi.useRealTimers();
    });
  });
});
