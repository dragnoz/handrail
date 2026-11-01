import { useRef, useState } from 'preact/hooks';
import { parseGuide } from '../guide';
import { guideForPage } from '../assistant';
import {
  freshProgress,
  now,
  removeGuide,
  saveGuide,
  setProgress,
  type GuideSource,
  type Progress,
  type State,
  type StoredGuide,
} from '../store';
import { fetchText } from '../ext';
import { message, type ActiveTab } from './hooks';
import { toast } from './toast';
import { addGuideFrom, Assistants } from './Assistants';

interface Props {
  state: State;
  tab: ActiveTab;
  onOpen: (id: string) => void;
  onSettings: () => void;
  onFrame: (url: string, title: string) => void;
}

/** Home: a box to add a guide, the guides you have, newest first, and your assistants. */
export function Home({ state, tab, onOpen, onSettings, onFrame }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [dismissedOffer, setDismissedOffer] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function addText(raw: string, source: GuideSource): Promise<void> {
    const guide = parseGuide(raw);
    const existing = state.guides[guide.id];
    const stored: StoredGuide = {
      guide,
      raw,
      source,
      added: existing?.added ?? now(),
      updated: now(),
    };
    await saveGuide(stored);
    if (!state.progress[guide.id]) await setProgress(guide.id, freshProgress());
    setText('');
    setError('');
    toast(existing ? 'Guide updated' : 'Guide added');
    onOpen(guide.id);
  }

  async function add(): Promise<void> {
    const t = text.trim();
    if (!t) {
      setError('Paste a guide, or a link to one, first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (/^https?:\/\/\S+$/i.test(t)) {
        const raw = await fetchText(t);
        await addText(raw, { kind: 'url', url: t });
      } else {
        await addText(t, { kind: 'paste' });
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function addFile(file: File): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const raw = await file.text();
      await addText(raw, { kind: 'file', name: file.name });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      void addFile(file);
      return;
    }
    const dropped = e.dataTransfer?.getData('text/plain');
    if (dropped) setText(dropped);
  }

  // "There is a guide for this page": an assistant lists a guide whose pages match the tab.
  const offer = guideForPage(Object.values(state.assistants), tab.url);
  const offerKey = offer ? `${offer.entry.id}|${tab.url ?? ''}` : '';
  const showOffer = !!offer && dismissedOffer !== offerKey;

  async function takeOffer(): Promise<void> {
    if (!offer) return;
    setBusy(true);
    setError('');
    try {
      const id = await addGuideFrom(state, offer.assistant, offer.entry.url, offer.entry);
      onOpen(id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const guides = Object.values(state.guides).sort((a, b) => b.updated.localeCompare(a.updated));

  return (
    <div
      class={dragging ? 'view dragging' : 'view'}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header class="top">
        <div class="brand">
          <img src="/icons/icon-32.png" alt="" width="22" height="22" />
          <span>Handrail</span>
        </div>
        <button class="btn btn-quiet" onClick={onSettings} aria-label="Settings" title="Settings">
          ⚙
        </button>
      </header>

      {showOffer && offer && (
        <div class="where" role="status">
          <span>
            There is a guide for this page: <b>{offer.entry.title}</b>.
          </span>
          <button class="btn btn-primary" onClick={() => void takeOffer()} disabled={busy}>
            Open it
          </button>
          <button class="btn btn-quiet" onClick={() => setDismissedOffer(offerKey)}>
            Not now
          </button>
        </div>
      )}

      <label class="visually-hidden" for="paste">
        Paste a guide, or a link to one
      </label>
      <textarea
        id="paste"
        class="paste"
        placeholder="Paste a guide here, or a link to one"
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        spellcheck={false}
      />
      <div class="add-row">
        <button class="btn btn-primary" onClick={() => void add()} disabled={busy}>
          {busy ? 'Adding…' : 'Add guide'}
        </button>
        <button class="btn" onClick={() => fileInput.current?.click()} disabled={busy}>
          Open a file…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
          class="visually-hidden"
          tabIndex={-1}
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) void addFile(f);
            (e.target as HTMLInputElement).value = '';
          }}
        />
      </div>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      <p class="hint">Markdown or JSON. You can also drop a .md file on this panel.</p>

      <h2 class="section">Your guides</h2>
      {guides.length === 0 && <p class="empty">No guides yet. Paste one above, or open a file.</p>}
      <ul class="guides">
        {guides.map((g) => {
          const p = state.progress[g.guide.id];
          const n = g.guide.steps.length;
          return (
            <li key={g.guide.id} class="guide-card">
              <button class="open-guide" onClick={() => onOpen(g.guide.id)}>
                <div class="name">{g.guide.title}</div>
                <div class="line">
                  <span>{byLine(g, state)}</span>
                  <span class={isFinished(p, n) ? 'state finished' : 'state'}>{progressText(p, n)}</span>
                </div>
              </button>
              <div class="tools">
                {confirmRemove === g.guide.id ? (
                  <>
                    <span>Remove it?</span>
                    <button
                      class="btn btn-danger"
                      onClick={() => {
                        setConfirmRemove(null);
                        void removeGuide(g.guide.id).then(() => toast('Removed'));
                      }}
                    >
                      Yes, remove
                    </button>
                    <button class="btn" onClick={() => setConfirmRemove(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button class="btn btn-quiet" onClick={() => setConfirmRemove(g.guide.id)}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Assistants state={state} tab={tab} onOpen={onOpen} onFrame={onFrame} />
      {Object.keys(state.assistants).length === 0 && (
        <p class="hint">
          An assistant can send guides here.{' '}
          <button class="link" onClick={onSettings}>
            Add one in Settings.
          </button>
        </p>
      )}
    </div>
  );
}

function byLine(g: StoredGuide, state: State): string {
  const parts: string[] = [];
  if (g.guide.by) parts.push(`by ${g.guide.by}`);
  if (g.source.kind === 'file' && g.source.name) parts.push(`from ${g.source.name}`);
  else if (g.source.kind === 'url' && g.source.url) parts.push(`from ${hostOf(g.source.url)}`);
  else if (g.source.kind === 'assistant') {
    const a = g.source.assistant ? state.assistants[g.source.assistant] : undefined;
    parts.push(`from ${a?.card.name ?? 'an assistant'}`);
  } else parts.push('pasted');
  return parts.join(' · ');
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function isFinished(p: Progress | undefined, n: number): boolean {
  return !!p && p.current >= n && n > 0;
}

export function progressText(p: Progress | undefined, n: number): string {
  if (!p || (p.done.length === 0 && p.skipped.length === 0 && p.current === 0)) return `${n} steps`;
  if (isFinished(p, n)) return 'Done';
  return `${p.done.length} of ${n} done`;
}
