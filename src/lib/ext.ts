// The one place that talks to the browser's tabs. 0.2 swaps in webextension-polyfill here for Firefox.

/** The tab the person is looking at, in the window this drawer belongs to. */
export async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const win = await chrome.windows.getCurrent();
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  return tab;
}

/** True for addresses the drawer may open in a tab. */
export function isOpenable(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Opens an address in the current tab, under the drawer. Never a new window. */
export async function openHere(url: string): Promise<void> {
  const tab = await activeTab();
  if (tab?.id != null) await chrome.tabs.update(tab.id, { url });
  else await chrome.tabs.create({ url });
}

/** The id of the window this drawer belongs to. */
export async function ownWindowId(): Promise<number | undefined> {
  const win = await chrome.windows.getCurrent();
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
  const granted = await chrome.permissions.request({ origins: [origin] });
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

export const version: string = chrome.runtime.getManifest().version;
