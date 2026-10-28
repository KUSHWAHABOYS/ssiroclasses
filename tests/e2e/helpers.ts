import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export const VIEWPORTS = [
  { name: 'desktop-fhd', width: 1920, height: 1080, dpr: 1 },
  { name: 'board-4k', width: 3840, height: 2160, dpr: 2 },
  { name: 'ultrawide', width: 2560, height: 1080, dpr: 1 },
  { name: 'laptop-1366', width: 1366, height: 768, dpr: 1 },
  { name: 'wxga-1280', width: 1280, height: 800, dpr: 1 },
  { name: 'tablet-1024', width: 1024, height: 768, dpr: 2 },
  { name: 'phone-portrait', width: 390, height: 844, dpr: 3 },
  { name: 'phone-landscape', width: 844, height: 390, dpr: 3 },
  { name: 'board-portrait', width: 1080, height: 1920, dpr: 1 },
];

export async function saveEvidenceScreenshot(page: Page, id: string, name: string): Promise<string> {
  const dir = path.join(process.cwd(), 'audit', 'evidence', id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

export async function recordEvidenceLog(id: string, logContent: string): Promise<void> {
  const dir = path.join(process.cwd(), 'audit', 'evidence', id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, 'test.log');
  fs.writeFileSync(filePath, logContent, 'utf-8');
}

export async function getCanvasPixelColor(page: Page, canvasSelector: string, x: number, y: number): Promise<{ r: number; g: number; b: number; a: number }> {
  return await page.evaluate(({ selector, px, py }) => {
    const canvas = document.querySelector(selector) as HTMLCanvasElement;
    if (!canvas) return { r: 0, g: 0, b: 0, a: 0 };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { r: 0, g: 0, b: 0, a: 0 };
    const pixel = ctx.getImageData(px, py, 1, 1).data;
    return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
  }, { selector: canvasSelector, px: x, py: y });
}
