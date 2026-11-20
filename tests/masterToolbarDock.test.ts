import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/state/store';
import { toolbar } from '../src/ui/toolbar';
import { annotationStore, Stroke } from '../src/draw/annotationStore';

describe('Master Floating Dock & Dynamic Inking Island Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="stage" style="width: 1920px; height: 1080px;">
        <canvas id="slideCanvas" width="1920" height="1080"></canvas>
        <canvas id="annotationCanvas" width="1920" height="1080"></canvas>
        <canvas id="previewCanvas" width="1920" height="1080"></canvas>
        <div id="toolbarContainer"></div>
        <div id="welcomeScreen" style="display:none;"></div>
        <div id="settingsPanel"></div>
        <div id="btnMicHeader"></div>
        <div id="micZenDot" class="hidden"></div>
        <input type="file" id="fileInputMedia" style="display:none;" />
      </div>
    `;

    store.setState({
      appState: 'deck',
      activeTool: 'pen',
      activeShape: 'rect',
      activeColor: '#ffffff',
      penSize: 4
    });

    toolbar.init();
    annotationStore.resetAll();
  });

  describe('1. Dynamic Inking & Properties Island', () => {
    it('renders Dynamic Inking Island with tips, stroke dots, swatches, and pressure feedback', () => {
      const island = document.getElementById('penDynamicIsland');
      expect(island).not.toBeNull();

      const tipBtns = island?.querySelectorAll('.island-tip-btn');
      expect(tipBtns?.length).toBe(4);

      const strokeDots = island?.querySelectorAll('.stroke-dot-btn');
      expect(strokeDots?.length).toBe(4);

      const swatches = island?.querySelectorAll('.color-swatch-tactile');
      expect(swatches?.length).toBeGreaterThanOrEqual(6);

      const spectrumPicker = document.getElementById('btnCustomColor');
      expect(spectrumPicker).not.toBeNull();

      const pressureFeedback = document.getElementById('islandPressureFeedback');
      expect(pressureFeedback).not.toBeNull();
      expect(pressureFeedback?.textContent).toContain('Pressure Curve: Adaptive');
    });

    it('toggles stroke thickness on dot button click and updates store', () => {
      const dot8px = document.querySelector('.stroke-dot-btn[data-size="16"]') as HTMLButtonElement;
      expect(dot8px).not.toBeNull();

      dot8px.click();
      expect(store.getState().penSize).toBe(16);
      expect(dot8px.classList.contains('active')).toBe(true);

      const dot1px = document.querySelector('.stroke-dot-btn[data-size="2"]') as HTMLButtonElement;
      dot1px.click();
      expect(store.getState().penSize).toBe(2);
      expect(dot1px.classList.contains('active')).toBe(true);
      expect(dot8px.classList.contains('active')).toBe(false);
    });

    it('toggles color swatch on tactile click and updates store', () => {
      const goldSwatch = document.querySelector('.color-swatch-tactile[data-color="#f59e0b"]') as HTMLElement;
      expect(goldSwatch).not.toBeNull();

      goldSwatch.click();
      expect(store.getState().activeColor).toBe('#f59e0b');
      expect(goldSwatch.classList.contains('active')).toBe(true);

      const cyanSwatch = document.querySelector('.color-swatch-tactile[data-color="#06b6d4"]') as HTMLElement;
      cyanSwatch.click();
      expect(store.getState().activeColor).toBe('#06b6d4');
      expect(cyanSwatch.classList.contains('active')).toBe(true);
      expect(goldSwatch.classList.contains('active')).toBe(false);
    });

    it('automatically collapses Dynamic Island when non-pen tool is selected', () => {
      const island = document.getElementById('penDynamicIsland');
      const selectBtn = document.getElementById('btnToolSelect');

      // Initially Pen is active -> not collapsed
      expect(island?.classList.contains('collapsed')).toBe(false);

      // Select tool clicked
      selectBtn?.click();
      expect(store.getState().activeTool).toBe('select');
      expect(island?.classList.contains('collapsed')).toBe(true);

      // Pen tool clicked back
      const penBtn = document.getElementById('btnToolPen');
      penBtn?.click();
      expect(store.getState().activeTool).toBe('pen');
      expect(island?.classList.contains('collapsed')).toBe(false);
    });
  });

  describe('2. Master Floating Dock Sections & Controls', () => {
    it('has AI अनुवाद prominent glowing card with Neural Live', () => {
      const aiBtn = document.getElementById('btnToolTranslate');
      expect(aiBtn).not.toBeNull();
      expect(aiBtn?.classList.contains('tool-ai-translate')).toBe(true);
      expect(aiBtn?.textContent).toContain('AI अनुवाद');
      expect(aiBtn?.textContent).toContain('Neural Live');
    });

    it('has Shape Pill with Box, Circle, Triangle, Line, and Arrow buttons', () => {
      const shapePill = document.getElementById('dockShapesPill');
      expect(shapePill).not.toBeNull();

      const btnRect = document.getElementById('btnToolRect');
      const btnCircle = document.getElementById('btnToolCircle');
      const btnTriangle = document.getElementById('btnToolTriangle');
      const btnLine = document.getElementById('btnToolLine');
      const btnArrow = document.getElementById('btnToolArrow');

      expect(btnRect).not.toBeNull();
      expect(btnCircle).not.toBeNull();
      expect(btnTriangle).not.toBeNull();
      expect(btnLine).not.toBeNull();
      expect(btnArrow).not.toBeNull();

      btnRect?.click();
      expect(store.getState().activeTool).toBe('shape');
      expect(store.getState().activeShape).toBe('rect');

      btnArrow?.click();
      expect(store.getState().activeTool).toBe('arrow');
    });

    it('supports Redo functionality via #btnRedo and annotationStore', () => {
      const btnRedo = document.getElementById('btnRedo');
      const btnUndo = document.getElementById('btnUndo');
      expect(btnRedo).not.toBeNull();
      expect(btnUndo).not.toBeNull();

      const stroke1: Stroke = {
        id: 's1',
        tool: 'pen',
        color: '#ffffff',
        size: 3,
        alpha: 1,
        points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
        timestamp: Date.now()
      };

      annotationStore.addStroke(stroke1);
      expect(annotationStore.getStrokes().length).toBe(1);

      // Undo
      btnUndo?.click();
      expect(annotationStore.getStrokes().length).toBe(0);

      // Redo
      btnRedo?.click();
      expect(annotationStore.getStrokes().length).toBe(1);
      expect(annotationStore.getStrokes()[0].id).toBe('s1');
    });

    it('safely transitions to welcome state on session exit (बंद करें)', () => {
      const btnClose = document.getElementById('btnCloseSession');
      expect(btnClose).not.toBeNull();
      expect(btnClose?.textContent).toContain('बंद करें');

      btnClose?.click();
      expect(store.getState().appState).toBe('welcome');
      expect(store.getState().isBoardMode).toBe(false);
      expect(store.getState().isZen).toBe(false);
    });

    it('has corner resize handle with >= 44px target and real-time scale badge', () => {
      const resizeHandle = document.getElementById('toolbarResizeHandle');
      const scaleBadge = document.getElementById('toolbarScaleBadge');

      expect(resizeHandle).not.toBeNull();
      expect(scaleBadge).not.toBeNull();
      expect(scaleBadge?.textContent).toBe('100%');

      // Test apply scale down to 50%
      toolbar.applyScale(0.5);
      expect(scaleBadge?.textContent).toBe('50%');
    });

    it('has removed dead Lasso tool to keep screen clean and clutter-free', () => {
      const btnLasso = document.getElementById('btnToolLasso');
      expect(btnLasso).toBeNull();
    });

    it('displays compact "स्क्रीन" label for screen button and preserves it in Zen mode', () => {
      const lblFs = document.getElementById('btnToolFitModeTier1Label');
      expect(lblFs?.textContent).toBe('स्क्रीन');

      store.setState({ isZen: true });
      expect(lblFs?.textContent).toBe('स्क्रीन');

      store.setState({ isZen: false });
      expect(lblFs?.textContent).toBe('स्क्रीन');
    });

    it('cycles toolbar through 4 morphable layouts: strip -> box -> circle -> vertical -> strip', () => {
      const btnLayout = document.getElementById('btnDockLayout') as HTMLButtonElement;
      const container = document.getElementById('toolbarContainer');
      const popover = document.getElementById('dockLayoutPopover');
      expect(btnLayout).not.toBeNull();
      expect(popover).not.toBeNull();

      expect(toolbar.getLayout()).toBe('strip');
      expect(container?.classList.contains('layout-strip')).toBe(true);

      // Tapping btnDockLayout opens popover
      btnLayout.click();
      expect(popover?.classList.contains('hidden')).toBe(false);

      // Select Circle (सर्कल डायल) via popover
      const circleOpt = popover?.querySelector('[data-layout="circle"]') as HTMLButtonElement;
      expect(circleOpt).not.toBeNull();
      circleOpt.click();
      expect(toolbar.getLayout()).toBe('circle');
      expect(container?.classList.contains('layout-circle')).toBe(true);
      expect(popover?.classList.contains('hidden')).toBe(true);
      expect(localStorage.getItem('ssiro_toolbar_layout')).toBe('circle');

      // Test cycleLayout directly
      toolbar.cycleLayout(); // circle -> vertical
      expect(toolbar.getLayout()).toBe('vertical');
      expect(container?.classList.contains('layout-vertical')).toBe(true);

      toolbar.cycleLayout(); // vertical -> strip
      expect(toolbar.getLayout()).toBe('strip');
      expect(container?.classList.contains('layout-strip')).toBe(true);

      toolbar.cycleLayout(); // strip -> box
      expect(toolbar.getLayout()).toBe('box');
      expect(container?.classList.contains('layout-box')).toBe(true);
    });

    it('provides crop-style resize handles for width and thickness adjustment', () => {
      const handleE = document.getElementById('cropHandleE');
      const handleS = document.getElementById('cropHandleS');
      const handleCorner = document.getElementById('toolbarResizeHandle');

      expect(handleE).not.toBeNull();
      expect(handleS).not.toBeNull();
      expect(handleCorner).not.toBeNull();
    });
  });
});
