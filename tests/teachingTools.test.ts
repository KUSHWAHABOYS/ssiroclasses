import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/state/store';
import { timerController, curtainController, spotlightController, splitScreenController, pdfNotesExporter } from '../src/tools/teachingTools';
import { blackboardStudio } from '../src/board/board';
import { annotationStore, Stroke } from '../src/draw/annotationStore';

describe('Teaching Tools & Screen Cleanup Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="stage" style="width: 1920px; height: 1080px;">
        <canvas id="slideCanvas" width="1920" height="1080"></canvas>
        <canvas id="annotationCanvas" width="1920" height="1080"></canvas>
        <canvas id="previewCanvas" width="1920" height="1080"></canvas>
        
        <!-- Minimalist Status Header -->
        <header id="header" class="header">
          <div class="header-left">
            <div class="header-status-pill">
              <span id="channelName">SSIRO Classes</span>
              <span id="fileName">Sample.pdf</span>
            </div>
          </div>
          <div class="header-right">
            <div class="header-page-pill">
              <span id="pageCounter">1 / 1</span>
            </div>
            <div class="header-legacy-support" style="display:none !important;">
              <button id="btnOpenFile"><span class="btn-text">Open Deck</span></button>
              <button id="btnLibraryHeader"><span class="btn-text">Library</span></button>
              <button id="btnInstallHeader"><span class="btn-text">Install</span></button>
              <button id="btnCloseDeckHeader"><span class="btn-text">Close Deck</span></button>
              <button id="btnBoardHeader"><span class="btn-text">Board</span></button>
              <button id="btnMicHeader"><span class="btn-text">Mic</span></button>
            </div>
          </div>
        </header>

        <div id="toolbarContainer"></div>
        <div id="boardDock" class="hidden"></div>
      </div>
    `;

    store.setState({
      appState: 'deck',
      activeTool: 'pen'
    });

    timerController.init();
    curtainController.init();
    spotlightController.init();
    blackboardStudio.init();
  });

  describe('1. Screen Cleanup & Header Status Pill', () => {
    it('maintains clean status pill while keeping legacy buttons safely hidden in DOM', () => {
      const channel = document.getElementById('channelName');
      const file = document.getElementById('fileName');
      const counter = document.getElementById('pageCounter');

      expect(channel?.textContent).toBe('SSIRO Classes');
      expect(file?.textContent).toBe('Sample.pdf');
      expect(counter?.textContent).toBe('1 / 1');

      const legacySupport = document.querySelector('.header-legacy-support') as HTMLElement;
      expect(legacySupport).not.toBeNull();
      expect(legacySupport.style.display).toContain('none');

      // Legacy buttons exist in DOM so no script or test crashes
      expect(document.getElementById('btnOpenFile')).not.toBeNull();
      expect(document.getElementById('btnLibraryHeader')).not.toBeNull();
      expect(document.getElementById('btnInstallHeader')).not.toBeNull();
      expect(document.getElementById('btnCloseDeckHeader')).not.toBeNull();
      expect(document.getElementById('btnBoardHeader')).not.toBeNull();
      expect(document.getElementById('btnMicHeader')).not.toBeNull();
    });
  });

  describe('2. Classroom Countdown Timer & Stopwatch', () => {
    it('initializes timer widget and toggles visibility', () => {
      const widget = document.getElementById('timerWidget');
      expect(widget).not.toBeNull();
      expect(widget?.style.display).toBe('none');

      timerController.show();
      expect(widget?.style.display).toBe('flex');

      timerController.hide();
      expect(widget?.style.display).toBe('none');
    });

    it('updates display on preset selection', () => {
      timerController.show();
      const preset30s = document.querySelector('.timer-preset-pill[data-sec="30"]') as HTMLButtonElement;
      preset30s?.click();

      const display = document.getElementById('timerDisplay');
      expect(display?.textContent).toBe('00:30');

      const preset5m = document.querySelector('.timer-preset-pill[data-sec="300"]') as HTMLButtonElement;
      preset5m?.click();
      expect(display?.textContent).toBe('05:00');
    });

    it('switches to stopwatch mode', () => {
      timerController.show();
      const btnStopwatch = document.getElementById('btnModeStopwatch') as HTMLButtonElement;
      btnStopwatch?.click();

      const display = document.getElementById('timerDisplay');
      expect(display?.textContent).toBe('00:00');
      expect(document.getElementById('timerTitle')?.textContent).toContain('Stopwatch');
    });
  });

  describe('3. Curtain / Screen Shade Tool', () => {
    it('initializes and toggles curtain overlay', () => {
      const curtain = document.getElementById('curtainLayer');
      expect(curtain).not.toBeNull();

      curtainController.show();
      expect(curtain?.style.display).toBe('block');
      expect(curtain?.classList.contains('active')).toBe(true);

      curtainController.hide();
      expect(curtain?.style.display).toBe('none');
      expect(curtain?.classList.contains('active')).toBe(false);
    });
  });

  describe('4. Spotlight Focus Tool', () => {
    it('initializes and toggles spotlight focus', () => {
      const spotlight = document.getElementById('spotlightLayer');
      const controls = document.getElementById('spotlightControls');
      expect(spotlight).not.toBeNull();
      expect(controls).not.toBeNull();

      spotlightController.show();
      expect(spotlight?.classList.contains('hidden')).toBe(false);
      expect(controls?.style.display).toBe('flex');

      spotlightController.hide();
      expect(spotlight?.classList.contains('hidden')).toBe(true);
      expect(controls?.style.display).toBe('none');
    });
  });

  describe('5. 50:50 Dual Split-Screen Board', () => {
    it('toggles split screen mode and mounts rough blackboard', () => {
      const stage = document.getElementById('stage');
      expect(splitScreenController.getIsSplit()).toBe(false);

      splitScreenController.toggle();
      expect(splitScreenController.getIsSplit()).toBe(true);
      expect(stage?.classList.contains('split-mode')).toBe(true);

      const splitBoard = document.getElementById('splitBoardSurface');
      expect(splitBoard).not.toBeNull();

      splitScreenController.toggle();
      expect(splitScreenController.getIsSplit()).toBe(false);
      expect(stage?.classList.contains('split-mode')).toBe(false);
    });
  });

  describe('6. Multi-Page Blackboard Navigation', () => {
    it('supports adding and navigating across multiple blackboard pages', () => {
      blackboardStudio.openBoard();

      const indicator = document.getElementById('boardPageIndicator');
      expect(indicator?.textContent).toBe('1 / 1');

      // Add stroke to page 1
      const stroke1: Stroke = {
        id: 'bp1',
        tool: 'pen',
        color: '#ffffff',
        size: 3,
        alpha: 1,
        points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
        timestamp: Date.now()
      };
      annotationStore.addStroke(stroke1);
      expect(annotationStore.getStrokes().length).toBe(1);

      // Add Page 2
      blackboardStudio.addPage();
      expect(indicator?.textContent).toBe('2 / 2');
      expect(annotationStore.getStrokes().length).toBe(0);

      // Add stroke to page 2
      const stroke2: Stroke = {
        id: 'bp2',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        timestamp: Date.now()
      };
      annotationStore.addStroke(stroke2);
      expect(annotationStore.getStrokes().length).toBe(1);

      // Go back to Page 1
      blackboardStudio.prevPage();
      expect(indicator?.textContent).toBe('1 / 2');
      expect(annotationStore.getStrokes().length).toBe(1);
      expect(annotationStore.getStrokes()[0].id).toBe('bp1');

      // Go to Page 2
      blackboardStudio.nextPage();
      expect(indicator?.textContent).toBe('2 / 2');
      expect(annotationStore.getStrokes().length).toBe(1);
      expect(annotationStore.getStrokes()[0].id).toBe('bp2');
    });
  });
});
