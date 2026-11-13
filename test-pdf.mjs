import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testHindiOrComplexPdf() {
  console.log('Testing legacy build with simulated PDF data...');
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

  const uint8 = new Uint8Array(Buffer.from(minimalPdf));
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;
  console.log('Document loaded successfully, pages:', doc.numPages);
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });
  console.log('Viewport:', viewport.width, 'x', viewport.height);
}

testHindiOrComplexPdf();
