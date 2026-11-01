// Talks to an assistant over plain fetch. No browser extension API here, so it runs in the drawer,
// in the background and in tests alike. The key goes only to addresses on the assistant's own origin.
import { AssistantError, parseCard, parseFeed, parseNotices, parseReply, sameOrigin } from './parse';
import type { AskPayload, Card, FeedEntry, NotePayload, Notice, Reply } from './types';

export interface Target {
  /** The card's address: the origin the key belongs to. */
  address: string;
  key?: string;
}

const TIMEOUT_MS = 15_000;

export async function fetchCard(target: Target): Promise<Card> {
  return parseCard(await getJson(target, target.address), target.address);
}

export async function fetchFeed(target: Target, url: string): Promise<FeedEntry[]> {
  return parseFeed(await getJson(target, url), url);
}

export async function fetchNotices(target: Target, url: string): Promise<Notice[]> {
  return parseNotices(await getJson(target, url), url);
}

/** A guide's text, Markdown or JSON, as it is. */
export async function fetchGuideText(target: Target, url: string): Promise<string> {
  const res = await request(target, url, { method: 'GET' });
  return res.text();
}

export async function postAsk(target: Target, url: string, payload: AskPayload): Promise<Reply> {
  return postJson(target, url, payload);
}

export async function postNote(target: Target, url: string, payload: NotePayload): Promise<Reply> {
  return postJson(target, url, payload);
}

async function postJson(target: Target, url: string, body: unknown): Promise<Reply> {
  const res = await request(target, url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return parseReply(JSON.parse(text), url);
  } catch {
    return {};
  }
}

async function getJson(target: Target, url: string): Promise<unknown> {
  const res = await request(target, url, { method: 'GET' });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new AssistantError('That address did not answer with JSON.');
  }
}

async function request(target: Target, url: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json, text/markdown, text/plain;q=0.9, */*;q=0.1');
  if (target.key && sameOrigin(url, target.address)) headers.set('authorization', `Bearer ${target.key}`);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, credentials: 'omit', cache: 'no-store', signal: ctl.signal });
  } catch {
    throw new AssistantError('Could not reach the assistant.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) throw new AssistantError('The assistant did not accept the key.');
  if (!res.ok) throw new AssistantError(`The assistant answered ${res.status}.`);
  return res;
}
