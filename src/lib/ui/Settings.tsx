import { useRef, useState } from 'preact/hooks';
import { fetchCard, hostOf, postAsk, type Assistant } from '../assistant';
import {
  clearAll,
  clearSent,
  exportState,
  importState,
  newId,
  now,
  parseImport,
  patchSent,
  removeAssistant,
  saveAssistant,
  setSettings,
  type NotesTo,
  type SentItem,
  type Settings as SettingsShape,
  type State,
} from '../store';
import { destinations } from '../destinations';
import { openHere, refreshNow, requestOrigin, version } from '../ext';
import { message } from './hooks';
import { toast } from './toast';
import { ago, firstLine } from './time';

interface Props {
  state: State;
  onBack?: () => void;
  /** The browser's options page: no back button, a heading instead. */
  standalone?: boolean;
}

const REPO = 'https://github.com/dragnoz/handrail';
const CONTRACT = `${REPO}/blob/main/docs/assistant.md`;

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
  const assistantCount = Object.keys(state.assistants).length;

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

      <AssistantsSettings state={state} />
      <NotesSettings state={state} />

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

      <SentSettings state={state} />

      <fieldset>
        <legend>Your data</legend>
        <p>
          {guideCount === 1 ? '1 guide' : `${guideCount} guides`}
          {assistantCount > 0 && `, ${assistantCount === 1 ? '1 assistant' : `${assistantCount} assistants`}`}, with
          progress, what you sent and the settings, all in this browser. Export puts it in one JSON file, without
          the assistants' keys; import reads such a file back and replaces guides with the same id.
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
            <p>This removes every guide, assistant and key, all progress and the settings. There is no undo.</p>
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
          Handrail {version}. Open source, MIT. There is no account, no server and no telemetry. Nothing leaves this
          browser except what you send to an assistant or a destination you chose, when you press Send, and the
          reading of an assistant's lists every few minutes. The <code>tabs</code> permission lets the drawer see the
          address of the tab you are on, for "where am I" and "open here"; nothing is recorded.
        </p>
        <div class="stack">
          <ExternalLink href={REPO} standalone={standalone}>
            Source and guide format
          </ExternalLink>
          <ExternalLink href={CONTRACT} standalone={standalone}>
            How to be an assistant
          </ExternalLink>
        </div>
      </fieldset>
    </div>
  );
}

function ExternalLink({ href, standalone, children }: { href: string; standalone?: boolean; children: string }) {
  return standalone ? (
    <a class="btn" href={href}>
      {children}
    </a>
  ) : (
    <button class="btn" onClick={() => void openHere(href)}>
      {children}
    </button>
  );
}

// ---- assistants

function AssistantsSettings({ state }: { state: State }) {
  const [adding, setAdding] = useState(false);
  const [address, setAddress] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const list = Object.values(state.assistants).sort((a, b) => a.added.localeCompare(b.added));

  async function add(): Promise<void> {
    const url = address.trim();
    if (!url) {
      setError("Paste the assistant's address first.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      // The permission prompt comes first, while this is still the person's click.
      await requestOrigin(url);
      const card = await fetchCard({ address: url, key: key.trim() || undefined });
      const existing = list.find((a) => a.address === url);
      const a: Assistant = {
        id: existing?.id ?? newId(),
        address: url,
        card,
        added: existing?.added ?? now(),
        guides: existing?.guides ?? [],
        notices: existing?.notices ?? [],
        seenGuides: existing?.seenGuides ?? [],
        seenNotices: existing?.seenNotices ?? [],
      };
      if (key.trim()) a.key = key.trim();
      await saveAssistant(a);
      setAdding(false);
      setAddress('');
      setKey('');
      toast(existing ? `${card.name} updated` : `${card.name} added`);
      void refreshNow(a.id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset>
      <legend>Assistants</legend>
      <p>
        An assistant is a place that writes guides for you: a tool of your own, a team's server, a folder on a web
        host. One address and, if it needs one, a key. The key is sent to that address only and is never exported.
      </p>
      {list.length > 0 && (
        <ul class="asst-settings">
          {list.map((a) => (
            <li key={a.id}>
              <div class="asst-settings-row">
                <span>
                  <b>{a.card.name}</b> <span class="asst-host">{hostOf(a.address)}</span>
                  {a.key && <span class="tag">key</span>}
                </span>
                {confirmRemove === a.id ? (
                  <span class="stack">
                    <button
                      class="btn btn-danger"
                      onClick={() => {
                        setConfirmRemove(null);
                        void removeAssistant(a.id).then(() => toast('Removed'));
                      }}
                    >
                      Yes, remove
                    </button>
                    <button class="btn" onClick={() => setConfirmRemove(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button class="btn btn-quiet" onClick={() => setConfirmRemove(a.id)}>
                    Remove
                  </button>
                )}
              </div>
              <div class="asst-settings-line">
                {offers(a)}
                {a.error ? ` · ${a.error}` : a.checked ? ` · checked ${ago(a.checked)}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div class="add-form">
          <label for="asst-address">Address</label>
          <input
            id="asst-address"
            type="url"
            class="field"
            placeholder="https://…"
            value={address}
            onInput={(e) => setAddress((e.target as HTMLInputElement).value)}
            spellcheck={false}
          />
          <label for="asst-key">Key, if it needs one</label>
          <input
            id="asst-key"
            type="password"
            class="field"
            autocomplete="off"
            value={key}
            onInput={(e) => setKey((e.target as HTMLInputElement).value)}
          />
          <div class="stack">
            <button class="btn btn-primary" onClick={() => void add()} disabled={busy}>
              {busy ? 'Checking…' : 'Add'}
            </button>
            <button class="btn btn-quiet" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div class="stack">
          <button class="btn" onClick={() => setAdding(true)}>
            Add an assistant…
          </button>
        </div>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function offers(a: Assistant): string {
  const parts: string[] = [];
  if (a.card.guides) parts.push('guides');
  if (a.card.ask) parts.push('ask');
  if (a.card.notes) parts.push('notes');
  if (a.card.notices) parts.push('notices');
  if (a.card.home) parts.push('a page');
  return parts.length ? `Offers ${parts.join(', ')}` : 'Offers nothing yet';
}

// ---- notes back

function NotesSettings({ state }: { state: State }) {
  const to = state.settings.notesTo;
  const assistants = Object.values(state.assistants).filter((a) => a.card.notes);
  const set = (notesTo: NotesTo) => void setSettings({ ...state.settings, notesTo });
  const kinds: { kind: NotesTo['kind']; label: string }[] = [
    { kind: 'copy', label: 'The clipboard' },
    { kind: 'file', label: 'A file' },
    { kind: 'mail', label: 'My mail program' },
    { kind: 'assistant', label: 'An assistant' },
    { kind: 'webhook', label: 'A webhook' },
  ];

  function pick(kind: NotesTo['kind']): void {
    if (kind === 'assistant') {
      const first = assistants[0];
      if (first) set({ kind, assistant: first.id });
    } else if (kind === 'webhook') set({ kind, url: '' });
    else set({ kind });
  }

  return (
    <fieldset>
      <legend>Notes back go to</legend>
      <p>
        Under a step you can write what you found and press Send. It goes to one place, with the guide, the step and,
        if you tick it, the page you are on. Never a key or a password: Handrail refuses text that looks like one.
      </p>
      <div class="radios column">
        {kinds.map((k) => {
          const off = k.kind === 'assistant' && assistants.length === 0;
          return (
            <label key={k.kind} class={off ? 'off' : ''}>
              <input type="radio" name="notes-to" checked={to.kind === k.kind} disabled={off} onChange={() => pick(k.kind)} />
              {k.label}
              {off && <span class="asst-host"> (add one that takes notes first)</span>}
            </label>
          );
        })}
      </div>
      {to.kind === 'assistant' && assistants.length > 1 && (
        <select class="field" value={to.assistant} onChange={(e) => set({ kind: 'assistant', assistant: (e.target as HTMLSelectElement).value })}>
          {assistants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.card.name}
            </option>
          ))}
        </select>
      )}
      {to.kind === 'webhook' && (
        <div class="add-form">
          <label for="hook-url">Address (it gets a JSON POST)</label>
          <input
            id="hook-url"
            type="url"
            class="field"
            placeholder="https://…"
            value={to.url}
            onInput={(e) => set({ ...to, url: (e.target as HTMLInputElement).value })}
            spellcheck={false}
          />
          <label for="hook-header">One header, if it needs one (Name: value)</label>
          <input
            id="hook-header"
            type="text"
            class="field"
            autocomplete="off"
            value={to.header ?? ''}
            onInput={(e) => set({ ...to, header: (e.target as HTMLInputElement).value })}
            spellcheck={false}
          />
        </div>
      )}
      <label class="check">
        <input
          type="checkbox"
          checked={state.settings.badge}
          onChange={() => void setSettings({ ...state.settings, badge: !state.settings.badge })}
        />
        Show a count of new guides and notices on the Handrail button
      </label>
    </fieldset>
  );
}

// ---- sent

function SentSettings({ state }: { state: State }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const items = state.sent;
  if (items.length === 0) return null;

  async function again(s: SentItem): Promise<void> {
    const a = s.assistant ? state.assistants[s.assistant] : undefined;
    if (!a) return;
    setBusy(s.id);
    try {
      if (s.kind === 'ask' && a.card.ask) {
        const r = await postAsk({ address: a.address, key: a.key }, a.card.ask, {
          handrail: 1,
          text: s.text,
          time: now(),
          ...(s.page ? { page: s.page } : {}),
        });
        await patchSent(s.id, { reply: r.message ?? 'Sent again.', error: undefined, time: now() });
        toast('Sent again');
      } else if (s.kind === 'note' && a.card.notes) {
        const d = destinations.find((x) => x.kind === 'assistant')!;
        const line = await d.send(
          {
            handrail: 1,
            guide: s.guide ?? '',
            title: s.title ?? '',
            step: s.step ?? 0,
            stepTitle: s.stepTitle ?? '',
            time: now(),
            text: s.text,
            ...(s.page ? { page: s.page } : {}),
          },
          { settings: { ...state.settings, notesTo: { kind: 'assistant', assistant: a.id } }, assistants: state.assistants, notesForGuide: [] },
        );
        await patchSent(s.id, { reply: line, error: undefined, time: now() });
        toast('Sent again');
      }
    } catch (e) {
      await patchSent(s.id, { error: message(e) });
    } finally {
      setBusy('');
    }
  }

  return (
    <fieldset>
      <legend>Sent</legend>
      <p>
        {items.length === 1 ? '1 thing' : `${items.length} things`} sent from here: asks and notes, with what came
        back.
      </p>
      <div class="stack">
        <button class="btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
        {open && (
          <button class="btn btn-quiet" onClick={() => void clearSent().then(() => toast('Cleared'))}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <ul class="sent">
          {items.map((s) => (
            <li key={s.id} class={s.error ? 'sent-item failed' : 'sent-item'}>
              <div class="sent-head">
                <span>
                  {s.kind === 'ask' ? 'Ask' : 'Note'} to {s.to}
                  {s.step ? `, step ${s.step}` : ''}
                </span>
                <span class="when">{ago(s.time)}</span>
              </div>
              <div class="sent-text">{firstLine(s.text)}</div>
              {s.reply && <div class="sent-reply">{s.reply}</div>}
              {s.error && <div class="sent-error">{s.error}</div>}
              {s.assistant && state.assistants[s.assistant] && (
                <div class="stack">
                  <button class="btn btn-quiet" onClick={() => void again(s)} disabled={busy === s.id}>
                    {busy === s.id ? 'Sending…' : 'Send again'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
