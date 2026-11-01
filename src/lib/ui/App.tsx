import { useEffect, useState } from 'preact/hooks';
import { loadUi, saveUi, type UiState } from '../store';
import { refreshNow } from '../ext';
import { useActiveTab, useStoredState } from './hooks';
import { Toaster } from './toast';
import { Home } from './Home';
import { GuideView } from './GuideView';
import { ListView } from './ListView';
import { Settings } from './Settings';
import { Frame } from './Frame';
import { SiteCheck } from './SiteCheck';

interface Props {
  /** The drawer, or the browser's options page (settings only). */
  mode: 'panel' | 'options';
}

export function App({ mode }: Props) {
  const state = useStoredState();
  const tab = useActiveTab();
  const [ui, setUi] = useState<UiState | null>(null);

  useEffect(() => {
    void loadUi().then(setUi);
    // The drawer opened: read the assistants' lists once, so new guides and notices show.
    if (mode === 'panel') void refreshNow();
  }, [mode]);

  useEffect(() => {
    if (state) document.documentElement.dataset.size = state.settings.textSize;
  }, [state?.settings.textSize]);

  if (!state || !ui) return <div class="loading">Loading…</div>;

  const go = (next: UiState) => {
    setUi(next);
    void saveUi(next);
  };

  if (mode === 'options') {
    return (
      <>
        <Settings state={state} standalone />
        <Toaster />
      </>
    );
  }

  const stored = ui.view === 'guide' && ui.guideId ? state.guides[ui.guideId] : undefined;
  let view;
  if (stored) {
    const View = stored.guide.kind === 'list' ? ListView : GuideView;
    view = (
      <View
        stored={stored}
        progress={state.progress[stored.guide.id]}
        state={state}
        tab={tab}
        onHome={() => go({ view: 'home' })}
        onSettings={() => go({ view: 'settings' })}
      />
    );
  } else if (ui.view === 'settings') {
    view = <Settings state={state} onBack={() => go({ view: 'home' })} />;
  } else if (ui.view === 'frame' && ui.frameUrl) {
    view = <Frame url={ui.frameUrl} title={ui.frameTitle ?? ''} onBack={() => go({ view: 'home' })} />;
  } else if (ui.view === 'sitecheck') {
    view = (
      <SiteCheck
        state={state}
        tab={tab}
        onBack={() => go({ view: 'home' })}
        onOpen={(id) => go({ view: 'guide', guideId: id })}
      />
    );
  } else {
    view = (
      <Home
        state={state}
        tab={tab}
        onOpen={(id) => go({ view: 'guide', guideId: id })}
        onSettings={() => go({ view: 'settings' })}
        onFrame={(url, title) => go({ view: 'frame', frameUrl: url, frameTitle: title })}
        onSiteCheck={() => go({ view: 'sitecheck' })}
      />
    );
  }

  return (
    <>
      {view}
      <Toaster />
    </>
  );
}
