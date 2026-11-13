import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

function startServer(distPath, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(distPath, req.url.split('?')[0]);
    if (filePath.endsWith(path.sep) || !path.extname(filePath)) {
      filePath = path.join(distPath, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath);
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(data);
    });
  });

  return new Promise(resolve => {
    server.listen(port, () => resolve(server));
  });
}

async function verifyFullViewAndPopovers() {
  const port = 8770;
  const distDir = 'D:/Smart-Studio-Project/dist';

  console.log('1. Starting test static server on port ' + port);
  const server = await startServer(distDir, port);

  console.log('2. Launching Chromium (4K IFP resolution: 2560x1440)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('3. Navigating to http://localhost:' + port);
  await page.goto('http://localhost:' + port, { waitUntil: 'networkidle' });

  // Transition to deck state with a synthetic 4:3 test slide to verify fit and fill
  console.log('4. Creating synthetic deck to test auto-adjust fit/fill...');
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e2947';
    ctx.fillRect(0, 0, 1024, 768);
    ctx.fillStyle = '#ffd76a';
    ctx.font = '40px sans-serif';
    ctx.fillText('Test Lecture Slide 1 (4:3 Aspect Ratio)', 60, 100);

    const testDeck = {
      name: 'Lecture_Math_Ch1.pdf',
      totalPages: 3,
      pages: [
        { pageNumber: 1, width: 1024, height: 768, render: () => Promise.resolve(canvas) },
        { pageNumber: 2, width: 1024, height: 768, render: () => Promise.resolve(canvas) },
        { pageNumber: 3, width: 1024, height: 768, render: () => Promise.resolve(canvas) }
      ]
    };

    window.__SMART_STUDIO_SLIDE_VIEW__.loadDeck(testDeck);
  });

  await page.waitForTimeout(300);

  // Test Quick Fit Mode in Header (Windowed state)
  console.log('5. Testing Quick Fit Mode Header Toggle in Windowed Mode...');
  const initialFitMode = await page.evaluate(() => window.__SMART_STUDIO_STORE__.getState().settings.fitMode);
  console.log('Initial Fit Mode:', initialFitMode);

  await page.click('#btnFitModeHeader');
  await page.waitForTimeout(200);

  const toggledFitMode = await page.evaluate(() => window.__SMART_STUDIO_STORE__.getState().settings.fitMode);
  console.log('Toggled Fit Mode via Header:', toggledFitMode);

  // Now Enter Full View (Zen mode)
  console.log('6. Entering Zen Full View...');
  await page.evaluate(() => {
    window.__SMART_STUDIO_STORE__.setState({ isZen: true, isToolbarVisibleInZen: true });
    window.dispatchEvent(new CustomEvent('app-fullscreen-changed', { detail: { isZen: true } }));
  });

  await page.waitForTimeout(300);

  // Verify slide canvas dimensions expanded to full screen (2560x1440)
  const slideCanvasDims = await page.evaluate(() => {
    const c = document.getElementById('slideCanvas');
    return { width: c.width, height: c.height };
  });
  console.log('Slide canvas dimensions in Full View:', slideCanvasDims);

  // Test Toolbar Tier 2 Fit Mode toggle in Zen mode
  console.log('7. Testing Toolbar Tier 2 Fit Mode in Zen Mode...');
  await page.click('#btnTierToggle'); // Expand Tier 2
  await page.waitForTimeout(200);

  await page.click('#btnToolFitMode');
  await page.waitForTimeout(200);

  const fitModeAfterToolbar = await page.evaluate(() => window.__SMART_STUDIO_STORE__.getState().settings.fitMode);
  console.log('Fit Mode after Toolbar Toggle in Zen Mode:', fitModeAfterToolbar);

  // Test Popovers inside #stage in Full View:
  // 1. Pen Popover
  console.log('8. Testing Pen Popover in Full View...');
  await page.click('#btnToolPen'); // select pen
  await page.waitForTimeout(100);
  await page.click('#btnToolPen'); // second click opens popover
  await page.waitForTimeout(200);

  const penPopoverInStage = await page.evaluate(() => {
    const pop = document.querySelector('.pen-popover');
    const stage = document.getElementById('stage');
    return {
      exists: !!pop,
      insideStage: pop ? stage.contains(pop) : false,
      zIndex: pop ? window.getComputedStyle(pop).zIndex : null,
      visible: pop ? pop.offsetParent !== null : false
    };
  });
  console.log('Pen Popover In Stage Status:', penPopoverInStage);

  // Test clicking 12px preset
  await page.click('#penQuickPresets button[data-size="12"]');
  const penSize = await page.evaluate(() => window.__SMART_STUDIO_STORE__.getState().penSize);
  console.log('Pen Size updated via Preset:', penSize);

  // 2. Eraser Popover
  console.log('9. Testing Eraser Popover in Full View...');
  await page.click('#btnToolEraser');
  await page.waitForTimeout(100);
  await page.click('#btnToolEraser');
  await page.waitForTimeout(200);

  const eraserPopoverInStage = await page.evaluate(() => {
    const pop = document.querySelector('.eraser-popover');
    const stage = document.getElementById('stage');
    return {
      exists: !!pop,
      insideStage: pop ? stage.contains(pop) : false,
      visible: pop ? pop.offsetParent !== null : false
    };
  });
  console.log('Eraser Popover In Stage Status:', eraserPopoverInStage);

  // Test clicking 80px preset
  await page.click('#eraserQuickPresets button[data-size="80"]');
  const eraserSize = await page.evaluate(() => window.__SMART_STUDIO_STORE__.getState().eraserSize);
  console.log('Eraser Size updated via Preset:', eraserSize);

  // 3. Highlighter Popover
  console.log('10. Testing Highlighter Popover in Full View...');
  await page.click('#btnToolHighlighter');
  await page.waitForTimeout(100);
  await page.click('#btnToolHighlighter');
  await page.waitForTimeout(200);

  const hlPopoverInStage = await page.evaluate(() => {
    const pop = document.querySelector('.hl-popover');
    const stage = document.getElementById('stage');
    return {
      exists: !!pop,
      insideStage: pop ? stage.contains(pop) : false,
      visible: pop ? pop.offsetParent !== null : false
    };
  });
  console.log('Highlighter Popover In Stage Status:', hlPopoverInStage);

  // 4. Magnifier Popover
  console.log('11. Testing Magnifier Popover in Full View...');
  await page.click('#btnToolMagnifier');
  await page.waitForTimeout(100);
  await page.click('#btnToolMagnifier');
  await page.waitForTimeout(200);

  const magPopoverInStage = await page.evaluate(() => {
    const pop = document.querySelector('.zoom-popover');
    const stage = document.getElementById('stage');
    return {
      exists: !!pop,
      insideStage: pop ? stage.contains(pop) : false,
      visible: pop ? pop.offsetParent !== null : false
    };
  });
  console.log('Magnifier Popover In Stage Status:', magPopoverInStage);

  // Take screenshot of Full View with Popover active
  const screenshotPath = 'C:/Users/rnran/.gemini/antigravity/brain/e31a8e05-f75a-4c8a-907e-d6832304c124/fullview-popover-verification.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
  server.close();

  const allPassed = 
    slideCanvasDims.width === 2560 &&
    slideCanvasDims.height === 1440 &&
    toggledFitMode !== initialFitMode &&
    fitModeAfterToolbar === initialFitMode &&
    penPopoverInStage.insideStage &&
    penSize === 12 &&
    eraserPopoverInStage.insideStage &&
    eraserSize === 80 &&
    hlPopoverInStage.insideStage &&
    magPopoverInStage.insideStage &&
    errors.length === 0;

  console.log('\n===========================================');
  console.log('ALL TESTS PASSED:', allPassed);
  console.log('===========================================\n');
  if (!allPassed) {
    console.error('Errors:', errors);
    process.exit(1);
  }
}

verifyFullViewAndPopovers().catch(err => {
  console.error('Test Execution Failed:', err);
  process.exit(1);
});
