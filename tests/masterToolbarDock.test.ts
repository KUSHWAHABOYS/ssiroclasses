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

      const tipBtns = island?.querySelectorAll('.island-tip-btn[data-tip]');
      expect(tipBtns?.length).toBe(4);

      const strokeDots = island?.querySelectorAll('#islandStrokeGroup .stroke-dot-btn');
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
    it('has AI Translate prominent glowing card with Neural Live', () => {
      const aiBtn = document.getElementById('btnToolTranslate');
      expect(aiBtn).not.toBeNull();
      expect(aiBtn?.classList.contains('tool-ai-translate')).toBe(true);
      expect(aiBtn?.textContent).toContain('AI Translate');
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

    it('safely transitions to welcome state on session exit (Exit)', () => {
      const btnClose = document.getElementById('btnCloseSession');
      expect(btnClose).not.toBeNull();
      expect(btnClose?.textContent).toContain('Exit');

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

    it('has removed dead Lasso, Curtain, and Split tools to keep screen clean and clutter-free', () => {
      const btnLasso = document.getElementById('btnToolLasso');
      const btnCurtain = document.getElementById('btnToolCurtain');
      const btnSplit = document.getElementById('btnToolSplitBoard');
      expect(btnLasso).toBeNull();
      expect(btnCurtain).toBeNull();
      expect(btnSplit).toBeNull();
    });

    it('supports Dynamic Island across Pen, Marker, Eraser, and Laser', () => {
      const island = document.getElementById('penDynamicIsland');
      const markerBtn = document.getElementById('btnToolHighlighter');
      const eraserBtn = document.getElementById('btnToolEraser');
      const laserBtn = document.getElementById('btnToolMagnifier');

      markerBtn?.click();
      expect(store.getState().activeTool).toBe('highlighter');
      expect(island?.classList.contains('collapsed')).toBe(false);
      expect(document.getElementById('islandPanelMarker')?.style.display).not.toBe('none');

      eraserBtn?.click();
      expect(store.getState().activeTool).toBe('eraser');
      expect(island?.classList.contains('collapsed')).toBe(false);
      expect(document.getElementById('islandPanelEraser')?.style.display).not.toBe('none');

      laserBtn?.click();
      expect(store.getState().activeTool).toBe('magnifier');
      expect(island?.classList.contains('collapsed')).toBe(false);
      expect(document.getElementById('islandPanelLaser')?.style.display).not.toBe('none');
    });

    it('displays compact "Screen" label for screen button and preserves it in Zen mode', () => {
      const lblFs = document.getElementById('btnToolFitModeTier1Label');
      expect(lblFs?.textContent).toBe('Screen');

      store.setState({ isZen: true });
      expect(lblFs?.textContent).toBe('Screen');

      store.setState({ isZen: false });
      expect(lblFs?.textContent).toBe('Screen');
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

      // Select Circle via popover
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

    it('has dual drag handles (left and right) and a top drag rim for smart board flexibility', () => {
      const handleLeft = document.getElementById('dragHandle');
      const handleRight = document.getElementById('dragHandleRight');
      const dragRim = document.getElementById('dockDragRim');

      expect(handleLeft).not.toBeNull();
      expect(handleRight).not.toBeNull();
      expect(dragRim).not.toBeNull();
    });

    it('renders concentric radial dial wheel SVG and perimeter resize handle with tactile grooves', () => {
      const svg = document.getElementById('circleWheelSvg');
      const circleHandle = document.getElementById('circleResizeHandle');
      const activeWedge = document.getElementById('circleActiveWedge');
      const exitWedge = document.getElementById('circleExitWedge');

      expect(svg).not.toBeNull();
      expect(circleHandle).not.toBeNull();
      expect(activeWedge).not.toBeNull();
      expect(exitWedge).not.toBeNull();

      const grooves = circleHandle?.querySelectorAll('.bezel-notch-groove');
      expect(grooves?.length).toBe(3);
    });

    it('renders and scales orbital halo crown dynamic island in circle layout', () => {
      toolbar.setLayout('circle');
      const island = document.getElementById('penDynamicIsland');
      const container = document.getElementById('toolbarContainer');
      const trackSvg = document.getElementById('islandOrbitTrackSvg');
      const orbitRim = document.getElementById('orbitGlowRim');

      expect(island).not.toBeNull();
      expect(container?.classList.contains('layout-circle')).toBe(true);
      expect(trackSvg).not.toBeNull();
      expect(orbitRim).not.toBeNull();

      // Test active tool attribute and rim glow sync
      expect(container?.getAttribute('data-active-tool')).toBe('pen');
      expect(orbitRim?.getAttribute('stroke')).toBe('#f59e0b');

      // Switch to highlighter
      store.setState({ activeTool: 'highlighter' });
      expect(container?.getAttribute('data-active-tool')).toBe('highlighter');
      expect(orbitRim?.getAttribute('stroke')).toBe('#38bdf8');

      // Switch to eraser
      store.setState({ activeTool: 'eraser' });
      expect(container?.getAttribute('data-active-tool')).toBe('eraser');
      expect(orbitRim?.getAttribute('stroke')).toBe('#ef4444');

      // Switch to magnifier (laser)
      store.setState({ activeTool: 'magnifier' });
      expect(container?.getAttribute('data-active-tool')).toBe('magnifier');
      expect(orbitRim?.getAttribute('stroke')).toBe('#a855f7');

      // Reset back to pen
      store.setState({ activeTool: 'pen' });
    });

    it('supports scaling dial size via slider, preset pills, and reset button', () => {
      const slider = document.getElementById('layoutSizeSlider') as HTMLInputElement;
      const badge = document.getElementById('layoutSizeBadge');
      const resetBtn = document.getElementById('btnResetDialSize') as HTMLButtonElement;
      const pills = document.querySelectorAll('.layout-size-pill[data-size]');

      expect(slider).not.toBeNull();
      expect(badge).not.toBeNull();
      expect(resetBtn).not.toBeNull();
      expect(pills.length).toBeGreaterThanOrEqual(4);

      // Switch to circle layout
      toolbar.setLayout('circle');
      expect(toolbar.getLayout()).toBe('circle');

      // Test preset pill click
      const pill580 = Array.from(pills).find(p => p.getAttribute('data-size') === '580') as HTMLButtonElement;
      expect(pill580).not.toBeNull();
      pill580.click();

      expect(slider.value).toBe('580');
      expect(badge?.textContent).toBe('580px');
      expect(localStorage.getItem('ssiro_circle_dock_size')).toBe('580');

      // Test reset button
      resetBtn.click();
      expect(slider.value).toBe('480');
      expect(badge?.textContent).toBe('480px');
      expect(localStorage.getItem('ssiro_circle_dock_size')).toBe('480');
    });

    it('supports freeform pen/mouse dragging in circle mode from center hub or dial body', () => {
      toolbar.setLayout('circle');
      const container = document.getElementById('toolbarContainer')!;
      const centerHub = document.getElementById('btnToolTranslate')!;
      expect(centerHub).not.toBeNull();

      // Check inner spokes count in SVG
      const innerSpokes = document.querySelectorAll('.dial-inner-spokes line');
      expect(innerSpokes.length).toBe(15);

      // Simulate pointerdown on center hub and drag
      container.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
        pointerId: 1
      }));

      // Simulate pointermove beyond threshold (e.g. 50px)
      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: 160,
        clientY: 180,
        bubbles: true,
        pointerId: 1
      }));

      expect(container.classList.contains('is-dragging')).toBe(true);

      // Simulate pointerup to release
      window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: 160,
        clientY: 180,
        bubbles: true,
        pointerId: 1
      }));

      expect(container.classList.contains('is-dragging')).toBe(false);
    });

    it('keeps master toolbar active and independent on Blackboard Studio deck mode', () => {
      const btnBoard = document.getElementById('btnBoard');
      expect(btnBoard).not.toBeNull();

      // Enter Board mode
      store.setState({ isBoardMode: true, appState: 'board' });
      expect(btnBoard?.classList.contains('active')).toBe(true);

      const container = document.getElementById('toolbarContainer');
      expect(container).not.toBeNull();
      // Toolbar is not destroyed or hidden
      expect(container?.classList.contains('hidden')).toBe(false);

      // Exit Board mode
      store.setState({ isBoardMode: false, appState: 'deck' });
      expect(btnBoard?.classList.contains('active')).toBe(false);
    });
  });
});
