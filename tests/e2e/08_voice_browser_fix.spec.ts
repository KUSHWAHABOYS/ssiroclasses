import { test, expect } from '@playwright/test';
import { loadTestDeck } from './helpers';

test.describe('Voice Command & Browser Redirection Fix Verification', () => {
  test('1. Voice commands Page Next, Page Back, Slide Next, Slide Back navigate pages when mic is on', async ({ page }) => {
    await page.goto('/');
    await loadTestDeck(page, 4);
    await expect(page.locator('body')).toHaveClass(/state-deck/);

    // Ensure voice service is initialized
    await page.waitForFunction(() => !!(window as any).__SMART_STUDIO_VOICE__);

    // Initial page is 1
    const pageCounter = page.locator('#pageCounter');
    await expect(pageCounter).toContainText('1 / 4');

    // Turn mic ON programmatically via controller
    await page.evaluate(() => {
      const w = window as any;
      if (w.__SMART_STUDIO_MIC__) {
        w.__SMART_STUDIO_MIC__.updateState('listening', false);
      }
    });

    // Verify mic is listening
    const isMicListening = await page.evaluate(() => {
      return (window as any).__SMART_STUDIO_MIC__?.getState() === 'listening';
    });
    expect(isMicListening).toBe(true);

    // 1. Test "Page Next"
    const nextSuccess1 = await page.evaluate(() => {
      const w = window as any;
      return w.__SMART_STUDIO_VOICE__?.processVoiceCommand('Page Next');
    });
    expect(nextSuccess1).toBe(true);
    await page.waitForTimeout(300);
    await expect(pageCounter).toContainText('2 / 4');

    // Verify mic remains ON after slide change (doesn't get muted)
    const micStillOn = await page.evaluate(() => {
      return (window as any).__SMART_STUDIO_MIC__?.getState() === 'listening';
    });
    expect(micStillOn).toBe(true);

    // 2. Test "Slide Next"
    const nextSuccess2 = await page.evaluate(() => {
      const w = window as any;
      return w.__SMART_STUDIO_VOICE__?.processVoiceCommand('Slide Next');
    });
    expect(nextSuccess2).toBe(true);
    await page.waitForTimeout(300);
    await expect(pageCounter).toContainText('3 / 4');

    // 3. Test Hindi "पेज नेक्स्ट"
    const nextSuccessHindi = await page.evaluate(() => {
      const w = window as any;
      return w.__SMART_STUDIO_VOICE__?.processVoiceCommand('पेज नेक्स्ट');
    });
    expect(nextSuccessHindi).toBe(true);
    await page.waitForTimeout(300);
    await expect(pageCounter).toContainText('4 / 4');

    // 4. Test "Page Back"
    const backSuccess1 = await page.evaluate(() => {
      const w = window as any;
      return w.__SMART_STUDIO_VOICE__?.processVoiceCommand('Page Back');
    });
    expect(backSuccess1).toBe(true);
    await page.waitForTimeout(300);
    await expect(pageCounter).toContainText('3 / 4');

    // 5. Test "Slide Back"
    const backSuccess2 = await page.evaluate(() => {
      const w = window as any;
      return w.__SMART_STUDIO_VOICE__?.processVoiceCommand('Slide Back');
    });
    expect(backSuccess2).toBe(true);
    await page.waitForTimeout(300);
    await expect(pageCounter).toContainText('2 / 4');

    // 6. Test Hindi "पेज बैक"
    const backSuccessHindi = await page.evaluate(() => {
      const w = window as any;
      return w.__SMART_STUDIO_VOICE__?.processVoiceCommand('पेज बैक');
    });
    expect(backSuccessHindi).toBe(true);
    await page.waitForTimeout(300);
    await expect(pageCounter).toContainText('1 / 4');

    // 7. Test trigger events: window.dispatchEvent(new CustomEvent('voice-command', ...))
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('voice-command', { detail: { phrase: 'next page' } }));
    });
    await page.waitForTimeout(300);
    await expect(pageCounter).toContainText('2 / 4');

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('voice-command', { detail: { phrase: 'previous page' } }));
    });
    await page.waitForTimeout(300);
    await expect(pageCounter).toContainText('1 / 4');
  });

  test('2. Browser overlay default URL is https://www.google.com and toolbar button opens Google', async ({ page }) => {
    await page.goto('/');
    await loadTestDeck(page, 2);

    // Expand toolbar Tier 2 via More button (#btnTierToggle)
    const btnMore = page.locator('#btnTierToggle');
    await expect(btnMore).toBeVisible();
    await btnMore.click();

    // Browser button in Tier 2 is now visible
    const btnBrowser = page.locator('#btnBrowserOverlay');
    await expect(btnBrowser).toBeVisible();
    await btnBrowser.click();

    // Verify browser overlay opens
    const webOverlay = page.locator('#webOverlay');
    await expect(webOverlay).toBeVisible();
    await expect(webOverlay).not.toHaveClass(/hidden/);

    // Verify input URL value is https://www.google.com (Google, NOT Wikipedia)
    const urlInput = page.locator('#webUrlInput');
    await expect(urlInput).toHaveValue('https://www.google.com');

    // Verify iframe src contains https://www.google.com
    const iframe = page.locator('#webIframe');
    const src = await iframe.getAttribute('src');
    expect(src).toContain('https://www.google.com');

    // Close overlay
    await page.locator('#btnWebClose').click();
    await expect(webOverlay).toHaveClass(/hidden/);
  });
});
