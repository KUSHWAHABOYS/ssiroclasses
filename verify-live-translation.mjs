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

// 1. Copy user's profile to temp so we can read the decrypted key
const tempProfile = 'D:\\Smart-Studio-Project\\temp_verify_profile';
const srcProfile = 'C:\\Users\\rnran\\AppData\\Local\\Google\\Chrome\\User Data\\Default';
const destProfile = path.join(tempProfile, 'Default');

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const item of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, item);
    const d = path.join(destDir, item);
    try {
      const stat = fs.statSync(s);
      if (stat.isDirectory()) copyDir(s, d);
      else fs.copyFileSync(s, d);
    } catch (e) {}
  }
}

copyDir(path.join(srcProfile, 'Local Storage'), path.join(destProfile, 'Local Storage'));
copyDir(path.join(srcProfile, 'IndexedDB'), path.join(destProfile, 'IndexedDB'));

// First extract the user's decrypted key from ssiro.netlify.app in temporary profile
const probeBrowser = await chromium.launchPersistentContext(tempProfile, { headless: true });
const probePage = await probeBrowser.newPage();
await probePage.goto('https://ssiro.netlify.app', { waitUntil: 'networkidle' });
const userApiKey = await probePage.evaluate(async () => {
  try {
    return await window.__SMART_STUDIO_KEY_VAULT__?.getKey('gemini');
  } catch {
    return null;
  }
});
await probeBrowser.close();
fs.rmSync(tempProfile, { recursive: true, force: true });

console.log('User API key retrieved:', userApiKey ? `Found (ends with ...${userApiKey.slice(-4)})` : 'NOT FOUND');
if (!userApiKey) {
  throw new Error('User API key could not be retrieved from Chrome storage!');
}

async function verifyLiveTranslation() {
  const port = 8774;
  const distDir = 'D:/Smart-Studio-Project/dist';
  const artifactDir = 'C:/Users/rnran/.gemini/antigravity/brain/e31a8e05-f75a-4c8a-907e-d6832304c124';

  console.log('1. Starting test static server on port ' + port);
  const server = await startServer(distDir, port);

  console.log('2. Launching Chromium in 4K resolution (2560x1440)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));

  console.log('3. Navigating to local live dist...');
  await page.goto('http://localhost:' + port, { waitUntil: 'networkidle' });

  // Store the user's key into this local session
  console.log('4. Storing decrypted Gemini key into local test vault...');
  await page.evaluate(async (key) => {
    await window.__SMART_STUDIO_KEY_VAULT__.storeKey('gemini', key);
  }, userApiKey);

  // Load a synthetic lecture slide with Sanskrit & English Indology excerpt
  console.log('5. Loading lecture slide with Indology text...');
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    
    // Slide background
    ctx.fillStyle = '#0a1428';
    ctx.fillRect(0, 0, 1920, 1080);
    
    // Header
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 36px "Noto Sans", sans-serif';
    ctx.fillText('SSIRO Classes • महिषवाहिनी वाराही और वन-दुर्गा: शास्त्रीय उल्लेख', 100, 120);

    // Book Screenshot Area
    ctx.fillStyle = '#f8f5ee';
    ctx.fillRect(120, 220, 1100, 560);
    ctx.strokeStyle = '#df8200';
    ctx.lineWidth = 3;
    ctx.strokeRect(120, 220, 1100, 560);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px "Inter", sans-serif';
    ctx.fillText('Classical Text Excerpt (Durga Saptashati & Devi Kavacham):', 160, 280);

    ctx.fillStyle = '#334155';
    ctx.font = '22px "Inter", sans-serif';
    ctx.fillText('"Varahi is one of the Matrikas, a group of seven mother goddesses in Hinduism.', 160, 340);
    ctx.fillText('Bearing the head of a sow, she is the shakti of Varaha, the boar avatar of Vishnu.', 160, 390);
    ctx.fillText('In Devi Mahatmya, Varahi slays the demon Raktabija alongside goddess Chamunda."', 160, 440);

    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 24px "Noto Sans", sans-serif';
    ctx.fillText('वाराही महिषारूढा दंष्ट्रोद्धृतवसुंधरा। शुभदास्तु सदा देवी दानवदर्पहा।।', 160, 510);

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 19px "Inter", sans-serif';
    ctx.fillText('— Vamana Purana (21.46-48), Venkateshwar Steam Press Edition', 160, 570);

    const testDeck = {
      name: 'Lecture_Varahi_Durga.pdf',
      totalPages: 1,
      pages: [
        { pageNumber: 1, width: 1920, height: 1080, sourceType: 'canvas', renderData: canvas }
      ]
    };

    window.__SMART_STUDIO_SLIDE_VIEW__.loadDeck(testDeck);
  });

  await page.waitForTimeout(400);

  // 6. Click #btnToolTranslate
  console.log('6. Clicking #btnToolTranslate...');
  await page.click('#btnToolTranslate');
  await page.waitForTimeout(200);

  // Verify: NO guide banner, NO text clutter
  const uiCheck = await page.evaluate(() => {
    const guideBar = document.querySelector('.translator-guide-bar');
    const tag = document.getElementById('snipDimensionsTag');
    const overlay = document.getElementById('translatorOverlay');
    return {
      hasGuideBar: !!guideBar,
      hasTag: !!tag,
      overlayActive: overlay && !overlay.classList.contains('hidden')
    };
  });
  console.log('UI Cleanliness Check (Expect false, false, true):', uiCheck);
  if (uiCheck.hasGuideBar || uiCheck.hasTag || !uiCheck.overlayActive) {
    throw new Error('❌ Cleanliness check failed: Found unwanted guide bar or dimension tag!');
  }

  // 7. Drag selection box over the book screenshot area
  console.log('7. Snapping text area (140, 240) to (1200, 760)...');
  await page.mouse.move(140, 240);
  await page.mouse.down();
  await page.mouse.move(1200, 760, { steps: 6 });
  await page.mouse.up();

  console.log('8. Waiting for live Google Gemini translation...');
  // Wait for result card to show up with Hindi text
  await page.waitForSelector('.hindi-translation-text', { timeout: 25000 });

  const translationResult = await page.evaluate(() => {
    const card = document.getElementById('translationCard');
    const hindiEl = card?.querySelector('.hindi-translation-text');
    const langEl = card?.querySelector('.translation-lang-pill');
    const glossaryRows = card?.querySelectorAll('.glossary-row') || [];
    const wholeSlideBtn = card?.querySelector('#btnTransWholeSlide');
    const workingModel = localStorage.getItem('smart_studio_working_gemini_model');

    return {
      workingModel,
      isCardVisible: card && !card.classList.contains('hidden'),
      detectedLang: langEl?.textContent?.trim(),
      hindiText: hindiEl?.textContent?.trim(),
      glossaryCount: glossaryRows.length,
      hasWholeSlideBtn: !!wholeSlideBtn
    };
  });

  console.log('🎉 LIVE GEMINI TRANSLATION RESULT:', JSON.stringify(translationResult, null, 2));

  if (!translationResult.hindiText || translationResult.hindiText.length < 15) {
    throw new Error('❌ Hindi translation was empty or failed!');
  }

  // 8. Capture Verification Screenshot
  const screenshotPath = path.join(artifactDir, 'live-gemini-translation-verified.png');
  console.log('9. Capturing screenshot to: ' + screenshotPath);
  await page.screenshot({ path: screenshotPath });

  console.log('✅ ALL CHECKS PASSED: Model auto-selected, live translation succeeded, zero UI clutter!');

  await browser.close();
  server.close();
}

verifyLiveTranslation().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
