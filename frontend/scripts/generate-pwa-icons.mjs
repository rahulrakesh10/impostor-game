#!/usr/bin/env node
/**
 * Generates PWA icons (192x192 and 512x512) for installability.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function createIcon(size) {
  const gradient = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea"/>
          <stop offset="100%" style="stop-color:#764ba2"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="${size * 0.2}" fill="url(#g)"/>
      <text x="50%" y="58%" font-size="${size * 0.5}" text-anchor="middle" fill="white">🎭</text>
    </svg>`
  );
  return sharp(gradient).png().toBuffer();
}

async function main() {
  try {
    const [icon192, icon512] = await Promise.all([
      createIcon(192),
      createIcon(512)
    ]);
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(publicDir, 'icon-192.png'), icon192);
    writeFileSync(join(publicDir, 'icon-512.png'), icon512);
    console.log('PWA icons generated: public/icon-192.png, public/icon-512.png');
  } catch (err) {
    console.error('Failed to generate icons:', err);
    process.exit(1);
  }
}

main();
