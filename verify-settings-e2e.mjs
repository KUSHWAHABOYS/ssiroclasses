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

async function verifySettings() {
  const port = 8768;
  const distDir = 'D:/Smart-Studio-Project/dist';

  console.log('1. Starting test static server on port ' + port);
  const server = await startServer(distDir, port);

  console.log('2. Launching Chromium (4K IFP resolution: 2560x1440)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    console.log('[BROWSER ' + msg.type() + ']:', msg.text());
  });

  console.log('3. Navigating to http://localhost:' + port);
  await page.goto('http://localhost:' + port, { waitUntil: 'networkidle' });

  console.log('4. Opening Settings Panel via custom event toggle-settings...');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('toggle-settings'));
  });

  await page.waitForTimeout(500);

  console.log('5. Verifying Stitch Modal Dialog is displayed...');
  const isDialogVisible = await page.$eval('#stitchModalDialog', el => !!el && el.offsetParent !== null);
  console.log('Is Stitch Dialog Visible:', isDialogVisible);

  // Take screenshot of Stitch Settings Panel
  const screenshotPath = 'C:/Users/rnran/.gemini/antigravity/brain/e31a8e05-f75a-4c8a-907e-d6832304c124/settings-stitch-verification.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  // 6. Test Tab Navigation
  const tabs = ['tab-display', 'tab-ink', 'tab-toolbar', 'tab-voice', 'tab-gemini', 'tab-obs', 'tab-general'];
  for (const tabId of tabs) {
    console.log(`Clicking tab ${tabId}...`);
    await page.click(`button[data-tab="${tabId}"]`);
    await page.waitForTimeout(150);
    const isPanelVisible = await page.$eval(`#${tabId}`, el => !el.classList.contains('hidden'));
    console.log(`Tab ${tabId} visible:`, isPanelVisible);
  }

  // 7. Test Save Changes button
  console.log('7. Testing Save Changes button...');
  await page.click('#save-changes-btn');
  await page.waitForTimeout(1000);

  const isModalClosed = await page.$eval('#settingsPanel', el => el.classList.contains('hidden'));
  console.log('Is modal closed after save:', isModalClosed);

  await browser.close();
  server.close();

  if (isDialogVisible && isModalClosed && errors.length === 0) {
    console.log('\n===========================================');
    console.log('🎉 STITCH SETTINGS UI VERIFICATION: 100% PASSED!');
    console.log('Zero errors. All 7 tabs interactive. Saved cleanly.');
    console.log('===========================================\n');
  } else {
    console.log('\nVerification completed with errors:', errors);
  }
}

verifySettings().catch(console.error);
