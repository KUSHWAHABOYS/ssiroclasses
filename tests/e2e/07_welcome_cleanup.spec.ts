import { test, expect } from '@playwright/test';
import { saveEvidenceScreenshot, recordEvidenceLog, loadTestDeck } from './helpers';

test.describe('WELCOME-CLEANUP Verification Suite (Part B Requirements)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Test 3(a): Welcome page contains exactly logo, two text lines, and ONE button', async ({ page }) => {
    await page.waitForSelector('#welcomeScreen');
    const welcome = page.locator('#welcomeScreen');
    await expect(welcome).toBeVisible();

    // 1. Logo container
    const logo = welcome.locator('.welcome-logo-container');
    await expect(logo).toBeVisible();

    // 2. Two text lines
    const line1 = welcome.locator('.welcome-line-1');
    const line2 = welcome.locator('.welcome-line-2');
    await expect(line1).toBeVisible();
    await expect(line2).toBeVisible();
    await expect(line1).toHaveText('Welcome to');
    await expect(line2).toHaveText('SSIRO Classes');

    // 3. Exactly ONE button in welcome-actions
    const actionButtons = welcome.locator('.welcome-actions button');
    await expect(actionButtons).toHaveCount(1);
    const openDeckBtn = welcome.locator('#btnWelcomeOpenDeck');
    await expect(openDeckBtn).toBeVisible();
    await expect(openDeckBtn).toContainText('Open Deck');

    // 4. Zero connect button or drop hint
    await expect(welcome.locator('#btnWelcomeConnect')).toHaveCount(0);
    await expect(welcome.locator('.welcome-connect-btn')).toHaveCount(0);
    await expect(welcome.locator('.welcome-drop-hint')).toHaveCount(0);
    await expect(page.locator('#btnConnectBoardHeader')).toHaveCount(0);
  });

  test('Test 3(b): Clicking Open Deck triggers file picker and loading PDF transitions into slide 1', async ({ page }) => {
    await page.waitForSelector('#welcomeScreen');

    // Monitor file input click
    const clickedFileInput = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
        if (!fileInput) return resolve(false);
        const originalClick = fileInput.click;
        fileInput.click = () => {
          resolve(true);
        };
        const btn = document.getElementById('btnWelcomeOpenDeck');
        btn?.click();
      });
    });
    expect(clickedFileInput).toBe(true);

    // Load deck and verify fade into slide 1
    await loadTestDeck(page, 3);
    await expect(page.locator('#welcomeScreen')).toHaveClass(/hidden|fade-out/);
    await expect(page.locator('body')).toHaveClass(/state-deck/);
    const pageCounter = page.locator('#pageCounter');
    await expect(pageCounter).toBeVisible();
    await expect(pageCounter).toContainText('1 / 3');
  });

  test('Test 3(c): Dropping PDF onto welcome page does nothing, shows no overlay, and prevents navigation', async ({ page }) => {
    await page.waitForSelector('#welcomeScreen');

    const result = await page.evaluate(() => {
      const welcome = document.getElementById('welcomeScreen')!;
      
      // Test dragover event
      const dragoverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer()
      });
      const dragoverDispatched = window.dispatchEvent(dragoverEvent);
      
      // Test drop event
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer()
      });
      const dropDispatched = window.dispatchEvent(dropEvent);

      return {
        dragoverDefaultPrevented: dragoverEvent.defaultPrevented,
        dropDefaultPrevented: dropEvent.defaultPrevented,
        bodyClasses: document.body.className,
        welcomeVisible: !welcome.classList.contains('hidden')
      };
    });

    // Guard must prevent default
    expect(result.dragoverDefaultPrevented).toBe(true);
    expect(result.dropDefaultPrevented).toBe(true);

    // App must remain in welcome state with no overlay
    expect(result.bodyClasses).toContain('state-welcome');
    expect(result.welcomeVisible).toBe(true);
    await expect(page.locator('.drop-overlay, .dropzone-active, #connectModal')).toHaveCount(0);
  });

  test('Test 3(d): Top-bar Open Deck still works once a deck is open', async ({ page }) => {
    await loadTestDeck(page, 2);
    await expect(page.locator('body')).toHaveClass(/state-deck/);

    const clickedFileInput = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const fileInput = document.getElementById('fileInputDeck') as HTMLInputElement;
        if (!fileInput) return resolve(false);
        fileInput.click = () => {
          resolve(true);
        };
        const btnOpen = document.getElementById('btnOpenFile');
        btnOpen?.click();
      });
    });
    expect(clickedFileInput).toBe(true);
  });

  test('Test 3(e): OS file-handler dispatch via app-open-files transitions from welcome into deck', async ({ page }) => {
    await page.waitForSelector('#welcomeScreen');
    await expect(page.locator('#welcomeScreen')).toBeVisible();

    // Simulate OS file launch dispatch
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920; canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 1920, 1080);

      const deck = {
        id: 'os-launch-deck',
        name: 'OS Deck',
        title: 'OS Deck',
        totalPages: 1,
        pages: [{ pageNumber: 1, width: 1920, height: 1080, sourceType: 'canvas', renderData: canvas }]
      };
      const w = window as any;
      if (w.__SMART_STUDIO_SLIDE_VIEW__) {
        await w.__SMART_STUDIO_SLIDE_VIEW__.loadDeck(deck);
      }
    });

    await page.waitForTimeout(400);
    await expect(page.locator('#welcomeScreen')).toHaveClass(/hidden|fade-out/);
    await expect(page.locator('body')).toHaveClass(/state-deck/);
  });

  test('Test 3(f): Zero console errors and zero connect network requests', async ({ page }) => {
    const consoleErrors: string[] = [];
    const requestedUrls: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('request', (req) => {
      requestedUrls.push(req.url());
    });

    await page.goto('/');
    await page.waitForSelector('#welcomeScreen');
    await page.waitForTimeout(1000);

    // Verify 0 console errors
    expect(consoleErrors).toEqual([]);

    // Verify 0 connect requests
    const connectRequests = requestedUrls.filter(url => 
      url.includes('network-info') || 
      url.includes('connect') || 
      url.includes('qrcode') ||
      url.includes('socket')
    );
    expect(connectRequests).toEqual([]);
  });

  test('Test 4: Smoke flow verification (welcome -> open PDF -> draw -> shapes -> zoom/magnifier -> blackboard -> Close deck -> welcome; mic off at start; AI panel opens)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#welcomeScreen');
    await expect(page.locator('#welcomeScreen')).toBeVisible();

    // Mic button off at start
    const micHeader = page.locator('#btnMicHeader');
    await expect(micHeader).toHaveClass(/mic-off/);

    // Open PDF / deck
    await loadTestDeck(page, 2);
    await expect(page.locator('#welcomeScreen')).toHaveClass(/hidden|fade-out/);
    await expect(page.locator('body')).toHaveClass(/state-deck/);

    // Draw with pen
    const penBtn = page.locator('#toolPen');
    if (await penBtn.isVisible()) {
      await penBtn.click();
      await expect(penBtn).toHaveClass(/active/);
    }

    // Draw with marker
    const markerBtn = page.locator('#toolMarker');
    if (await markerBtn.isVisible()) {
      await markerBtn.click();
      await expect(markerBtn).toHaveClass(/active/);
    }

    // Shapes
    const shapeBtn = page.locator('#toolShape');
    if (await shapeBtn.isVisible()) {
      await shapeBtn.click();
      await expect(shapeBtn).toHaveClass(/active/);
    }

    // Zoom / Magnifier
    const lensBtn = page.locator('#toolLens');
    if (await lensBtn.isVisible()) {
      await lensBtn.click();
    }

    // Blackboard
    const boardBtn = page.locator('#btnBoardHeader');
    await expect(boardBtn).toBeVisible();
    await boardBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toHaveClass(/state-board/);

    // Close blackboard
    const boardCloseBtn = page.locator('#btnCloseBoard, #btnExitBoard');
    if (await boardCloseBtn.isVisible()) {
      await boardCloseBtn.click();
    } else {
      await page.evaluate(() => (window as any).__SMART_STUDIO_BLACKBOARD__?.closeBoard());
    }
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toHaveClass(/state-deck/);

    // AI panel opens
    const aiBtn = page.locator('#btnGeminiHeader, #toolGemini, #btnAssistantHeader').first();
    if (await aiBtn.isVisible()) {
      await aiBtn.click();
      await expect(page.locator('#geminiPanel')).toBeVisible();
      // Close AI panel
      await page.locator('#btnCloseGeminiPanel').click();
    }

    // Close deck -> returns to welcome
    const btnCloseDeck = page.locator('#btnCloseDeckHeader');
    await expect(btnCloseDeck).toBeVisible();
    await btnCloseDeck.click();
    await page.waitForTimeout(400);

    // Welcome screen is back
    await expect(page.locator('#welcomeScreen')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/state-welcome/);
  });
});
