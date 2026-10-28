import { test, expect } from '@playwright/test';
import { loadTestDeck } from './helpers';

test.describe('Board Canvas Drawing Engine & Toolbar Unification Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadTestDeck(page, 1);
  });

  test('1. Board Mode: Freehand pen writing stays smooth, strokes do not disappear, and no auto-line/shape snapping', async ({ page }) => {
    // Open Board mode
    await page.evaluate(() => {
      (window as any).__SMART_STUDIO_BLACKBOARD__?.openBoard();
    });
    await page.waitForTimeout(300);

    // Verify board mode is active and board dock is visible
    const isBoard = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState().isBoardMode);
    expect(isBoard).toBe(true);

    const boardDock = page.locator('#boardDock');
    await expect(boardDock).toBeVisible();

    // Select Pen tool inside board dock
    const btnPen = page.locator('#btnToolPen');
    await expect(btnPen).toBeVisible();
    await btnPen.click();
    await page.waitForTimeout(100);

    const activeTool = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState().activeTool);
    expect(activeTool).toBe('pen');

    // Draw multiple freehand strokes on the Board canvas
    const stage = page.locator('#stage');
    const stageBox = await stage.boundingBox();
    expect(stageBox).not.toBeNull();

    // Stroke 1: curved freehand handwriting-like stroke
    await page.mouse.move(stageBox!.x + 200, stageBox!.y + 200);
    await page.mouse.down();
    await page.mouse.move(stageBox!.x + 220, stageBox!.y + 230, { steps: 3 });
    await page.mouse.move(stageBox!.x + 250, stageBox!.y + 220, { steps: 3 });
    await page.mouse.move(stageBox!.x + 280, stageBox!.y + 260, { steps: 4 });
    await page.mouse.move(stageBox!.x + 320, stageBox!.y + 210, { steps: 3 });
    await page.mouse.up();

    // Wait past Smart Ink idle timer (500ms) to ensure NO auto-straightening or deletion occurs
    await page.waitForTimeout(600);

    let strokes = await page.evaluate(() => (window as any).__SMART_STUDIO_ANNOTATION_STORE__?.getStrokes());
    expect(strokes.length).toBe(1);
    expect(strokes[0].tool).toBe('pen');
    // Must NOT be converted to geometric shapes or lines
    expect(strokes[0].shapeType).toBeUndefined();
    expect(strokes[0].points.length).toBeGreaterThanOrEqual(10);

    // Stroke 2: fast stroke across canvas to verify pointer capture and no event drops
    await page.mouse.move(stageBox!.x + 400, stageBox!.y + 300);
    await page.mouse.down();
    await page.mouse.move(stageBox!.x + 600, stageBox!.y + 350, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(600);

    strokes = await page.evaluate(() => (window as any).__SMART_STUDIO_ANNOTATION_STORE__?.getStrokes());
    expect(strokes.length).toBe(2);
    // Both strokes must be retained in state array
    expect(strokes[0].tool).toBe('pen');
    expect(strokes[1].tool).toBe('pen');
    expect(strokes[1].shapeType).toBeUndefined();

    // Verify touchAction is 'none' on annotationCanvas
    const touchAction = await page.evaluate(() => {
      const el = document.getElementById('annotationCanvas');
      return el ? window.getComputedStyle(el).touchAction : '';
    });
    expect(touchAction).toBe('none');
  });

  test('2. 100% Unified Toolbar: All PPT tools available, identical swatches & properties persist across modes', async ({ page }) => {
    // Check initial PPT mode toolbar tools
    const toolbar = page.locator('#toolbarContainer');
    await expect(toolbar).toBeVisible();

    // Verify PPT mode has Select, Pen, Highlighter, Eraser, Lens, Undo, Clear, Mic, More
    await expect(page.locator('#btnToolSelect')).toBeVisible();
    await expect(page.locator('#btnToolPen')).toBeVisible();
    await expect(page.locator('#btnToolHighlighter')).toBeVisible();
    await expect(page.locator('#btnToolEraser')).toBeVisible();
    await expect(page.locator('#btnToolMagnifier')).toBeVisible();
    await expect(page.locator('#btnUndo')).toBeVisible();
    await expect(page.locator('#btnClearAll')).toBeVisible();
    await expect(page.locator('#btnToolMic')).toBeVisible();
    await expect(page.locator('#btnTierToggle')).toBeVisible();

    // Set custom stroke properties in PPT mode
    await page.locator('#btnToolHighlighter').click();
    await page.evaluate(() => {
      (window as any).__SMART_STUDIO_STORE__?.setState({
        activeColor: '#38bdf8',
        highlighterWidth: 44,
        penSize: 8
      });
    });
    await page.waitForTimeout(100);

    // Switch to Board mode
    await page.evaluate(() => {
      (window as any).__SMART_STUDIO_BLACKBOARD__?.openBoard();
    });
    await page.waitForTimeout(300);

    const isBoard = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState().isBoardMode);
    expect(isBoard).toBe(true);

    // In Board mode, the unified toolbar must be mounted inside #boardDockCenter
    const boardCenter = page.locator('#boardDockCenter');
    await expect(boardCenter).toBeVisible();

    // Every single tool must be present and visible inside board dock
    await expect(page.locator('#boardDock #btnToolSelect')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolPen')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolHighlighter')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolEraser')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolMagnifier')).toBeVisible();
    await expect(page.locator('#boardDock #btnUndo')).toBeVisible();
    await expect(page.locator('#boardDock #btnClearAll')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolMic')).toBeVisible();
    await expect(page.locator('#boardDock #btnTierToggle')).toBeVisible();

    // Verify stroke properties persisted seamlessly into Board mode
    let state = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState());
    expect(state.activeTool).toBe('highlighter');
    expect(state.activeColor).toBe('#38bdf8');
    expect(state.highlighterWidth).toBe(44);
    expect(state.penSize).toBe(8);

    // Expand Tier 2 in Board mode
    await page.locator('#boardDock #btnTierToggle').click();
    await page.waitForTimeout(200);

    // Verify Tier 2 tools are present and functional in Board mode
    await expect(page.locator('#boardDock #btnToolRect')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolCircle')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolTriangle')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolLine')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolArrow')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolZoom')).toBeVisible();
    await expect(page.locator('#boardDock #btnToolHandwriting')).toBeVisible();
    await expect(page.locator('#boardDock #btnMediaOverlay')).toBeVisible();
    await expect(page.locator('#boardDock #btnBrowserOverlay')).toBeVisible();
    await expect(page.locator('#boardDock #btnGemini')).toBeVisible();
    await expect(page.locator('#boardDock #btnSettings')).toBeVisible();
    await expect(page.locator('#boardDock #btnFullscreen')).toBeVisible();

    // Select Rectangle Shape tool inside Board mode
    await page.locator('#boardDock #btnToolRect').click();
    await page.waitForTimeout(100);

    state = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState());
    expect(state.activeTool).toBe('shape');
    expect(state.activeShape).toBe('rect');

    // Select Purple swatch in Board mode
    const purpleSwatch = page.locator('#boardDock [data-color="#a855f7"]');
    await purpleSwatch.click();
    await page.waitForTimeout(100);

    state = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState());
    expect(state.activeColor).toBe('#a855f7');

    // Switch theme pills on left
    const navyThemePill = page.locator('#boardDock [data-theme="navy"]');
    await navyThemePill.click();
    await page.waitForTimeout(200);

    state = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState());
    expect(state.boardTheme).toBe('navy');
    // User color must be preserved
    expect(state.activeColor).toBe('#a855f7');

    // Close Board mode using Close button
    const btnClose = page.locator('#btnBoardClose');
    await expect(btnClose).toBeVisible();
    await btnClose.click();
    await page.waitForTimeout(300);

    // Verify returned to PPT mode
    const isBoardAfter = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState().isBoardMode);
    expect(isBoardAfter).toBe(false);

    // Toolbar is restored in floating #toolbarContainer with identical properties
    await expect(toolbar).toBeVisible();
    state = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState());
    expect(state.activeTool).toBe('shape');
    expect(state.activeShape).toBe('rect');
    expect(state.activeColor).toBe('#a855f7');
    expect(state.highlighterWidth).toBe(44);
    expect(state.penSize).toBe(8);
  });
});
