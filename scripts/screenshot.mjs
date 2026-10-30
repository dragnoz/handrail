// Loads the built extension in Chromium, opens the drawer page with the example guide and takes the README pictures.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const guide = readFileSync(resolve('guides/add-deploy-key.md'), 'utf8');
const out = resolve('docs/screenshots');
mkdirSync(out, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  viewport: { width: 400, height: 720 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
});
let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent('serviceworker');
const id = new URL(worker.url()).host;

const page = await context.newPage();
await page.goto(`chrome-extension://${id}/src/sidepanel/index.html`);
await page.getByLabel('Paste a guide, or a link to one').fill(guide);
await page.getByRole('button', { name: 'Add guide' }).click();
await page.getByRole('heading', { name: 'Open a terminal on the server' }).waitFor();
await page.keyboard.press('n');
await page.getByRole('heading', { name: 'Make the key' }).waitFor();
await page.waitForTimeout(2300); // let the "Guide added" line fade
await page.screenshot({ path: resolve(out, '0.1-drawer.png') });

await page.emulateMedia({ colorScheme: 'dark' });
await page.screenshot({ path: resolve(out, '0.1-drawer-dark.png') });
await page.emulateMedia({ colorScheme: 'light' });

await page.getByRole('button', { name: '← Guides' }).click();
await page.getByRole('heading', { name: 'Your guides' }).waitFor();
await page.screenshot({ path: resolve(out, '0.1-home.png') });

await context.close();
console.log('screenshots written to', out);
