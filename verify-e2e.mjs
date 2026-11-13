import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Minimal static file server for dist
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

// Generate sample PDF
function createTestPDF(destPath) {
  const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 1920 1080] /Contents 4 0 R >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 36 Tf 100 800 Td (SMART STUDIO 4K TEST SLIDE) ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
310
%%EOF`;
  fs.writeFileSync(destPath, Buffer.from(minimalPdf));
}

async function runEndToEndVerification() {
  const port = 8765;
  const distDir = 'D:/Smart-Studio-Project/dist';
  const testPdfPath = 'D:/Smart-Studio-Project/test-sample.pdf';
  createTestPDF(testPdfPath);

  console.log('1. Starting test static server on port ' + port);
  const server = await startServer(distDir, port);

  console.log('2. Launching Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    console.log('[BROWSER ' + msg.type() + ']:', msg.text());
  });

  page.on('dialog', async dialog => {
    console.log('[ALERT DIALOG]:', dialog.message());
    errors.push('Alert Dialog: ' + dialog.message());
    await dialog.accept();
  });

  console.log('3. Navigating to http://localhost:' + port);
  await page.goto('http://localhost:' + port, { waitUntil: 'networkidle' });

  console.log('4. Waiting for Welcome Screen...');
  await page.waitForSelector('#welcomeScreen', { state: 'visible' });
  console.log('✓ Welcome screen is visible!');

  console.log('5. Triggering Open Deck by setting PDF file on #fileInputDeck...');
  const fileInput = await page.$('#fileInputDeck');
  await fileInput.setInputFiles(testPdfPath);

  console.log('6. Waiting for PDF rendering and welcome screen dismiss...');
  // Wait up to 5 seconds for welcome screen to fade out or canvas to update
  await page.waitForTimeout(3000);

  const isWelcomeHidden = await page.$eval('#welcomeScreen', el => el.classList.contains('hidden') || el.classList.contains('fade-out'));
  console.log('Is Welcome screen fading/hidden:', isWelcomeHidden);

  const pageCounterText = await page.$eval('#pageCounter', el => el.textContent);
  console.log('Page Counter text:', pageCounterText);

  // Take screenshot of the rendered app
  const screenshotPath = 'C:/Users/rnran/.gemini/antigravity/brain/e31a8e05-f75a-4c8a-907e-d6832304c124/test-verification.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
  server.close();

  if (pageCounterText.includes('1 / 1') && isWelcomeHidden && errors.length === 0) {
    console.log('\n===========================================');
    console.log('🎉 END-TO-END VERIFICATION: 100% PASSED!');
    console.log('PDF was loaded, parsed, rendered, and page counter updated!');
    console.log('ZERO ERRORS. ZERO ALERT DIALOGS.');
    console.log('===========================================\n');
  } else {
    console.log('\nVERIFICATION RESULT: errors =', errors);
  }
}

runEndToEndVerification().catch(console.error);
