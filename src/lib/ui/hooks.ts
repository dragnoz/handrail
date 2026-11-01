import { useEffect, useState } from 'preact/hooks';
import browser, { type Tabs } from 'webextension-polyfill';
import { loadState, onStateChange, type State } from '../store';
import { ownWindowId } from '../ext';

/** Everything in storage, re-read whenever it changes. Null until the first read. */
export function useStoredState(): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void loadState().then((s) => {
        if (alive) setState(s);
      });
    };
    load();
    const off = onStateChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

export interface ActiveTab {
  id?: number;
  url?: string;
  title?: string;
}

/** The tab the person is looking at, in this drawer's window. Updates as they move. */
export function useActiveTab(): ActiveTab {
  const [tab, setTab] = useState<ActiveTab>({});
  useEffect(() => {
    let alive = true;
    let windowId: number | undefined;
    let last = '';
    const refresh = async () => {
      try {
        if (windowId === undefined) windowId = await ownWindowId();
        const [t] = await browser.tabs.query({ active: true, windowId });
        const key = `${t?.id ?? ''}|${t?.url ?? ''}|${t?.title ?? ''}`;
        if (alive && key !== last) {
          last = key;
          const next: ActiveTab = {};
          if (t?.id != null) next.id = t.id;
          if (t?.url) next.url = t.url;
          if (t?.title) next.title = t.title;
          setTab(next);
        }
      } catch {
        // no window yet, or no tabs permission: "where am I" stays quiet
      }
    };
    void refresh();
    const onActivated = (info: Tabs.OnActivatedActiveInfoType) => {
      if (windowId === undefined || info.windowId === windowId) void refresh();
    };
    const onUpdated = (_id: number, change: Tabs.OnUpdatedChangeInfoType, t: Tabs.Tab) => {
      if (!t.active) return;
      if (windowId !== undefined && t.windowId !== windowId) return;
      if (change.url || change.title || change.status === 'complete') void refresh();
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      alive = false;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);
  return tab;
}

/** The message of an error, for the person. */
export function message(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Something went wrong.';
}
