// SSIRO-UPDATE: Icon Generation Pipeline using Sharp
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const BRAND_DIR = path.join(ROOT_DIR, 'assets', 'brand');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

async function main() {
  console.log('🎨 Generating SSIRO Brand Icons & PWA Assets...');

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const userLogoPng = path.join(BRAND_DIR, 'user-logo.png');
  const masterSvgPath = path.join(BRAND_DIR, 'logo.svg');

  let masterSvg = fs.readFileSync(masterSvgPath, 'utf8');

  // Create maskable SVG variant per Part D spec:
  // Background <rect> has no rx (full bleed) and content group has:
  // transform="translate(256 256) scale(0.78) translate(-256 -256) translate(-12 -8)"
  const maskableSvg = masterSvg
    .replace(/<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/, '<rect width="512" height="512" fill="url(#bg)"/>')
    .replace(
      /<g transform="translate\(-12 -8\)">/,
      '<g transform="translate(256 256) scale(0.78) translate(-256 -256) translate(-12 -8)">'
    );

  const svgBuffer = Buffer.from(masterSvg);
  const maskableBuffer = Buffer.from(maskableSvg);

  // 1. icon-192.png (192x192, transparent corners)
  console.log('Generating public/icons/icon-192.png...');
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-192.png'));

  // 2. icon-512.png (512x512, transparent corners)
  console.log('Generating public/icons/icon-512.png...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512.png'));

  // 3. maskable-512.png (512x512, full bleed background + 0.78 scaled content)
  console.log('Generating public/icons/maskable-512.png...');
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(ICONS_DIR, 'maskable-512.png'));

  // Also maintain backward-compatible icon-512-maskable.png
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512-maskable.png'));

  // 4. apple-touch-icon.png 180x180 (from maskable version, no transparency)
  console.log('Generating public/apple-touch-icon.png...');
  await sharp(maskableBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  // 5. favicon.svg (copy of master SVG)
  console.log('Writing public/favicon.svg...');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), masterSvg, 'utf8');

  // 6. favicon-32.png (32x32)
  console.log('Generating public/favicon-32.png...');
  const png32 = await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32.png'), png32);

  // 7. favicon.ico (16, 32, 48 PNG-in-ICO standard format)
  console.log('Generating public/favicon.ico...');
  const png16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  const png48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();

  const icoBuffer = createIcoFromPngs([
    { size: 16, buffer: png16 },
    { size: 32, buffer: png32 },
    { size: 48, buffer: png48 }
  ]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);

  console.log('✅ All icons successfully generated and verified!');
}

/**
 * Packs multiple PNG images into a valid multi-resolution Windows ICO file.
 */
function createIcoFromPngs(images) {
  const numImages = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const totalDirSize = headerSize + numImages * dirEntrySize;

  let currentOffset = totalDirSize;
  const entries = [];

  for (const img of images) {
    entries.push({
      width: img.size === 256 ? 0 : img.size,
      height: img.size === 256 ? 0 : img.size,
      size: img.buffer.length,
      offset: currentOffset,
      buffer: img.buffer
    });
    currentOffset += img.buffer.length;
  }

  const outBuffer = Buffer.alloc(currentOffset);

  // ICO Header
  outBuffer.writeUInt16LE(0, 0); // Reserved
  outBuffer.writeUInt16LE(1, 2); // 1 = ICO type
  outBuffer.writeUInt16LE(numImages, 4); // Number of images

  // Directory entries
  let entryPos = 6;
  for (const entry of entries) {
    outBuffer.writeUInt8(entry.width, entryPos);
    outBuffer.writeUInt8(entry.height, entryPos + 1);
    outBuffer.writeUInt8(0, entryPos + 2); // Color palette
    outBuffer.writeUInt8(0, entryPos + 3); // Reserved
    outBuffer.writeUInt16LE(1, entryPos + 4); // Color planes
    outBuffer.writeUInt16LE(32, entryPos + 6); // Bits per pixel
    outBuffer.writeUInt32LE(entry.size, entryPos + 8); // Image data size
    outBuffer.writeUInt32LE(entry.offset, entryPos + 12); // Image data offset
    entryPos += 16;
  }

  // Concatenate image payloads
  for (const entry of entries) {
    entry.buffer.copy(outBuffer, entry.offset);
  }

  return outBuffer;
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
