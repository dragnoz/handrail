// The one place that talks to the browser's tabs and permissions.
// webextension-polyfill gives the same promise API in Chrome and Firefox.
import browser, { type Tabs } from 'webextension-polyfill';

/** The tab the person is looking at, in the window this drawer belongs to. */
export async function activeTab(): Promise<Tabs.Tab | undefined> {
  const win = await browser.windows.getCurrent();
  const [tab] = await browser.tabs.query({ active: true, windowId: win.id });
  return tab;
}

/** True for addresses the drawer may open in a tab. */
export function isOpenable(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Opens an address in the current tab, under the drawer. Never a new window. */
export async function openHere(url: string): Promise<void> {
  const tab = await activeTab();
  if (tab?.id != null) await browser.tabs.update(tab.id, { url });
  else await browser.tabs.create({ url });
}

/** The id of the window this drawer belongs to. */
export async function ownWindowId(): Promise<number | undefined> {
  const win = await browser.windows.getCurrent();
  return win.id;
}

/** Asks the browser for permission to read one origin, then fetches text from it. */
export async function fetchText(url: string): Promise<string> {
  let origin: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    origin = `${u.protocol}//${u.host}/*`;
  } catch {
    throw new Error('That is not an http or https address.');
  }
  // Called before any await, so it still counts as the person's click.
  const granted = await browser.permissions.request({ origins: [origin] });
  if (!granted) throw new Error(`No permission to read ${origin.slice(0, -2)}.`);
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  } catch {
    throw new Error('Could not reach that address.');
  }
  if (!res.ok) throw new Error(`That address answered ${res.status}.`);
  return res.text();
}

export const version: string = browser.runtime.getManifest().version;
