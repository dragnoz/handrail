// The site check, end to end: the built extension in Chromium, with example.org answered by the test itself.
import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
// @ts-expect-error plain JavaScript helpers, shared with the screenshot script
import { distForTests } from './dist-test.mjs';

const test = base.extend<{ context: BrowserContext; worker: Worker; extensionId: string; panel: Page }>({
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
});

const INTRUDER = 'zwlnmi9lwnacwxozlbsybmbhscpz1wp6654';

const CLOAKED = `<!doctype html><html><head><meta name="generator" content="WordPress 7.0.8"></head><body>
<div style="position: absolute; left: -17308px;">Want gaming? <a href="https://spam.example.net">casino</a> 1xbet</div>
<p>a theme from wp-content</p></body></html>`;

const CLEAN = `<!doctype html><html><head><link href="/wp-content/themes/plain/style.css"></head>
<body><p>Plain pages about moving house.</p></body></html>`;

/** Answers example.org from the test: the page, the user list (open or closed) and the login. */
async function fakeSite(panel: Page, site: { home: string; users?: string }): Promise<void> {
  await panel.route('https://example.org/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: site.home });
    if (u.pathname === '/wp-json/wp/v2/users') {
      if (site.users) return route.fulfill({ status: 200, contentType: 'application/json', body: site.users });
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"rest_user_cannot_view"}' });
    }
    if (u.pathname === '/wp-login.php') return route.fulfill({ status: 200, contentType: 'text/html', body: '<form>Log in</form>' });
    return route.fulfill({ status: 404, body: 'not found' });
  });
}

async function check(panel: Page, host: string): Promise<void> {
  await panel.getByRole('button', { name: 'Check this site for signs of a break-in' }).click();
  await panel.getByLabel('The site to check').fill(host);
  await panel.getByRole('button', { name: 'Check this site', exact: true }).click();
}

test('a cloaked site with an intruder account: a bad verdict, then the cleanup guide for that site', async ({ panel }) => {
  await fakeSite(panel, { home: CLOAKED, users: JSON.stringify([{ slug: 'kate-austin' }, { slug: INTRUDER }]) });
  await check(panel, 'example.org');

  await expect(panel.locator('.sc-verdict')).toHaveText('Signs of a break-in on example.org.');
  await expect(panel.locator('.sc-verdict')).toHaveClass(/bad/);
  await expect(panel.getByText('Content pushed off-screen')).toBeVisible();
  await expect(panel.getByText('Spam wording on the page: casino, 1xbet')).toBeVisible();
  await expect(panel.getByText(`Machine-made account name(s): ${INTRUDER}`)).toBeVisible();
  await expect(panel.getByText('The login stays on this site.')).toBeVisible();

  // The report for the host: previewed, then copied; nothing goes anywhere by itself.
  await panel.getByRole('button', { name: 'For the host' }).click();
  await expect(panel.getByLabel('The report')).toHaveValue(/suspected break-in, please scan/);
  await expect(panel.getByLabel('The report')).toHaveValue(new RegExp(INTRUDER));
  await panel.getByRole('button', { name: 'Copy', exact: true }).click();
  const copied = await panel.evaluate(() => (window as unknown as { __copied: string | null }).__copied);
  expect(copied).toContain('# example.org: suspected break-in');

  await panel.getByRole('button', { name: 'Walk me through the cleanup' }).click();
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Clean up example.org');
  await expect(panel.getByRole('heading', { level: 2, name: 'Lock your email account first' })).toBeVisible();

  // The list line says where it came from.
  await panel.getByRole('button', { name: '← Guides' }).click();
  await expect(panel.getByText('by Handrail site check · from the site check')).toBeVisible();
});

test('a clean, closed-up site: a good verdict and no cleanup offered', async ({ panel }) => {
  await fakeSite(panel, { home: CLEAN });
  await check(panel, 'https://example.org/some/page');

  await expect(panel.locator('.sc-verdict')).toHaveText('No signs of a break-in found on example.org.');
  await expect(panel.locator('.sc-verdict')).toHaveClass(/good/);
  await expect(panel.getByText('Closed to outsiders. That is how it should be.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Walk me through the cleanup' })).toHaveCount(0);

  await panel.getByRole('button', { name: 'A general overview' }).click();
  await expect(panel.getByLabel('The report')).toHaveValue(/No problems found by these checks/);
});

test('no address: a plain error, nothing read', async ({ panel }) => {
  let reads = 0;
  await panel.route('https://example.org/**', (route) => {
    reads++;
    return route.fulfill({ status: 200, body: '' });
  });
  await check(panel, '');
  await expect(panel.locator('.error')).toHaveText('Type a site address, like example.org.');
  expect(reads).toBe(0);
});
