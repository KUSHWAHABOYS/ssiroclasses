import { test, expect } from '@playwright/test';
import { loadTestDeck } from './helpers';

test.describe('In-App Browser Embed & Toolbar Direct Pan Verification', () => {
  test('1. In-App Browser: Google & external sites embed directly without X-Frame-Options fallback block', async ({ page }) => {
    await page.goto('/');
    await loadTestDeck(page, 1);

    // Expand toolbar Tier 2 and open browser
    const btnMore = page.locator('#btnTierToggle');
    await btnMore.click();
    await page.locator('#btnBrowserOverlay').click();

    const webOverlay = page.locator('#webOverlay');
    await expect(webOverlay).toBeVisible();

    // Verify fallback card is NOT shown (no X-Frame-Options block)
    const fallbackCard = page.locator('#webFallbackCard');
    await expect(fallbackCard).toHaveClass(/hidden/);

    // Verify iframe has loaded Google directly
    const iframe = page.locator('#webIframe');
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute('src');
    expect(src).toContain('google.com');

    // Test navigating to external website (e.g., wikipedia.org)
    const urlInput = page.locator('#webUrlInput');
    await urlInput.fill('https://en.wikipedia.org');
    await page.locator('#btnWebGo').click();
    await page.waitForTimeout(300);

    // Verify target routes via proxy stripping framing headers
    const newSrc = await iframe.getAttribute('src');
    expect(newSrc).toContain('/api/proxy?url=');

    // Fallback card remains hidden
    await expect(fallbackCard).toHaveClass(/hidden/);

    // Close overlay
    await page.locator('#btnWebClose').click();
    await expect(webOverlay).toHaveClass(/hidden/);
  });

  test('2. Toolbar Clean-up: Zero bottom scrollbars, resize handle hidden, and smooth direct pan/scroll', async ({ page }) => {
    await page.goto('/');
    await loadTestDeck(page, 1);

    // Expand Tier 2 so toolbar content overflows
    const btnMore = page.locator('#btnTierToggle');
    await btnMore.click();

    const contentEl = page.locator('#toolbarContent');
    await expect(contentEl).toBeVisible();

    // Verify scrollbar is completely hidden via computed style
    const scrollbarStyle = await contentEl.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        scrollbarWidth: cs.scrollbarWidth,
        overflowX: cs.overflowX
      };
    });
    expect(scrollbarStyle.scrollbarWidth).toBe('none');
    expect(scrollbarStyle.overflowX).toBe('auto');

    // Verify resize handle is hidden (no bottom drag clutter)
    const resizeHandle = page.locator('#toolbarResizeHandle');
    await expect(resizeHandle).toBeHidden();

    // Verify initial scrollLeft is 0
    const initialScrollLeft = await contentEl.evaluate((el) => el.scrollLeft);
    expect(initialScrollLeft).toBe(0);

    // Test Direct Pan: Drag horizontally across toolbar
    const contentBox = await contentEl.boundingBox();
    expect(contentBox).not.toBeNull();

    const startX = contentBox!.x + contentBox!.width - 50;
    const startY = contentBox!.y + contentBox!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 200, startY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const scrolledLeft = await contentEl.evaluate((el) => el.scrollLeft);
    expect(scrolledLeft).toBeGreaterThan(50);

    // Verify direct tap selects tool without conflict
    const btnPen = page.locator('#btnToolPen');
    await btnPen.click();
    const activeTool = await page.evaluate(() => (window as any).__SMART_STUDIO_STORE__?.getState().activeTool);
    expect(activeTool).toBe('pen');
  });
});

