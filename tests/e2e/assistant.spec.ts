// Assistants, end to end: the built extension in Chromium against a small assistant on localhost.
import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
// @ts-expect-error plain JavaScript helpers, shared with the screenshot script
import { startAssistant, siteGuide } from './assistant.mjs';
// @ts-expect-error plain JavaScript helpers, shared with the screenshot script
import { distForTests } from './dist-test.mjs';

interface Assistant {
  url: string;
  card: string;
  asks: Array<{ text: string; page?: { url: string; title?: string } }>;
  notes: Array<{ guide: string; step: number; text: string; page?: { url: string } }>;
  guides: unknown[];
  notices: unknown[];
  texts: Record<string, string>;
  authHeaders: string[];
  close(): Promise<void>;
}

const KEY = 'secret-key-for-tests';

const test = base.extend<{
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  panel: Page;
  assistant: Assistant;
}>({
  context: async ({}, use) => {
    const dist = distForTests() as string;
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
      viewport: { width: 400, height: 900 },
    });
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker);
  },
  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
  panel: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
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
  assistant: async ({}, use) => {
    const a = (await startAssistant({ key: KEY, home: true })) as Assistant;
    a.texts['site-guide.md'] = siteGuide(a.url) as string;
    a.guides.push({
      id: 'site-guide',
      title: 'Site guide',
      url: 'guides/site-guide.md',
      updated: '2026-10-30T10:00:00Z',
      for: 'Dragnoz',
      pages: [`${a.url}/site/*`],
    });
    await use(a);
    await a.close();
  },
});

async function addAssistant(panel: Page, card: string, key = KEY): Promise<void> {
  await panel.getByRole('button', { name: 'Settings', exact: true }).click();
  await panel.getByRole('button', { name: 'Add an assistant…' }).click();
  await panel.getByLabel('Address').fill(card);
  await panel.getByLabel('Key, if it needs one').fill(key);
  await panel.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'Test assistant added' })).toBeVisible();
  await panel.getByRole('button', { name: '← Back' }).click();
}

const badge = (worker: Worker) => worker.evaluate(() => chrome.action.getBadgeText({}));

test('add an assistant with a key: its guides are listed, the key goes along, the button counts the new one', async ({
  panel,
  assistant,
  worker,
}) => {
  await addAssistant(panel, assistant.card);
  const row = panel.getByRole('button', { name: /Test assistant/ });
  await expect(row).toBeVisible();
  await expect(row.getByText('1 new')).toBeVisible();
  expect(await badge(worker)).toBe('1');
  expect(assistant.authHeaders.filter((h) => h === `Bearer ${KEY}`).length).toBeGreaterThan(0);

  await row.click();
  await expect(panel.getByRole('heading', { name: 'Guides', level: 3 })).toBeVisible();
  // looked at: the count clears, the row keeps its "new" tag while open
  await expect.poll(() => badge(worker)).toBe('');
  await panel.getByRole('button', { name: /Site guide/ }).click();
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Site guide');
  await expect(panel.getByText('From the assistant.')).toBeVisible();

  // Home shows where it came from
  await panel.getByRole('button', { name: '← Guides' }).click();
  await expect(panel.getByText('by Test assistant · from Test assistant')).toBeVisible();
});

test('a wrong key is refused in plain words', async ({ panel, assistant }) => {
  await panel.getByRole('button', { name: 'Settings', exact: true }).click();
  await panel.getByRole('button', { name: 'Add an assistant…' }).click();
  await panel.getByLabel('Address').fill(assistant.card);
  await panel.getByLabel('Key, if it needs one').fill('wrong');
  await panel.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('did not accept the key');
});

test('ask: the text and the page go out, the reply shows, and the notice brings the guide back', async ({
  panel,
  assistant,
  context,
}) => {
  await addAssistant(panel, assistant.card);
  const sitePage = await context.newPage();
  await sitePage.goto(`${assistant.url}/site/start`);

  await panel.getByRole('button', { name: /Test assistant/ }).click();
  await panel.getByRole('button', { name: 'Ask Test assistant…' }).click();
  await panel.getByLabel('What do you want to do?').fill('I want to use the Instagram API from my own site.');
  await panel.getByRole('button', { name: 'Send to Test assistant' }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'Working on it.' })).toBeVisible();
  expect(assistant.asks).toHaveLength(1);
  expect(assistant.asks[0]!.text).toBe('I want to use the Instagram API from my own site.');
  expect(assistant.asks[0]!.page?.url).toBe(`${assistant.url}/site/start`);

  // The assistant writes the guide and says so.
  assistant.texts['instagram.md'] = siteGuide(assistant.url, 'instagram-api', 'Use the Instagram API') as string;
  assistant.guides.push({ id: 'instagram-api', title: 'Use the Instagram API', url: 'guides/instagram.md', updated: '2026-11-01T10:00:00Z' });
  assistant.notices.push({ id: 'n-1', text: 'Your guide is ready: Use the Instagram API.', guide: 'guides/instagram.md', time: '2026-11-01T10:01:00Z' });
  await panel.getByRole('button', { name: 'Check now' }).click();
  await expect(panel.getByText('Your guide is ready: Use the Instagram API.')).toBeVisible();
  await panel.getByRole('button', { name: 'Open the guide' }).click();
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Use the Instagram API');

  // Sent, in Settings
  await panel.getByRole('button', { name: 'Settings', exact: true }).click();
  await panel.getByRole('button', { name: 'Show' }).click();
  await expect(panel.getByText('Ask to Test assistant')).toBeVisible();
  await expect(panel.getByText('Working on it.')).toBeVisible();
});

test('a note back goes to the assistant with the step; a key-like note is refused', async ({ panel, assistant }) => {
  await addAssistant(panel, assistant.card);
  await panel.getByRole('button', { name: 'Settings', exact: true }).click();
  await panel.getByRole('radio', { name: 'An assistant' }).check();
  await panel.getByRole('button', { name: '← Back' }).click();
  await panel.getByRole('button', { name: /Test assistant/ }).click();
  await panel.getByRole('button', { name: /Site guide/ }).click();
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Site guide');
  await panel.keyboard.press('n');
  await expect(panel.getByRole('heading', { level: 2, name: 'On the keys page' })).toBeVisible();

  await panel.getByRole('button', { name: 'Send a note back…' }).click();
  await panel.getByLabel('Your note').fill('here it is: sk-proj-AbCdEf0123456789XyZ');
  await panel.getByRole('button', { name: 'Send to Test assistant' }).click();
  await expect(panel.getByRole('alert')).toContainText('looks like a key');
  expect(assistant.notes).toHaveLength(0);

  await panel.getByLabel('Your note').fill('done, but the button was called Add key');
  await panel.getByRole('button', { name: 'Send to Test assistant' }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'Test assistant: Got it.' }).first()).toBeVisible();
  expect(assistant.notes).toHaveLength(1);
  expect(assistant.notes[0]).toMatchObject({ guide: 'site-guide', step: 2, text: 'done, but the button was called Add key' });
});

test('a note to the clipboard, the default', async ({ panel, assistant }) => {
  await addAssistant(panel, assistant.card);
  await panel.getByRole('button', { name: /Test assistant/ }).click();
  await panel.getByRole('button', { name: /Site guide/ }).click();
  await panel.getByRole('button', { name: 'Send a note back…' }).click();
  await panel.getByLabel('Your note').fill('the first step was fine');
  await panel.getByRole('button', { name: 'Send to the clipboard' }).click();
  const copied = await panel.evaluate(() => (window as unknown as { __copied: string | null }).__copied);
  expect(copied).toContain('# Site guide, step 1: Start');
  expect(copied).toContain('the first step was fine');
});

test('there is a guide for this page: offered, never opened by itself', async ({ panel, assistant, context }) => {
  await addAssistant(panel, assistant.card);
  const sitePage = await context.newPage();
  await sitePage.goto(`${assistant.url}/site/keys`);
  const offer = panel.getByRole('status').filter({ hasText: 'There is a guide for this page' });
  await expect(offer).toBeVisible();
  await expect(offer).toContainText('Site guide');
  // still on Home
  await expect(panel.getByRole('heading', { name: 'Your guides' })).toBeVisible();
  await panel.getByRole('button', { name: 'Open it' }).click();
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Site guide');
  // and, on that page, "where am I" offers step 2
  await expect(panel.getByRole('status').filter({ hasText: 'You seem to be on step 2.' })).toBeVisible();
});

test("an assistant's page opens inside the drawer", async ({ panel, assistant }) => {
  await addAssistant(panel, assistant.card);
  await panel.getByRole('button', { name: /Test assistant/ }).click();
  await panel.getByRole('button', { name: 'Open Test assistant' }).click();
  const frame = panel.frameLocator('iframe[title="Test assistant"]');
  await expect(frame.getByRole('heading', { name: 'Assistant home' })).toBeVisible();
  await panel.getByRole('button', { name: '← Guides' }).click();
  await expect(panel.getByRole('heading', { name: 'Your guides' })).toBeVisible();
});

test('export leaves the key out; remove forgets the assistant', async ({ panel, assistant }) => {
  await addAssistant(panel, assistant.card);
  await panel.getByRole('button', { name: 'Settings', exact: true }).click();
  const download = panel.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export…' }).click();
  const file = await download;
  const text = await new Promise<string>((res, rej) => {
    file.createReadStream().then((s) => {
      let data = '';
      s.on('data', (c) => (data += c));
      s.on('end', () => res(data));
      s.on('error', rej);
    });
  });
  expect(text).not.toContain(KEY);
  const json = JSON.parse(text);
  const [a] = Object.values(json.assistants) as Array<{ card: { name: string }; key?: string }>;
  expect(a!.card.name).toBe('Test assistant');
  expect(a!.key).toBeUndefined();

  await panel.getByRole('button', { name: 'Remove', exact: true }).click();
  await panel.getByRole('button', { name: 'Yes, remove' }).click();
  await panel.getByRole('button', { name: '← Back' }).click();
  await expect(panel.getByText('An assistant can send guides here.')).toBeVisible();
});
