// Reads what an assistant sends, refusing bad shapes in plain words. Pure; tested against docs/assistant.md.
import type { Card, FeedEntry, Notice, Reply } from './types';

export class AssistantError extends Error {}

const NAME_MAX = 60;
const TEXT_MAX = 300;

/** The card an assistant's address answers. Relative addresses are resolved against the card's own. */
export function parseCard(json: unknown, address: string): Card {
  const o = obj(json);
  if (!o || o.handrail !== 1) throw new AssistantError('That address does not answer as a Handrail assistant.');
  const name = str(o.name).trim();
  if (!name) throw new AssistantError('The assistant has no name.');
  const card: Card = { name: name.slice(0, NAME_MAX) };
  for (const part of ['guides', 'ask', 'notes', 'notices', 'home'] as const) {
    const v = str(o[part]).trim();
    if (!v) continue;
    const abs = absolute(v, address);
    if (!abs) throw new AssistantError(`The assistant's "${part}" address is not an http or https address.`);
    card[part] = abs;
  }
  return card;
}

/** The guides list: a JSON list, or an object with a `guides` list. */
export function parseFeed(json: unknown, base: string): FeedEntry[] {
  const list = Array.isArray(json) ? json : obj(json)?.guides;
  if (!Array.isArray(list)) throw new AssistantError('The guides list is not a list.');
  const out: FeedEntry[] = [];
  for (const item of list) {
    const o = obj(item);
    if (!o) continue;
    const id = str(o.id).trim();
    const title = str(o.title).trim();
    const url = absolute(str(o.url).trim(), base);
    if (!id || !title || !url) continue; // a line without id, title or address is not a guide
    const entry: FeedEntry = {
      id,
      title: title.slice(0, TEXT_MAX),
      url,
      updated: str(o.updated),
      pages: strings(o.pages),
    };
    const f = str(o.for).trim();
    if (f) entry.for = f.slice(0, NAME_MAX);
    out.push(entry);
  }
  return out;
}

/** The notices list: a JSON list, or an object with a `notices` list. */
export function parseNotices(json: unknown, base: string): Notice[] {
  const list = Array.isArray(json) ? json : obj(json)?.notices;
  if (!Array.isArray(list)) throw new AssistantError('The notices list is not a list.');
  const out: Notice[] = [];
  for (const item of list) {
    const o = obj(item);
    if (!o) continue;
    const id = str(o.id).trim();
    const text = str(o.text).trim();
    if (!id || !text) continue;
    const n: Notice = { id, text: text.slice(0, TEXT_MAX) };
    const guide = absolute(str(o.guide).trim(), base);
    if (guide) n.guide = guide;
    const url = absolute(str(o.url).trim(), base);
    if (url) n.url = url;
    const time = str(o.time);
    if (time) n.time = time;
    out.push(n);
  }
  return out;
}

/** What came back from an ask or a note. Anything that is not an object is an empty reply. */
export function parseReply(json: unknown, base: string): Reply {
  const o = obj(json);
  const r: Reply = {};
  if (!o) return r;
  const message = str(o.message).trim();
  if (message) r.message = message.slice(0, TEXT_MAX);
  const guide = absolute(str(o.guide).trim(), base);
  if (guide) r.guide = guide;
  return r;
}

/** An http(s) address, resolved against a base when relative; null for anything else. */
export function absolute(v: string, base: string): string | null {
  if (!v) return null;
  try {
    const u = new URL(v, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/** True when two addresses share scheme, host and port: the key goes only there. */
export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** The host of an address, for a short line in the UI. */
export function hostOf(address: string): string {
  try {
    return new URL(address).host;
  } catch {
    return address;
  }
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

function strings(v: unknown): string[] {
  if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.map(str).map((s) => s.trim()).filter(Boolean);
}
