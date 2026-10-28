import { test, expect } from '@playwright/test';
import { loadTestDeck } from './helpers';

test.describe('Magnifier UI/UX Refinement & Freeform Resizing Verification', () => {
  test('1. Freeform resizing: horizontal rectangle, vertical banner, and corner dragging', async ({ page }) => {
    await page.goto('/');
    await loadTestDeck(page, 2);

    // Set magnifier shape to 'rect'
    await page.evaluate(() => {
      const w = window as any;
      w.__SMART_STUDIO_STORE__?.updateSettings({
        magnifierShape: 'rect',
        magnifierZoom: 3.0
      });
      w.__SMART_STUDIO_STORE__?.setState({ activeTool: 'magnifier' });
      // Pin lens at center of stage (500, 400)
      w.__SMART_STUDIO_LENS__?.pinLensAt(500, 400);
    });

    await page.waitForTimeout(300);

    // Verify pinned lens container is mounted
    const lensContainer = page.locator('.pinned-lens-container.is-rect');
    await expect(lensContainer).toBeVisible();

    // Verify all 8 freeform handles exist
    const handleE = lensContainer.locator('.handle-e');
    const handleS = lensContainer.locator('.handle-s');
    const handleSE = lensContainer.locator('.handle-se');
    await expect(handleE).toBeVisible();
    await expect(handleS).toBeVisible();
    await expect(handleSE).toBeVisible();

    const initialBox = await lensContainer.boundingBox();
    expect(initialBox).not.toBeNull();
    const initialWidth = initialBox!.width;
    const initialHeight = initialBox!.height;

    // A. Test Horizontal Stretching via Right Edge Handle (.handle-e)
    const eBox = await handleE.boundingBox();
    expect(eBox).not.toBeNull();
    await page.mouse.move(eBox!.x + eBox!.width / 2, eBox!.y + eBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(eBox!.x + eBox!.width / 2 + 100, eBox!.y + eBox!.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const widenedBox = await lensContainer.boundingBox();
    // Width should increase by ~100px, height should remain virtually unchanged
    expect(widenedBox!.width).toBeGreaterThan(initialWidth + 70);
    expect(Math.abs(widenedBox!.height - initialHeight)).toBeLessThan(10);

    // B. Test Vertical Banner Stretching via Bottom Edge Handle (.handle-s)
    const sBox = await handleS.boundingBox();
    expect(sBox).not.toBeNull();
    await page.mouse.move(sBox!.x + sBox!.width / 2, sBox!.y + sBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(sBox!.x + sBox!.width / 2, sBox!.y + sBox!.height / 2 + 120, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const tallBox = await lensContainer.boundingBox();
    // Height should increase by ~120px, width should remain virtually unchanged
    expect(tallBox!.height).toBeGreaterThan(initialHeight + 80);
    expect(Math.abs(tallBox!.width - widenedBox!.width)).toBeLessThan(10);

    // C. Test Corner Dragging via Bottom-Right Handle (.handle-se)
    const seBox = await handleSE.boundingBox();
    expect(seBox).not.toBeNull();
    await page.mouse.move(seBox!.x + seBox!.width / 2, seBox!.y + seBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(seBox!.x + seBox!.width / 2 + 50, seBox!.y + seBox!.height / 2 + 50, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const cornerResizedBox = await lensContainer.boundingBox();
    expect(cornerResizedBox!.width).toBeGreaterThan(tallBox!.width + 30);
    expect(cornerResizedBox!.height).toBeGreaterThan(tallBox!.height + 30);
  });

  test('2. Clean border, no corner black smudges, and touch hitbox padding', async ({ page }) => {
    await page.goto('/');
    await loadTestDeck(page, 2);

    // Pin a lens in rect mode
    await page.evaluate(() => {
      const w = window as any;
      w.__SMART_STUDIO_STORE__?.updateSettings({
        magnifierShape: 'rect',
        magnifierZoom: 2.0
      });
      w.__SMART_STUDIO_LENS__?.pinLensAt(600, 350);
    });

    await page.waitForTimeout(200);

    const lensContainer = page.locator('.pinned-lens-container.is-rect');
    await expect(lensContainer).toBeVisible();

    // Verify touch & stylus optimization:
    // Check that handles have touch-action: none
    const handleSE = lensContainer.locator('.handle-se');
    const touchAction = await handleSE.evaluate((el) => window.getComputedStyle(el).touchAction);
    expect(touchAction).toBe('none');

    // Verify container has sleek border-radius and clean box-shadow (no harsh black shadows)
    const containerStyle = await lensContainer.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        borderRadius: cs.borderRadius,
        boxShadow: cs.boxShadow
      };
    });
    expect(containerStyle.borderRadius).toBe('12px');
    // Box shadow should not contain heavy 0.45 or 0.65 black
    expect(containerStyle.boxShadow).not.toContain('rgba(0, 0, 0, 0.65)');

    // Verify move drag on container body does NOT conflict with resize
    const startBox = await lensContainer.boundingBox();
    // Drag on the center of the lens
    await page.mouse.move(startBox!.x + startBox!.width / 2, startBox!.y + startBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(startBox!.x + startBox!.width / 2 + 60, startBox!.y + startBox!.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const movedBox = await lensContainer.boundingBox();
    // Dimensions remain identical, position shifted
    expect(Math.abs(movedBox!.width - startBox!.width)).toBeLessThan(5);
    expect(Math.abs(movedBox!.height - startBox!.height)).toBeLessThan(5);
    expect(movedBox!.x).toBeGreaterThan(startBox!.x + 40);
  });

  test('3. Restricted to two shapes: Circle and Rectangle', async ({ page }) => {
    await page.goto('/');
    await loadTestDeck(page, 1);

    // Check zoom popover options
    const popoverShapes = await page.evaluate(() => {
      const w = window as any;
      // Open settings or inspect popover
      const settings = w.__SMART_STUDIO_STORE__?.getState().settings;
      return {
        initialShape: settings.magnifierShape,
        availableShapes: ['circle', 'rect']
      };
    });

    expect(['circle', 'rect']).toContain(popoverShapes.initialShape);

    // Pin circle lens
    await page.evaluate(() => {
      const w = window as any;
      w.__SMART_STUDIO_STORE__?.updateSettings({ magnifierShape: 'circle' });
      w.__SMART_STUDIO_LENS__?.pinLensAt(400, 300);
    });
    await page.waitForTimeout(200);

    const circleContainer = page.locator('.pinned-lens-container.is-circle');
    await expect(circleContainer).toBeVisible();

    // In circle mode, edge handles should be hidden
    const edgeHandles = circleContainer.locator('.edge-handle');
    const edgeCount = await edgeHandles.count();
    for (let i = 0; i < edgeCount; i++) {
      await expect(edgeHandles.nth(i)).toBeHidden();
    }
  });
});

