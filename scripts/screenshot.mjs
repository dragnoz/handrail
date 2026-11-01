// Loads the built extension in Chromium and takes the README pictures: the drawer with the example guide,
// the home with an assistant open, the notes box, and the site check. The assistant is the test one on localhost, so the
// build used here is the test copy that already holds permission for 127.0.0.1 (see tests/e2e/dist-test.mjs).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startAssistant, siteGuide } from '../tests/e2e/assistant.mjs';
import { distForTests } from '../tests/e2e/dist-test.mjs';

const dist = distForTests();
const guide = readFileSync(resolve('guides/add-deploy-key.md'), 'utf8');
const out = resolve('docs/screenshots');
mkdirSync(out, { recursive: true });

const assistant = await startAssistant({ name: 'Example assistant' });
assistant.texts['add-deploy-key.md'] = guide;
assistant.texts['instagram.md'] = siteGuide(assistant.url, 'instagram-api', 'Use the Instagram API from your site');
assistant.guides.push(
  { id: 'instagram-api', title: 'Use the Instagram API from your site', url: 'guides/instagram.md', updated: new Date(Date.now() - 4 * 60_000).toISOString(), for: 'Dragnoz' },
  { id: 'add-deploy-key', title: 'Add a deploy key to a repository', url: 'guides/add-deploy-key.md', updated: new Date(Date.now() - 26 * 3600_000).toISOString(), for: 'Dragnoz', pages: ['https://git.example.org/*'] },
);
assistant.notices.push({ id: 'n-1', text: 'Your guide is ready: Use the Instagram API from your site.', guide: 'guides/instagram.md', time: new Date(Date.now() - 3 * 60_000).toISOString() });

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

// 1. the drawer with a guide
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

// 2. the notes box under the step
await page.getByRole('button', { name: 'Send a note back…' }).click();
await page.getByLabel('Your note').fill('done, but ssh-keygen asked for a passphrase; I left it empty');
await page.screenshot({ path: resolve(out, '0.2-notes.png') });

// 3. home with an assistant open
await page.getByRole('button', { name: '← Guides' }).click();
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.getByRole('button', { name: 'Add an assistant…' }).click();
await page.getByLabel('Address').fill(assistant.card);
await page.getByRole('button', { name: 'Add', exact: true }).click();
await page.getByRole('status').filter({ hasText: 'Example assistant added' }).waitFor();
await page.getByRole('button', { name: '← Back' }).click();
const row = page.locator('.asst-head'); // the row header; 'Ask Example assistant…' carries the name too
await row.getByText('new').waitFor();
await row.click();
await page.getByRole('heading', { name: 'Guides', level: 3 }).waitFor();
await page.waitForTimeout(2300);
await page.screenshot({ path: resolve(out, '0.2-assistant.png') });

// 4. home, closed rows
await row.click();
await page.getByRole('heading', { name: 'Your guides' }).waitFor();
await page.screenshot({ path: resolve(out, '0.1-home.png') });

// 5. the site check on a site with the usual signs, answered here so no real site is read
await page.route('https://example.org/**', (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === '/') {
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta name="generator" content="WordPress 7.0.8"></head><body>
<div style="position: absolute; left: -17308px;">Want gaming? <a href="https://spam.example.net">casino</a> 1xbet</div>
<p>a theme from wp-content</p></body></html>`,
    });
  }
  if (u.pathname === '/wp-json/wp/v2/users') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ slug: 'kate-austin' }, { slug: 'zwlnmi9lwnacwxozlbsybmbhscpz1wp6654' }]),
    });
  }
  if (u.pathname === '/wp-login.php') return route.fulfill({ status: 200, contentType: 'text/html', body: '<form>Log in</form>' });
  return route.fulfill({ status: 404, body: 'not found' });
});
await page.getByRole('button', { name: 'Check this site for signs of a break-in' }).click();
await page.getByLabel('The site to check').fill('example.org');
await page.getByRole('button', { name: 'Check this site', exact: true }).click();
await page.locator('.sc-verdict').waitFor();
await page.screenshot({ path: resolve(out, '0.3-sitecheck.png') });

await context.close();
await assistant.close();
console.log('screenshots written to', out);
