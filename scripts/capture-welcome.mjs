import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const prefix = process.argv[2] || 'before';

const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '3840x2160', width: 3840, height: 2160 },
  { name: '1366x768',  width: 1366, height: 768 },
  { name: '1024x768',  width: 1024, height: 768 },
  { name: '390x844',   width: 390,  height: 844 },
  { name: '1080x1920', width: 1080, height: 1920 }
];

const outDir = path.resolve('audit/welcome-cleanup');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    // Wait for animations to settle
    await page.waitForTimeout(1000);
    const filePath = path.join(outDir, `welcome-${prefix}-${vp.name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`Saved ${filePath}`);
    await page.close();
  }
  await browser.close();
}

run().catch(console.error);
