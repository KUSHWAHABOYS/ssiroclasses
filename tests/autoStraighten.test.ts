import { describe, it, expect, beforeEach } from 'vitest';
import { detectAndStraightenLine } from '../src/draw/autoStraighten';
import { store } from '../src/state/store';
import { toolbar } from '../src/ui/toolbar';
import { annotationStore } from '../src/draw/annotationStore';

describe('Auto-Straighten / Auto-Correction Feature Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="stage" style="width: 1920px; height: 1080px;">
        <canvas id="slideCanvas" width="1920" height="1080"></canvas>
        <canvas id="annotationCanvas" width="1920" height="1080"></canvas>
        <canvas id="previewCanvas" width="1920" height="1080"></canvas>
        <div id="toolbarContainer"></div>
        <div id="boardDockCenter"></div>
        <div id="settingsPanel"></div>
        <div id="btnMicHeader"></div>
        <div id="micZenDot" class="hidden"></div>
      </div>
    `;

    store.setState({
      isAutoStraightenEnabled: false,
      isBoardMode: false,
      activeTool: 'pen'
    });

    toolbar.init();
    annotationStore.resetAll();
  });

  describe('1. Dedicated Toolbar Toggle', () => {
    it('renders #btnToolAutoStraighten prominently in Tier 1', () => {
      const btn = document.getElementById('btnToolAutoStraighten');
      expect(btn).not.toBeNull();
      expect(btn?.title).toContain('Auto-Straighten [OFF]');
      expect(btn?.classList.contains('active')).toBe(false);
    });

    it('toggles isAutoStraightenEnabled and visual state on click', () => {
      const btn = document.getElementById('btnToolAutoStraighten');
      expect(btn).not.toBeNull();

      // Click to toggle ON
      btn?.click();
      expect(store.getState().isAutoStraightenEnabled).toBe(true);
      expect(btn?.classList.contains('active')).toBe(true);
      expect(btn?.title).toContain('Auto-Straighten [ON]');

      // Click to toggle OFF
      btn?.click();
      expect(store.getState().isAutoStraightenEnabled).toBe(false);
      expect(btn?.classList.contains('active')).toBe(false);
      expect(btn?.title).toContain('Auto-Straighten [OFF]');
    });
  });

  describe('2. Detection & Line Snapping Algorithm', () => {
    it('snaps a wavy horizontal underline into a perfectly straight horizontal line', () => {
      // Create a wavy stroke simulating hand tremor (400px wide, ~12px peak-to-peak wobble)
      const points = [];
      for (let x = 100; x <= 500; x += 10) {
        const wobble = Math.sin((x - 100) * 0.05) * 6;
        points.push({ x, y: 300 + wobble });
      }

      const result = detectAndStraightenLine(points, 'pen', false);
      expect(result).not.toBeNull();
      expect(result!.isUnderline).toBe(true);
      // Both start and end Y must be snapped to identical average Y
      expect(result!.start.y).toBe(result!.end.y);
      expect(result!.start.x).toBe(100);
      expect(result!.end.x).toBe(500);
    });

    it('snaps a highlighter stroke into a clean straight band', () => {
      // 350px horizontal swipe with small hand jitter
      const points = [];
      for (let x = 200; x <= 550; x += 10) {
        const jitter = ((x % 30) - 15) * 0.2;
        points.push({ x, y: 150 + jitter });
      }

      const result = detectAndStraightenLine(points, 'highlighter', false);
      expect(result).not.toBeNull();
      expect(result!.start.y).toBe(result!.end.y);
      expect(result!.start.x).toBe(200);
      expect(result!.end.x).toBe(550);
    });

    it('snaps a vertical margin separator into a perfectly vertical line', () => {
      // 300px vertical stroke from top to bottom
      const points = [];
      for (let y = 100; y <= 400; y += 10) {
        const wobble = Math.sin(y * 0.1) * 3;
        points.push({ x: 250 + wobble, y });
      }

      const result = detectAndStraightenLine(points, 'pen', false);
      expect(result).not.toBeNull();
      expect(result!.start.x).toBe(result!.end.x);
      expect(result!.start.y).toBe(100);
      expect(result!.end.y).toBe(400);
    });

    it('preserves natural handwriting and curves untouched (never snaps letters)', () => {
      // Simulate writing a curved letter 'C' or 'O'
      const circlePoints = [];
      for (let a = 0; a <= Math.PI * 1.8; a += 0.2) {
        circlePoints.push({
          x: 200 + Math.cos(a) * 40,
          y: 200 + Math.sin(a) * 40
        });
      }

      const circleResult = detectAndStraightenLine(circlePoints, 'pen', false);
      expect(circleResult).toBeNull();

      // Simulate writing letter 'S'
      const sPoints = [
        { x: 100, y: 100 },
        { x: 90, y: 95 },
        { x: 80, y: 105 },
        { x: 90, y: 120 },
        { x: 100, y: 135 },
        { x: 90, y: 145 },
        { x: 80, y: 140 }
      ];
      const sResult = detectAndStraightenLine(sPoints, 'pen', false);
      expect(sResult).toBeNull();
    });

    it('ignores short dots, ticks, and accents (< 24px)', () => {
      const shortTick = [
        { x: 100, y: 100 },
        { x: 105, y: 103 },
        { x: 112, y: 105 }
      ];
      const result = detectAndStraightenLine(shortTick, 'pen', false);
      expect(result).toBeNull();
    });

    it('works identically in board mode (isBoardMode = true)', () => {
      const points = [];
      for (let x = 150; x <= 600; x += 15) {
        points.push({ x, y: 450 + (x % 4) });
      }

      const boardResult = detectAndStraightenLine(points, 'pen', true);
      expect(boardResult).not.toBeNull();
      expect(boardResult!.start.y).toBe(boardResult!.end.y);
      expect(boardResult!.start.x).toBe(150);
      expect(boardResult!.end.x).toBe(600);
    });
  });
});
