import { chromium } from 'playwright';
import fs from 'fs';

async function runBlobTest() {
  console.log('Testing Blob URL worker in Playwright...');
  const workerContent = fs.readFileSync('D:/Smart-Studio-Project/node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'utf8');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <canvas id="pdfCanvas"></canvas>
  <script type="module">
    import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';

    window.testBlobWorker = async function(workerCode, base64Data) {
      try {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl;
        console.log('Worker blob URL created:', blobUrl);

        const raw = atob(base64Data);
        const uint8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);

        const loadingTask = pdfjsLib.getDocument({ data: uint8 });
        const pdf = await loadingTask.promise;
        console.log('PDF loaded with BLOB WORKER! Pages:', pdf.numPages);
        const page1 = await pdf.getPage(1);
        const viewport = page1.getViewport({ scale: 1.0 });
        const canvas = document.getElementById('pdfCanvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page1.render({ canvasContext: ctx, viewport }).promise;
        console.log('BLOB WORKER Render SUCCESS!');
        return { success: true, pages: pdf.numPages };
      } catch (err) {
        console.error('Blob worker error:', err);
        return { success: false, error: err.message };
      }
    };
  </script>
</body>
</html>
`;

  await page.setContent(html);
  await page.waitForLoadState('networkidle');

  const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 20 >> stream
BT /F1 12 Tf ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
285
%%EOF`;

  const base64Pdf = Buffer.from(minimalPdf).toString('base64');
  const res = await page.evaluate(({ code, pdf }) => window.testBlobWorker(code, pdf), { code: workerContent, pdf: base64Pdf });
  console.log('BLOB TEST RESULT:', res);
  await browser.close();
}

runBlobTest().catch(console.error);
