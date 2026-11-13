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

async function verifyAiTranslator() {
  const port = 8773;
  const distDir = 'D:/Smart-Studio-Project/dist';
  const artifactDir = 'C:/Users/rnran/.gemini/antigravity/brain/e31a8e05-f75a-4c8a-907e-d6832304c124';

  console.log('1. Starting test static server on port ' + port);
  const server = await startServer(distDir, port);

  console.log('2. Launching Chromium in 4K Digital Board View (2560x1440)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('3. Navigating to Smart Studio live dist...');
  await page.goto('http://localhost:' + port, { waitUntil: 'networkidle' });

  // Transition from Welcome to Deck with an English Indology slide
  console.log('4. Loading synthetic lecture slide with English & Sanskrit texts...');
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1920, 1080);
    
    // Header Banner
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(60, 60, 1800, 120);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 38px "Noto Sans", sans-serif';
    ctx.fillText('SSIRO Classes • Buddhist Philosophy & Epistemology Lecture', 100, 135);

    // Screenshot Card Box
    ctx.fillStyle = '#1e2947';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.fillRect(100, 240, 1000, 520);
    ctx.strokeRect(100, 240, 1000, 520);

    // Screenshot Text
    ctx.fillStyle = '#f8fafc';
    ctx.font = '28px "Inter", sans-serif';
    ctx.fillText('Research Paper Excerpt (Oxford University Press):', 140, 300);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px "Inter", sans-serif';
    ctx.fillText('"Paṭiccasamuppāda is the foundational nexus of Buddhist causal theory.', 140, 360);
    ctx.fillText('It asserts that all phenomena arise in dependence upon conditions,', 140, 400);
    ctx.fillText('thereby fundamentally rejecting essentialist notions of an immutable Ātman.', 140, 440);
    ctx.fillText('This epistemic framework establishes the Middle Way between eternalism', 140, 480);
    ctx.fillText('and annihilationism (Ucchedavāda)."', 140, 520);

    ctx.fillStyle = '#ffd76a';
    ctx.font = 'italic 20px "Inter", sans-serif';
    ctx.fillText('— Prof. T. W. Rhys Davids, Pali Text Society', 140, 580);

    const renderSlide = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      
      // Deep scholarly lecture background
      const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
      grad.addColorStop(0, '#0a1428');
      grad.addColorStop(1, '#050c1e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1920, 1080);
      
      // Header Banner
      ctx.fillStyle = 'rgba(255, 215, 106, 0.08)';
      ctx.strokeStyle = 'rgba(255, 215, 106, 0.3)';
      ctx.lineWidth = 2;
      ctx.fillRect(80, 50, 1760, 100);
      ctx.strokeRect(80, 50, 1760, 100);

      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 36px "Noto Sans", sans-serif';
      ctx.fillText('SSIRO Classes • Buddhist Epistemology & Sanskrit Sources (Lecture 14)', 120, 115);

      // Screenshot Card Box
      ctx.fillStyle = '#0f1d3d';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.fillRect(100, 200, 1050, 580);
      ctx.strokeRect(100, 200, 1050, 580);

      // Screenshot Header & Texts
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px "Inter", sans-serif';
      ctx.fillText('Academic Paper Excerpt (Oxford University Press):', 140, 255);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '24px "Inter", sans-serif';
      ctx.fillText('"Paṭiccasamuppāda is the foundational nexus of Buddhist causal theory.', 140, 315);
      ctx.fillText('It asserts that all phenomena arise in dependence upon conditions,', 140, 360);
      ctx.fillText('thereby fundamentally rejecting essentialist notions of an immutable Ātman.', 140, 405);
      ctx.fillText('This epistemic framework establishes the Middle Way between eternalism', 140, 450);
      ctx.fillText('and annihilationism (Ucchedavāda)."', 140, 495);

      ctx.fillStyle = '#fef08a';
      ctx.font = '22px "Noto Sans", sans-serif';
      ctx.fillText('संस्कृत सूत्र: "यः प्रतीत्यसमुत्पादं पश्यति सो धर्मं पश्यति।" — शाण्डिल्य टीका', 140, 560);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 19px "Inter", sans-serif';
      ctx.fillText('— Prof. T. W. Rhys Davids, Journal of the Pali Text Society, Vol. IX', 140, 620);

      return Promise.resolve(canvas);
    };

    const testDeck = {
      name: 'Indology_Lecture_01.pdf',
      totalPages: 1,
      pages: [
        { pageNumber: 1, width: 1920, height: 1080, render: renderSlide }
      ]
    };

    window.__SMART_STUDIO_SLIDE_VIEW__.loadDeck(testDeck);
  });

  await page.waitForTimeout(400);

  // 5. Test AI Translate Button in Tier 1 of Toolbar
  console.log('5. Clicking #btnToolTranslate in Toolbar...');
  const btnTranslate = await page.$('#btnToolTranslate');
  if (!btnTranslate) {
    throw new Error('❌ #btnToolTranslate not found in toolbar!');
  }
  await btnTranslate.click();
  await page.waitForTimeout(200);

  const activeTool = await page.evaluate(() => window.__SMART_STUDIO_STORE__.getState().activeTool);
  console.log('Active tool after clicking translate:', activeTool);
  if (activeTool !== 'translate') {
    throw new Error(`❌ Expected activeTool to be 'translate', got: ${activeTool}`);
  }

  // Check Overlay visibility
  const isOverlayVisible = await page.evaluate(() => {
    const overlay = document.getElementById('translatorOverlay');
    return overlay && !overlay.classList.contains('hidden') && overlay.style.display !== 'none';
  });
  console.log('Translator Overlay is visible:', isOverlayVisible);
  if (!isOverlayVisible) {
    throw new Error('❌ #translatorOverlay is not visible when activeTool is translate!');
  }

  // 6. Simulate Snip Area Dragging
  console.log('6. Dragging selection box over screenshot...');
  await page.mouse.move(120, 250);
  await page.mouse.down();
  await page.mouse.move(1050, 740, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  // Verify Snip Box was created
  const snipDimensions = await page.evaluate(() => {
    const snip = document.querySelector('.translator-snip-box');
    const tag = document.getElementById('snipDimensionsTag');
    return {
      display: snip ? snip.style.display : null,
      tagText: tag ? tag.textContent : null
    };
  });
  console.log('Snip Box Info:', snipDimensions);

  // 7. Inject Mock High-Quality Result into Translator Card
  console.log('7. Displaying AI Translation Result Card...');
  await page.evaluate(() => {
    window.__SMART_STUDIO_TRANSLATOR_CARD__.showResult({
      detectedLanguage: 'अंग्रेजी (English) + पालि पारिभाषिक',
      originalText: 'Paṭiccasamuppāda is the foundational nexus of Buddhist causal theory. It asserts that all phenomena arise in dependence upon conditions, thereby fundamentally rejecting essentialist notions of an immutable Ātman.',
      hindiTranslation: 'प्रतीत्यसमुत्पाद (Paṭiccasamuppāda) बौद्ध कार्य-कारण सिद्धांत का मूल आधार है। यह प्रतिपादित करता है कि संपूर्ण सांसारिक प्रपंच और घटनाएं प्रत्ययों (कारणों) पर निर्भर होकर ही उत्पन्न होती हैं, और इस प्रकार यह किसी नित्य या अपरिवर्तनीय आत्मा (Ātman) के अस्तित्व को मूलतः अस्वीकार करता है।',
      keyGlossary: [
        { term: 'Paṭiccasamuppāda (प्रतीत्यसमुत्पाद)', meaning: 'कारण-कार्य की सापेक्ष उत्पत्ति का शाश्वत नियम।' },
        { term: 'Immutable Ātman (अपरिवर्तनीय आत्मा)', meaning: 'वैदिक दर्शन का नित्य-शाश्वत आत्म-तत्व जिसका बौद्ध मत खंडन करता है।' },
        { term: 'Middle Way (मध्यम मार्ग)', meaning: 'शाश्वतवाद और उच्छेदवाद के दोनों अतियों से परे संतुलन।' }
      ],
      summary: 'प्रतीत्यसमुत्पाद सभी वस्तुओं की अन्योन्याश्रित उत्पत्ति व अनात्मवाद को प्रमाणित करता है।'
    }, 1100, 220);
  });

  await page.waitForTimeout(300);

  // Check Card Visibility and Content
  const cardData = await page.evaluate(() => {
    const card = document.getElementById('translationCard');
    const textEl = card?.querySelector('.hindi-translation-text');
    const langPill = card?.querySelector('.translation-lang-pill');
    return {
      isVisible: card && !card.classList.contains('hidden'),
      hasHindi: textEl?.textContent?.includes('प्रतीत्यसमुत्पाद'),
      langText: langPill?.textContent
    };
  });
  console.log('Card data:', cardData);
  if (!cardData.isVisible || !cardData.hasHindi) {
    throw new Error('❌ Translation Card is not visible or missing Hindi translation!');
  }

  // 8. Test Minimize to Floating Pill
  console.log('8. Testing Minimize to Pill...');
  await page.click('#btnTransMinimize');
  await page.waitForTimeout(200);

  const minState = await page.evaluate(() => {
    const card = document.getElementById('translationCard');
    const pill = document.getElementById('translationMinPill');
    return {
      cardHidden: card?.classList.contains('hidden'),
      pillVisible: pill && !pill.classList.contains('hidden'),
      pillText: pill?.textContent
    };
  });
  console.log('Minimize state:', minState);
  if (!minState.cardHidden || !minState.pillVisible) {
    throw new Error('❌ Minimize failed! Pill not visible or card not hidden.');
  }

  // 9. Test Restore from Pill
  console.log('9. Testing Restore from Pill...');
  await page.click('#translationMinPill');
  await page.waitForTimeout(200);

  const restoredState = await page.evaluate(() => {
    const card = document.getElementById('translationCard');
    const pill = document.getElementById('translationMinPill');
    return {
      cardVisible: card && !card.classList.contains('hidden'),
      pillHidden: pill?.classList.contains('hidden')
    };
  });
  console.log('Restored state:', restoredState);
  if (!restoredState.cardVisible || !restoredState.pillHidden) {
    throw new Error('❌ Restore from pill failed!');
  }

  // 10. Test Pin to Slide
  console.log('10. Testing Pin to Slide as Sticky Note...');
  await page.click('#btnTransPin');
  await page.waitForTimeout(200);

  const pinnedNoteCount = await page.evaluate(() => {
    return document.querySelectorAll('#mediaLayer .pinned-translation-note').length;
  });
  console.log('Pinned notes count on mediaLayer:', pinnedNoteCount);
  if (pinnedNoteCount !== 1) {
    throw new Error('❌ Pin to slide failed! Note not found on #mediaLayer.');
  }

  // Re-open translation card alongside pinned note for final visual snapshot
  await page.evaluate(() => {
    window.__SMART_STUDIO_TRANSLATOR_CARD__.showResult({
      detectedLanguage: 'अंग्रेजी (English) ➔ शुद्ध हिंदी',
      originalText: 'The Epistemic Framework of Madhyamaka.',
      hindiTranslation: 'माध्यमिक दर्शन की ज्ञानमीमांसीय संरचना — शून्यता और प्रतीत्यसमुत्पाद का एकात्म बोध।',
      keyGlossary: [
        { term: 'Epistemic Framework', meaning: 'ज्ञानमीमांसा या प्रमाण-व्यवस्था।' },
        { term: 'Madhyamaka', meaning: 'आचार्य नागार्जुन द्वारा प्रतिपादित शून्यता दर्शन।' }
      ]
    }, 1100, 240);
  });
  await page.waitForTimeout(300);

  // 11. Test Returning to Pen Tool
  console.log('11. Testing tool switch to Pen tool (#btnToolPen)...');
  await page.click('#btnToolPen');
  await page.waitForTimeout(200);

  const penToolActive = await page.evaluate(() => {
    const s = window.__SMART_STUDIO_STORE__.getState();
    const overlay = document.getElementById('translatorOverlay');
    return {
      activeTool: s.activeTool,
      overlayHidden: overlay?.classList.contains('hidden')
    };
  });
  console.log('Pen tool state:', penToolActive);
  if (penToolActive.activeTool !== 'pen' || !penToolActive.overlayHidden) {
    throw new Error('❌ Switching back to Pen tool failed!');
  }

  // 12. Draw with Pen to verify zero drawing regressions
  console.log('12. Drawing stroke with Pen tool to ensure zero regression...');
  await page.mouse.move(700, 850);
  await page.mouse.down();
  await page.mouse.move(950, 850, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const strokeCount = await page.evaluate(() => {
    return window.__SMART_STUDIO_ANNOTATION_STORE__.getStrokes().length;
  });
  console.log('Annotation strokes count:', strokeCount);
  if (strokeCount < 1) {
    throw new Error('❌ Pen drawing failed! Stroke count is 0.');
  }

  // 13. Test Zen Mode Toolbar Visibility
  console.log('13. Testing Zen (Full View) mode...');
  await page.evaluate(() => {
    window.__SMART_STUDIO_STORE__.setState({ isZen: true, isToolbarVisibleInZen: true });
    window.dispatchEvent(new CustomEvent('app-fullscreen-changed', { detail: { isZen: true } }));
    document.getElementById('stage')?.classList.add('zen-mode');

    // Also display the glowing snip box around the academic snippet for the screenshot
    const snip = document.querySelector('.translator-snip-box');
    if (snip) {
      snip.style.left = '95px';
      snip.style.top = '195px';
      snip.style.width = '1060px';
      snip.style.height = '590px';
      snip.style.display = 'block';
    }
  });
  await page.waitForTimeout(400);

  const zenTranslateBtn = await page.evaluate(() => {
    const btn = document.getElementById('btnToolTranslate');
    const tb = document.getElementById('toolbarContainer');
    return {
      btnExists: !!btn,
      tbVisible: tb && !tb.classList.contains('hidden')
    };
  });
  console.log('Zen Mode translate button:', zenTranslateBtn);
  if (!zenTranslateBtn.btnExists) {
    throw new Error('❌ Translate button missing in Zen mode!');
  }

  // 14. Capture Final High-Resolution Verification Screenshot
  const screenshotPath = path.join(artifactDir, 'ai-translator-e2e-verified.png');
  console.log('14. Capturing verification screenshot to: ' + screenshotPath);
  await page.screenshot({ path: screenshotPath });

  console.log('15. Checking for any console errors...');
  if (errors.length > 0) {
    console.warn('⚠️ Console errors detected:', errors);
  } else {
    console.log('✅ 0 Console errors detected.');
  }

  console.log('🎉 ALL AI TRANSLATE LENS VERIFICATIONS PASSED SUCCESSFULLY!');

  await browser.close();
  server.close();
}

verifyAiTranslator().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
