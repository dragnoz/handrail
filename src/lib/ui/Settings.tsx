import { useRef, useState } from 'preact/hooks';
import {
  clearAll,
  exportState,
  importState,
  parseImport,
  setSettings,
  type Settings as SettingsShape,
  type State,
} from '../store';
import { openHere, version } from '../ext';
import { message } from './hooks';
import { toast } from './toast';

interface Props {
  state: State;
  onBack?: () => void;
  /** The browser's options page: no back button, a heading instead. */
  standalone?: boolean;
}

const REPO = 'https://github.com/dragnoz/handrail';

export function Settings({ state, onBack, standalone }: Props) {
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function setSize(textSize: SettingsShape['textSize']): void {
    void setSettings({ ...state.settings, textSize });
  }

  function exportAll(): void {
    const file = exportState(state, version);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handrail-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Exported');
  }

  async function importFile(file: File): Promise<void> {
    setError('');
    try {
      const parsed = parseImport(await file.text());
      const count = await importState(parsed);
      toast(count === 1 ? '1 guide imported' : `${count} guides imported`);
    } catch (e) {
      setError(message(e));
    }
  }

  const guideCount = Object.keys(state.guides).length;

  return (
    <div class="view">
      <header class="top">
        {standalone ? (
          <div class="brand">
            <img src="/icons/icon-32.png" alt="" width="22" height="22" />
            <span>Handrail settings</span>
          </div>
        ) : (
          <button class="btn btn-quiet" onClick={onBack}>
            ← Back
          </button>
        )}
      </header>

      <fieldset>
        <legend>Text size</legend>
        <div class="radios">
          {(['normal', 'large', 'larger'] as const).map((s) => (
            <label key={s}>
              <input type="radio" name="size" checked={state.settings.textSize === s} onChange={() => setSize(s)} />
              {s === 'normal' ? 'Normal' : s === 'large' ? 'Large' : 'Larger'}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Your data</legend>
        <p>
          {guideCount === 1 ? '1 guide' : `${guideCount} guides`}, with progress and settings, all in this browser.
          Export puts it in one JSON file; import reads such a file back and replaces guides with the same id.
        </p>
        <div class="stack">
          <button class="btn" onClick={exportAll}>
            Export…
          </button>
          <button class="btn" onClick={() => fileInput.current?.click()}>
            Import…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            class="visually-hidden"
            tabIndex={-1}
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) void importFile(f);
              (e.target as HTMLInputElement).value = '';
            }}
          />
        </div>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>Remove everything</legend>
        {confirmClear ? (
          <>
            <p>This removes every guide, all progress and the settings. There is no undo.</p>
            <div class="stack">
              <button
                class="btn btn-danger"
                onClick={() => {
                  setConfirmClear(false);
                  void clearAll().then(() => toast('Everything removed'));
                }}
              >
                Remove everything
              </button>
              <button class="btn" onClick={() => setConfirmClear(false)}>
                Keep it
              </button>
            </div>
          </>
        ) : (
          <div class="stack">
            <button class="btn" onClick={() => setConfirmClear(true)}>
              Remove all Handrail data…
            </button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>About</legend>
        <p>
          Handrail {version}. Open source, MIT. Nothing leaves this browser: there is no account, no server and no
          telemetry. The <code>tabs</code> permission lets the drawer see the address of the tab you are on, for
          "where am I" and "open here"; nothing is recorded.
        </p>
        <div class="stack">
          {standalone ? (
            <a class="btn" href={REPO}>
              Source and guide format
            </a>
          ) : (
            <button class="btn" onClick={() => void openHere(REPO)}>
              Source and guide format
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}
