import type { Guide } from './types';

/**
 * Does a step's `url:` match the page the person is on?
 * A pattern with `*` matches any characters there. A plain address matches exactly
 * (the `#fragment`, a trailing slash and letter case are ignored).
 */
export function urlMatches(pattern: string, url: string): boolean {
  const p = normalise(pattern);
  const u = normalise(url);
  if (!p || !u) return false;
  if (p.includes('*')) {
    const re = new RegExp('^' + p.split('*').map(escapeRegExp).join('.*') + '$', 'i');
    return re.test(u);
  }
  return p.toLowerCase() === u.toLowerCase();
}

/**
 * "Where am I": the first step after the current one whose `url:` matches the tab.
 * Null when the current step itself matches, or when nothing later does.
 * It only answers; the drawer never jumps by itself.
 */
export function whereAmI(guide: Guide, current: number, tabUrl: string | undefined): number | null {
  if (!tabUrl) return null;
  const here = guide.steps[current];
  if (here && here.url.some((p) => urlMatches(p, tabUrl))) return null;
  for (let i = current + 1; i < guide.steps.length; i++) {
    const step = guide.steps[i]!;
    if (step.url.some((p) => urlMatches(p, tabUrl))) return i;
  }
  return null;
}

/**
 * For a list: the first item not in `exclude` (the ticked, the skipped, the open one) whose `url:` matches
 * the tab, whichever it is. Null when none does. It only answers; the drawer never jumps by itself.
 */
export function whichItem(guide: Guide, tabUrl: string | undefined, exclude: number[]): number | null {
  if (!tabUrl) return null;
  for (let i = 0; i < guide.steps.length; i++) {
    if (exclude.includes(i)) continue;
    if (guide.steps[i]!.url.some((p) => urlMatches(p, tabUrl))) return i;
  }
  return null;
}

const ORIGIN_ONLY = /^[a-z*][a-z0-9+.*-]*:\/\/[^/]*$/i;

/** Drops the fragment; a bare origin always ends in `/`; any other trailing slash is dropped. */
function normalise(s: string): string {
  let v = s.trim();
  const hash = v.indexOf('#');
  if (hash >= 0) v = v.slice(0, hash);
  if (ORIGIN_ONLY.test(v)) return v + '/';
  if (v.endsWith('/') && ORIGIN_ONLY.test(v.slice(0, -1))) return v;
  if (v.endsWith('/') && !v.endsWith('*/')) v = v.slice(0, -1);
  return v;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
