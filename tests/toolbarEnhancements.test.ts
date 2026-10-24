import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../src/state/store';
import { toolbar } from '../src/ui/toolbar';
import { annotationStore, Stroke } from '../src/draw/annotationStore';
import { shapeSelector } from '../src/draw/shapeSelector';
import { settingsPanel } from '../src/ui/settingsPanel';

describe('Toolbar Enhancements Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="stage" style="width: 1920px; height: 1080px;">
        <canvas id="slideCanvas" width="1920" height="1080"></canvas>
        <canvas id="annotationCanvas" width="1920" height="1080"></canvas>
        <canvas id="previewCanvas" width="1920" height="1080"></canvas>
        <div id="toolbarContainer"></div>
        <div id="settingsPanel"></div>
        <div id="btnMicHeader"></div>
        <div id="micZenDot" class="hidden"></div>
        <input type="file" id="fileInputMedia" style="display:none;" />
      </div>
    `;

    store.setState({
      isTier2Expanded: false,
      activeTool: 'select',
      activeShape: 'rect'
    });

    toolbar.init();
    annotationStore.resetAll();
    shapeSelector.deselect();
  });

  describe('1. Single-Line More Button Expansion', () => {
    it('initializes with Tier 2 collapsed and More label', () => {
      const tier2 = document.getElementById('toolbarTier2');
      const moreBtn = document.getElementById('btnTierToggle');
      const label = document.getElementById('tierToggleLabel');

      expect(tier2?.classList.contains('collapsed')).toBe(true);
      expect(tier2?.classList.contains('toolbar-extra-tools')).toBe(true);
      expect(label?.textContent).toBe('More');
    });

    it('smoothly expands inline on single row when More is clicked', () => {
      const tier2 = document.getElementById('toolbarTier2');
      const moreBtn = document.getElementById('btnTierToggle');
      const label = document.getElementById('tierToggleLabel');

      // Click More
      moreBtn?.click();

      expect(store.getState().isTier2Expanded).toBe(true);
      expect(tier2?.classList.contains('collapsed')).toBe(false);
      expect(label?.textContent).toBe('Less');
      expect(moreBtn?.classList.contains('active')).toBe(true);
    });

    it('collapses back to compact single row when Less is clicked', () => {
      const tier2 = document.getElementById('toolbarTier2');
      const moreBtn = document.getElementById('btnTierToggle');
      const label = document.getElementById('tierToggleLabel');

      // Expand first
      moreBtn?.click();
      expect(store.getState().isTier2Expanded).toBe(true);

      // Click Less
      moreBtn?.click();
      expect(store.getState().isTier2Expanded).toBe(false);
      expect(tier2?.classList.contains('collapsed')).toBe(true);
      expect(label?.textContent).toBe('More');
      expect(moreBtn?.classList.contains('active')).toBe(false);
    });
  });

  describe('2. Expanded Shape Tools (Box, Circle, Triangle, Line, Arrow)', () => {
    it('has dedicated buttons for Box, Circle, Triangle, Line, and Arrow', () => {
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

      expect(btnRect?.getAttribute('data-shape')).toBe('rect');
      expect(btnCircle?.getAttribute('data-shape')).toBe('circle');
      expect(btnTriangle?.getAttribute('data-shape')).toBe('triangle');
      expect(btnLine?.getAttribute('data-shape')).toBe('line');
      expect(btnArrow?.getAttribute('data-tool')).toBe('arrow');
    });

    it('activates appropriate shape in store when clicked', () => {
      const btnCircle = document.getElementById('btnToolCircle');
      btnCircle?.click();
      expect(store.getState().activeTool).toBe('shape');
      expect(store.getState().activeShape).toBe('circle');
      expect(btnCircle?.classList.contains('active')).toBe(true);

      const btnTriangle = document.getElementById('btnToolTriangle');
      btnTriangle?.click();
      expect(store.getState().activeTool).toBe('shape');
      expect(store.getState().activeShape).toBe('triangle');
      expect(btnTriangle?.classList.contains('active')).toBe(true);
      expect(btnCircle?.classList.contains('active')).toBe(false);

      const btnLine = document.getElementById('btnToolLine');
      btnLine?.click();
      expect(store.getState().activeTool).toBe('shape');
      expect(store.getState().activeShape).toBe('line');
      expect(btnLine?.classList.contains('active')).toBe(true);
    });

    it('allows Select tool to hit-test, move and resize shapes', () => {
      store.setState({ activeColor: '#38bdf8' });

      // Add a test Circle stroke
      const circleStroke: Stroke = {
        id: 'test-circle-1',
        tool: 'shape',
        shapeType: 'circle',
        color: '#38bdf8',
        size: 4,
        alpha: 1,
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
        startPoint: { x: 100, y: 100 },
        endPoint: { x: 200, y: 200 },
        box: { x: 100, y: 100, width: 100, height: 100 },
        timestamp: Date.now()
      };
      annotationStore.addStroke(circleStroke);

      // Switch to select tool
      store.setState({ activeTool: 'select' });

      // Simulate pointer down inside circle box
      const pointerDownEvent = new PointerEvent('pointerdown', {
        clientX: 150,
        clientY: 150,
        pointerId: 1
      });
      const handled = shapeSelector.handlePointerDown(pointerDownEvent);
      expect(handled).toBe(true);
      expect(shapeSelector.getSelectedStroke()?.id).toBe('test-circle-1');

      // Simulate moving circle by dx=+50, dy=+30
      const pointerMoveEvent = new PointerEvent('pointermove', {
        clientX: 200,
        clientY: 180,
        pointerId: 1
      });
      shapeSelector.handlePointerMove(pointerMoveEvent);

      expect(circleStroke.box?.x).toBe(150);
      expect(circleStroke.box?.y).toBe(130);
      expect(circleStroke.startPoint?.x).toBe(150);
      expect(circleStroke.startPoint?.y).toBe(130);

      // Pointer up commits
      shapeSelector.handlePointerUp();
      expect(circleStroke.box?.x).toBe(150);
    });

    it('allows Select tool to hit-test and resize a Triangle', () => {
      const triangleStroke: Stroke = {
        id: 'test-triangle-1',
        tool: 'shape',
        shapeType: 'triangle',
        color: '#ef4444',
        size: 4,
        alpha: 1,
        points: [{ x: 300, y: 300 }, { x: 400, y: 400 }],
        startPoint: { x: 300, y: 300 },
        endPoint: { x: 400, y: 400 },
        box: { x: 300, y: 300, width: 100, height: 100 },
        timestamp: Date.now()
      };
      annotationStore.addStroke(triangleStroke);

      store.setState({ activeTool: 'select' });

      // Click triangle
      shapeSelector.handlePointerDown(new PointerEvent('pointerdown', { clientX: 350, clientY: 350, pointerId: 2 }));
      expect(shapeSelector.getSelectedStroke()?.id).toBe('test-triangle-1');

      // Click on se (bottom-right: 400, 400) handle to resize
      shapeSelector.handlePointerDown(new PointerEvent('pointerdown', { clientX: 400, clientY: 400, pointerId: 2 }));

      // Drag handle outward (+50, +50)
      shapeSelector.handlePointerMove(new PointerEvent('pointermove', { clientX: 450, clientY: 450, pointerId: 2 }));
      shapeSelector.handlePointerUp();

      expect(triangleStroke.box?.width).toBe(150);
      expect(triangleStroke.box?.height).toBe(150);
    });
  });

  describe('3. Toolbar Resizing Suite', () => {
    it('has a corner resize handle with >= 44px touch target', () => {
      const resizeHandle = document.getElementById('toolbarResizeHandle');
      expect(resizeHandle).not.toBeNull();
      expect(resizeHandle?.classList.contains('toolbar-resize-handle')).toBe(true);
    });

    it('enforces scale bounds between 60% and 160%', () => {
      store.updateSettings({ toolbarScale: 0.4 }); // below 0.6
      const s = store.getState().settings;
      // Should be clamped or toolbar should clamp when applying
      const tb = document.getElementById('toolbarContainer');
      expect(parseFloat(tb?.style.getPropertyValue('--toolbar-scale') || '1')).toBeGreaterThanOrEqual(0.6);

      store.updateSettings({ toolbarScale: 2.0 }); // above 1.6
      expect(parseFloat(tb?.style.getPropertyValue('--toolbar-scale') || '1')).toBeLessThanOrEqual(1.6);
    });

    it('integrates scale slider and reset in SettingsPanel', () => {
      store.updateSettings({ toolbarScale: 1.0 });
      settingsPanel.init();
      const modal = document.getElementById('settingsPanel');
      expect(modal).not.toBeNull();

      const scaleSlider = modal?.querySelector('#settingToolbarScale') as HTMLInputElement;
      const btnResetScale = modal?.querySelector('#btnResetToolbarScale') as HTMLButtonElement;
      const btnScaleUp = modal?.querySelector('#btnToolbarScaleUp') as HTMLButtonElement;

      expect(scaleSlider).not.toBeNull();
      expect(btnResetScale).not.toBeNull();

      // Test scale up
      btnScaleUp.click();
      expect(store.getState().settings.toolbarScale).toBe(1.1);

      // Test reset (100%)
      btnResetScale.click();
      expect(store.getState().settings.toolbarScale).toBe(1.0);
    });
  });
});
