import { useEffect, useState } from 'preact/hooks';
import { loadUi, saveUi, type UiState } from '../store';
import { useStoredState } from './hooks';
import { Toaster } from './toast';
import { Home } from './Home';
import { GuideView } from './GuideView';
import { Settings } from './Settings';

interface Props {
  /** The drawer, or the browser's options page (settings only). */
  mode: 'panel' | 'options';
}

export function App({ mode }: Props) {
  const state = useStoredState();
  const [ui, setUi] = useState<UiState | null>(null);

  useEffect(() => {
    void loadUi().then(setUi);
  }, []);

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
    view = (
      <GuideView
        stored={stored}
        progress={state.progress[stored.guide.id]}
        onHome={() => go({ view: 'home' })}
        onSettings={() => go({ view: 'settings' })}
      />
    );
  } else if (ui.view === 'settings') {
    view = <Settings state={state} onBack={() => go({ view: 'home' })} />;
  } else {
    view = (
      <Home
        state={state}
        onOpen={(id) => go({ view: 'guide', guideId: id })}
        onSettings={() => go({ view: 'settings' })}
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
