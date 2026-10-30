// Draws the icon (a rail with two posts) and renders it to PNG at the sizes the manifest wants.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect x="4" y="4" width="120" height="120" rx="28" fill="#2a5db0"/>
  <path d="M24 90 L104 38" stroke="#ffffff" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M44 77 V106" stroke="#ffffff" stroke-width="11" stroke-linecap="round" fill="none"/>
  <path d="M84 51 V106" stroke="#ffffff" stroke-width="11" stroke-linecap="round" fill="none"/>
</svg>`;

const dir = resolve('public/icons');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'icon.svg'), svg + '\n');

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('width="128" height="128"', `width="${size}" height="${size}"`)}</body></html>`,
  );
  await page.screenshot({ path: resolve(dir, `icon-${size}.png`), omitBackground: true });
}
await browser.close();
console.log('icons written to', dir);
