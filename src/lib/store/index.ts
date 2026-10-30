// Everything Handrail keeps lives in the browser's local extension storage: guides, progress per guide, settings.
// Nothing is synced. Export/import moves it all as one JSON file.
import browser, { type Storage } from 'webextension-polyfill';
import type { Guide } from '../guide';

export interface GuideSource {
  kind: 'paste' | 'url' | 'file';
  /** The address it was fetched from (kind: url). */
  url?: string;
  /** The file name (kind: file). */
  name?: string;
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

export interface Settings {
  textSize: 'normal' | 'large' | 'larger';
}

export interface State {
  guides: Record<string, StoredGuide>;
  progress: Record<string, Progress>;
  settings: Settings;
}

export interface ExportFile extends State {
  handrail: 1;
  version: string;
  exported: string;
}

export const defaultSettings: Settings = { textSize: 'normal' };

const area = () => browser.storage.local;

export async function loadState(): Promise<State> {
  const r = (await area().get(['guides', 'progress', 'settings'])) as Partial<State>;
  return {
    guides: r.guides ?? {},
    progress: r.progress ?? {},
    settings: { ...defaultSettings, ...(r.settings ?? {}) },
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

export function freshProgress(): Progress {
  return { current: 0, done: [], skipped: [], updated: now() };
}

export function now(): string {
  return new Date().toISOString();
}

export function exportState(state: State, version: string): ExportFile {
  return { handrail: 1, version, exported: now(), ...state };
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
  };
}

/** Merges an export into what is here; a guide with the same id is replaced. */
export async function importState(file: ExportFile): Promise<number> {
  const state = await loadState();
  const ids = Object.keys(file.guides);
  for (const id of ids) {
    state.guides[id] = file.guides[id]!;
    const p = file.progress[id];
    if (p) state.progress[id] = p;
  }
  state.settings = { ...state.settings, ...file.settings };
  await area().set({ guides: state.guides, progress: state.progress, settings: state.settings });
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
  view: 'home' | 'guide' | 'settings';
  guideId?: string;
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
