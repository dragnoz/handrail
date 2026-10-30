// The drawer, end to end: the built extension in Chromium, the side panel page opened as a tab.
import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

const dist = resolve('dist');

interface Site {
  url: string;
  server: Server;
}

const test = base.extend<{ context: BrowserContext; extensionId: string; panel: Page; site: Site }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
      viewport: { width: 400, height: 760 },
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
  panel: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    // The clipboard is stubbed so the test can see what a chip copied.
    await page.addInitScript(() => {
      (window as unknown as { __copied: string | null }).__copied = null;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (t: string) => {
            (window as unknown as { __copied: string | null }).__copied = t;
          },
        },
      });
    });
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
    await use(page);
  },
  // A tiny site on localhost, the place some steps "happen".
  site: async ({}, use) => {
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end(`<!doctype html><title>Camelot</title><h1>Camelot</h1><p>${req.url}</p>`);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    await use({ url: `http://127.0.0.1:${port}`, server });
    await new Promise((r) => server.close(r));
  },
});

function guideFor(site: string): string {
  return [
    '---',
    'title: Test guide',
    'id: test-guide',
    'by: Claude',
    'for: Dragnoz',
    '---',
    'A guide for the test.',
    '',
    '## 1. First',
    '    copy: echo one',
    '    expect: one',
    '## 2. Second',
    `    url: ${site}/servers`,
    'Press the button.',
    '## 3. Third',
    `    url: ${site}/*`,
    '    optional: true',
    '## 4. Last',
    '',
  ].join('\n');
}

async function addGuide(panel: Page, text: string): Promise<void> {
  await panel.getByLabel('Paste a guide, or a link to one').fill(text);
  await panel.getByRole('button', { name: 'Add guide' }).click();
}

const copied = (panel: Page) => panel.evaluate(() => (window as unknown as { __copied: string | null }).__copied);

test('paste a guide and walk it with the keys', async ({ panel, site }) => {
  await addGuide(panel, guideFor(site.url));
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Test guide');
  await expect(panel.getByRole('heading', { level: 2, name: 'First' })).toBeVisible();
  await expect(panel.getByText('0 of 4 done')).toBeVisible();
  await expect(panel.getByText('A guide for the test.')).toBeVisible();

  await panel.keyboard.press('n');
  await expect(panel.getByRole('heading', { level: 2, name: 'Second' })).toBeVisible();
  await expect(panel.getByText('1 of 4 done')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Done, reopen step 1: First' })).toBeVisible();

  await panel.keyboard.press('p');
  await expect(panel.getByRole('heading', { level: 2, name: 'First' })).toBeVisible();
  await expect(panel.getByText('0 of 4 done')).toBeVisible();

  await panel.keyboard.press('n');
  await panel.keyboard.press('n');
  await expect(panel.getByRole('heading', { level: 2, name: 'Third' })).toBeVisible();
  await panel.getByRole('button', { name: 'Skip' }).click();
  await expect(panel.getByRole('heading', { level: 2, name: 'Last' })).toBeVisible();
  await expect(panel.getByText('2 of 4 done, 1 skipped')).toBeVisible();

  await panel.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(panel.getByText('Done.')).toBeVisible();
  await expect(panel.getByText('3 of 4 steps done, 1 skipped.')).toBeVisible();

  // Home shows it as done; it is still there after a reload.
  await panel.getByRole('button', { name: 'Your guides' }).click();
  await expect(panel.getByText('Done', { exact: true })).toBeVisible();
  await panel.reload();
  await expect(panel.getByText('Test guide')).toBeVisible();
});

test('a chip copies its value, with the mouse and with the c key', async ({ panel, site }) => {
  await addGuide(panel, guideFor(site.url));
  await panel.getByRole('button', { name: 'Copy: echo one' }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible();
  expect(await copied(panel)).toBe('echo one');

  await panel.evaluate(() => ((window as unknown as { __copied: string | null }).__copied = null));
  await panel.keyboard.press('c');
  expect(await copied(panel)).toBe('echo one');
});

test('keys do nothing while typing in the paste box', async ({ panel, site }) => {
  await addGuide(panel, guideFor(site.url));
  await panel.getByRole('button', { name: '← Guides' }).click();
  await panel.getByLabel('Paste a guide, or a link to one').fill('');
  await panel.getByLabel('Paste a guide, or a link to one').press('n');
  await expect(panel.getByLabel('Paste a guide, or a link to one')).toHaveValue('n');
});

test('where am I offers a jump and never takes it; open here uses the current tab', async ({ panel, site, context }) => {
  await addGuide(panel, guideFor(site.url));
  await expect(panel.getByRole('heading', { level: 2, name: 'First' })).toBeVisible();

  const sitePage = await context.newPage();
  await sitePage.goto(`${site.url}/servers`);

  const offer = panel.getByRole('status').filter({ hasText: 'You seem to be on step 2.' });
  await expect(offer).toBeVisible();
  // still on step 1: nothing moved by itself
  await expect(panel.getByRole('heading', { level: 2, name: 'First' })).toBeVisible();

  await panel.getByRole('button', { name: 'Jump there' }).click();
  await expect(panel.getByRole('heading', { level: 2, name: 'Second' })).toBeVisible();
  await expect(offer).toHaveCount(0);

  // Step 3 happens on the whole site: "open here" sends the active tab there.
  await panel.keyboard.press('n');
  await expect(panel.getByRole('heading', { level: 2, name: 'Third' })).toBeVisible();
  const pagesBefore = context.pages().length;
  await panel.getByRole('button', { name: /Open here/ }).click();
  await sitePage.waitForURL(`${site.url}/`);
  // no new tab, no new window
  expect(context.pages().length).toBe(pagesBefore);
});

test('export writes one JSON file with the guide in it', async ({ panel, site }) => {
  await addGuide(panel, guideFor(site.url));
  await panel.getByRole('button', { name: 'Settings' }).click();
  const download = panel.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export…' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^handrail-\d{4}-\d{2}-\d{2}\.json$/);
  const text = await new Promise<string>((res, rej) => {
    file.createReadStream().then((s) => {
      let data = '';
      s.on('data', (c) => (data += c));
      s.on('end', () => res(data));
      s.on('error', rej);
    });
  });
  const json = JSON.parse(text);
  expect(json.handrail).toBe(1);
  expect(json.guides['test-guide'].guide.title).toBe('Test guide');
  expect(json.progress['test-guide'].current).toBe(0);
});

test('a text without steps is refused in plain words', async ({ panel }) => {
  await addGuide(panel, 'Just a paragraph, no steps.');
  await expect(panel.getByRole('alert')).toContainText('No steps found');
});
