// Everything Handrail keeps lives in the browser's local extension storage: guides, progress per guide,
// assistants, what was sent, settings. Nothing is synced. Export/import moves it all as one JSON file,
// except the assistants' keys, which never leave the browser.
import browser, { type Storage } from 'webextension-polyfill';
import type { Guide } from '../guide';
import type { Assistant } from '../assistant/types';

export interface GuideSource {
  kind: 'paste' | 'url' | 'file' | 'assistant' | 'check';
  /** The address it was fetched from (kind: url or assistant), or the site checked (kind: check). */
  url?: string;
  /** The file name (kind: file). */
  name?: string;
  /** The assistant's id (kind: assistant). */
  assistant?: string;
  /** The list's `updated` at the time of the fetch (kind: assistant). */
  updated?: string;
}

export interface StoredGuide {
  guide: Guide;
  /** The text as it arrived, kept for re-parsing and for later destinations. */
  raw: string;
  source: GuideSource;
  added: string;
  updated: string;
}

export interface Progress {
  /** Index of the open step; equal to steps.length when the guide is finished. */
  current: number;
  done: number[];
  skipped: number[];
  finished?: string;
  updated: string;
}

/** Where a note back goes when the person presses Send. */
export type NotesTo =
  | { kind: 'copy' }
  | { kind: 'file' }
  | { kind: 'mail' }
  | { kind: 'webhook'; url: string; header?: string }
  | { kind: 'assistant'; assistant: string };

export interface Settings {
  textSize: 'normal' | 'large' | 'larger';
  notesTo: NotesTo;
  /** A count of new notices and guides on the toolbar button. */
  badge: boolean;
}

/** One thing sent: an ask or a note. Kept so it can be seen again and sent again. */
export interface SentItem {
  id: string;
  kind: 'ask' | 'note';
  /** Where it went, as the person saw it: "Perseus", "the clipboard", "a file". */
  to: string;
  assistant?: string;
  time: string;
  text: string;
  guide?: string;
  title?: string;
  step?: number;
  stepTitle?: string;
  page?: { url: string; title?: string };
  /** What came back, in the assistant's words. */
  reply?: string;
  /** Why it did not arrive, in plain words. */
  error?: string;
}

export interface State {
  guides: Record<string, StoredGuide>;
  progress: Record<string, Progress>;
  settings: Settings;
  assistants: Record<string, Assistant>;
  sent: SentItem[];
}

export interface ExportFile extends State {
  handrail: 1;
  version: string;
  exported: string;
}

export const defaultSettings: Settings = { textSize: 'normal', notesTo: { kind: 'copy' }, badge: true };

const SENT_MAX = 50;
const KEYS = ['guides', 'progress', 'settings', 'assistants', 'sent'] as const;

const area = () => browser.storage.local;

export async function loadState(): Promise<State> {
  const r = (await area().get([...KEYS])) as Partial<State>;
  return {
    guides: r.guides ?? {},
    progress: r.progress ?? {},
    settings: { ...defaultSettings, ...(r.settings ?? {}) },
    assistants: r.assistants ?? {},
    sent: Array.isArray(r.sent) ? r.sent : [],
  };
}

export async function saveGuide(stored: StoredGuide): Promise<void> {
  const { guides } = await loadState();
  guides[stored.guide.id] = stored;
  await area().set({ guides });
}

export async function removeGuide(id: string): Promise<void> {
  const { guides, progress } = await loadState();
  delete guides[id];
  delete progress[id];
  await area().set({ guides, progress });
}

export async function setProgress(id: string, p: Progress): Promise<void> {
  const { guides, progress } = await loadState();
  progress[id] = p;
  const g = guides[id];
  if (g) g.updated = p.updated;
  await area().set({ progress, guides });
}

export async function setSettings(settings: Settings): Promise<void> {
  await area().set({ settings });
}

// ---- assistants

export async function saveAssistant(a: Assistant): Promise<void> {
  const { assistants } = await loadState();
  assistants[a.id] = a;
  await area().set({ assistants });
}

/** Changes some fields of one assistant, reading the rest fresh so two writers seldom collide. */
export async function patchAssistant(id: string, patch: Partial<Assistant>): Promise<void> {
  const { assistants } = await loadState();
  const a = assistants[id];
  if (!a) return;
  assistants[id] = { ...a, ...patch };
  await area().set({ assistants });
}

export async function removeAssistant(id: string): Promise<void> {
  const { assistants, settings } = await loadState();
  delete assistants[id];
  const next: Partial<State> = { assistants };
  if (settings.notesTo.kind === 'assistant' && settings.notesTo.assistant === id) {
    next.settings = { ...settings, notesTo: { kind: 'copy' } };
  }
  await area().set(next);
}

/** Marks every guide and notice of an assistant as looked at. */
export async function markSeen(id: string, what: { guides?: boolean; notices?: boolean }): Promise<void> {
  const { assistants } = await loadState();
  const a = assistants[id];
  if (!a) return;
  const patch: Partial<Assistant> = {};
  if (what.guides) patch.seenGuides = a.guides.map((g) => g.id);
  if (what.notices) patch.seenNotices = a.notices.map((n) => n.id);
  assistants[id] = { ...a, ...patch };
  await area().set({ assistants });
}

// ---- sent

export async function addSent(item: SentItem): Promise<void> {
  const { sent } = await loadState();
  await area().set({ sent: [item, ...sent.filter((s) => s.id !== item.id)].slice(0, SENT_MAX) });
}

export async function patchSent(id: string, patch: Partial<SentItem>): Promise<void> {
  const { sent } = await loadState();
  await area().set({ sent: sent.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}

export async function clearSent(): Promise<void> {
  await area().set({ sent: [] });
}

export function freshProgress(): Progress {
  return { current: 0, done: [], skipped: [], updated: now() };
}

export function now(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The export: everything, minus the assistants' keys. */
export function exportState(state: State, version: string): ExportFile {
  const assistants: Record<string, Assistant> = {};
  for (const [id, a] of Object.entries(state.assistants)) {
    const { key: _key, ...rest } = a;
    assistants[id] = rest;
  }
  return { handrail: 1, version, exported: now(), ...state, assistants };
}

/** Reads an export file. Throws with a plain message when it is not one. */
export function parseImport(text: string): ExportFile {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('That file is not JSON.');
  }
  const o = obj as Partial<ExportFile> | null;
  if (!o || typeof o !== 'object' || o.handrail !== 1 || typeof o.guides !== 'object') {
    throw new Error('That file is not a Handrail export.');
  }
  return {
    handrail: 1,
    version: String(o.version ?? ''),
    exported: String(o.exported ?? ''),
    guides: o.guides ?? {},
    progress: o.progress ?? {},
    settings: { ...defaultSettings, ...(o.settings ?? {}) },
    assistants: o.assistants && typeof o.assistants === 'object' ? o.assistants : {},
    sent: Array.isArray(o.sent) ? o.sent : [],
  };
}

/** Merges an export into what is here; a guide or assistant with the same id is replaced (a kept key stays). */
export async function importState(file: ExportFile): Promise<number> {
  const state = await loadState();
  const ids = Object.keys(file.guides);
  for (const id of ids) {
    state.guides[id] = file.guides[id]!;
    const p = file.progress[id];
    if (p) state.progress[id] = p;
  }
  for (const [id, a] of Object.entries(file.assistants)) {
    const key = state.assistants[id]?.key;
    state.assistants[id] = key ? { ...a, key } : a;
  }
  const seen = new Set(state.sent.map((s) => s.id));
  state.sent = [...state.sent, ...file.sent.filter((s) => !seen.has(s.id))]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, SENT_MAX);
  state.settings = { ...state.settings, ...file.settings };
  await area().set({
    guides: state.guides,
    progress: state.progress,
    settings: state.settings,
    assistants: state.assistants,
    sent: state.sent,
  });
  return ids.length;
}

export async function clearAll(): Promise<void> {
  await area().clear();
}

/** Calls back whenever anything in local storage changes. Returns the unsubscribe. */
export function onStateChange(cb: () => void): () => void {
  const listener = (_changes: unknown, areaName: string) => {
    if (areaName === 'local') cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

// ---- the drawer's own position (which view is open), kept for the browser session only

export interface UiState {
  view: 'home' | 'guide' | 'settings' | 'frame' | 'sitecheck';
  guideId?: string;
  /** The page shown in the drawer (view: frame). */
  frameUrl?: string;
  frameTitle?: string;
}

/** Session storage: gone when the browser closes. Older browsers may lack it; then the drawer opens on Home. */
const session = (): Storage.StorageArea | undefined =>
  (browser.storage as unknown as { session?: Storage.StorageArea }).session;

export async function loadUi(): Promise<UiState> {
  try {
    const r = (await session()?.get('ui')) as { ui?: UiState } | undefined;
    return r?.ui ?? { view: 'home' };
  } catch {
    return { view: 'home' };
  }
}

export async function saveUi(ui: UiState): Promise<void> {
  try {
    await session()?.set({ ui });
  } catch {
    // session storage is a convenience; nothing is lost without it
  }
}
