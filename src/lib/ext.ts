// The one place that talks to the browser's tabs, permissions and the background.
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

/** The origin pattern for an http(s) address, or a plain error. */
export function originOf(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    return `${u.protocol}//${u.host}/*`;
  } catch {
    throw new Error('That is not an http or https address.');
  }
}

/**
 * Asks the browser for permission to reach one origin, with its prompt. Call it first thing in a
 * click handler, before any other await, so the browser still counts it as the person's click.
 */
export async function requestOrigin(url: string): Promise<void> {
  const origin = originOf(url);
  const granted = await browser.permissions.request({ origins: [origin] });
  if (!granted) throw new Error(`No permission to reach ${origin.slice(0, -2)}.`);
}

/** Makes sure an origin may be reached: no prompt when it already may (an assistant's own origin). */
export async function ensureOrigin(url: string): Promise<void> {
  const origin = originOf(url);
  if (await browser.permissions.contains({ origins: [origin] })) return;
  await requestOrigin(url);
}

/** Asks the browser for permission to read one origin, then fetches text from it. */
export async function fetchText(url: string): Promise<string> {
  await requestOrigin(url);
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  } catch {
    throw new Error('Could not reach that address.');
  }
  if (!res.ok) throw new Error(`That address answered ${res.status}.`);
  return res.text();
}

/** What one probe of an address came back with. */
export interface ProbeResult {
  status: number;
  text: string;
  /** The address after redirects. */
  url: string;
}

/**
 * Reads one address without a permission prompt; ask for the origin first (requestOrigin).
 * Null when the network said no. Redirects are followed, so `url` says where it ended up.
 */
export async function fetchProbe(url: string): Promise<ProbeResult | null> {
  try {
    const res = await fetch(url, { credentials: 'omit', cache: 'no-store', redirect: 'follow' });
    return { status: res.status, text: await res.text(), url: res.url };
  } catch {
    return null;
  }
}

/**
 * Can this page be shown inside the drawer? Looks at the headers only; the page itself is not read.
 * Needs permission for the origin, which an assistant's address already has.
 */
export async function frameable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', credentials: 'omit', cache: 'no-store', redirect: 'follow' });
    const xfo = (res.headers.get('x-frame-options') ?? '').toLowerCase();
    if (xfo.includes('deny') || xfo.includes('sameorigin')) return false;
    const csp = (res.headers.get('content-security-policy') ?? '').toLowerCase();
    const m = /frame-ancestors([^;]*)/.exec(csp);
    if (m) {
      const sources = m[1]!.trim();
      return sources.includes('*') || sources.includes(location.origin) || sources.includes('chrome-extension:') || sources.includes('moz-extension:');
    }
    return true;
  } catch {
    return false;
  }
}

/** Asks the background to read the assistants' lists now. Resolves when it is done. */
export async function refreshNow(id?: string): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: 'refresh', id });
  } catch {
    // no background awake (an old browser, a test page): the drawer shows what it has
  }
}

export const version: string = browser.runtime.getManifest().version;
