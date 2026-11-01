// Reads an assistant's guides list and notices and keeps them in storage. Runs in the background
// (on a timer and when the drawer asks), so there is one writer for these lists.
import browser from 'webextension-polyfill';
import { loadState, now, patchAssistant, type State } from '../store';
import { fetchFeed, fetchNotices } from './client';
import { newCount } from './notes';
import type { Assistant } from './types';

export async function refreshAssistant(id: string): Promise<void> {
  const state = await loadState();
  const a = state.assistants[id];
  if (!a) return;
  const target = { address: a.address, key: a.key };
  const patch: Partial<Assistant> = { checked: now(), error: '' };
  try {
    if (a.card.guides) patch.guides = await fetchFeed(target, a.card.guides);
    if (a.card.notices) patch.notices = await fetchNotices(target, a.card.notices);
  } catch (e) {
    patch.error = e instanceof Error && e.message ? e.message : 'Could not read the assistant.';
  }
  await patchAssistant(id, patch);
}

export async function refreshAll(): Promise<void> {
  const { assistants } = await loadState();
  for (const id of Object.keys(assistants)) await refreshAssistant(id);
}

/** The number on the toolbar button: new notices and new guides, over every assistant. 0 when turned off. */
export function badgeCount(state: State): number {
  if (!state.settings.badge) return 0;
  let n = 0;
  for (const a of Object.values(state.assistants)) {
    const c = newCount(a);
    n += c.guides + c.notices;
  }
  return n;
}

export async function updateBadge(): Promise<void> {
  const n = badgeCount(await loadState());
  try {
    await browser.action.setBadgeText({ text: n > 0 ? String(n) : '' });
  } catch {
    // no action API here (a very old browser): the drawer still shows the counts
  }
}
