import { useEffect, useState } from 'preact/hooks';
import { parseGuide } from '../guide';
import {
  fetchGuideText,
  hostOf,
  newCount,
  postAsk,
  type Assistant,
  type AskPayload,
  type FeedEntry,
  type Notice,
} from '../assistant';
import { addSent, freshProgress, markSeen, newId, now, patchSent, saveGuide, setProgress, type State } from '../store';
import { ensureOrigin, frameable, openHere, refreshNow } from '../ext';
import { message, type ActiveTab } from './hooks';
import { toast } from './toast';
import { ago } from './time';

interface Props {
  state: State;
  tab: ActiveTab;
  onOpen: (guideId: string) => void;
  onFrame: (url: string, title: string) => void;
}

/** Home's assistants: one closed row each, one open at a time. */
export function Assistants({ state, tab, onOpen, onFrame }: Props) {
  const list = Object.values(state.assistants).sort((a, b) => a.added.localeCompare(b.added));
  const [openId, setOpenId] = useState<string | null>(null);
  if (list.length === 0) return null;
  return (
    <section>
      <h2 class="section">Assistants</h2>
      <ul class="asst-list">
        {list.map((a) => (
          <AssistantCard
            key={a.id}
            a={a}
            state={state}
            tab={tab}
            open={openId === a.id}
            onToggle={() => setOpenId(openId === a.id ? null : a.id)}
            onOpen={onOpen}
            onFrame={onFrame}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * Fetches a guide from an assistant and keeps it. The assistant's own origin needs no new permission;
 * a guide on another host asks for that host, so call this first thing in a click handler.
 */
export async function addGuideFrom(state: State, a: Assistant, url: string, entry?: FeedEntry): Promise<string> {
  await ensureOrigin(url);
  const raw = await fetchGuideText({ address: a.address, key: a.key }, url);
  const guide = parseGuide(raw);
  const existing = state.guides[guide.id];
  const source: State['guides'][string]['source'] = { kind: 'assistant', assistant: a.id, url };
  if (entry?.updated) source.updated = entry.updated;
  await saveGuide({ guide, raw, source, added: existing?.added ?? now(), updated: now() });
  if (!state.progress[guide.id]) await setProgress(guide.id, freshProgress());
  return guide.id;
}

interface CardProps {
  a: Assistant;
  state: State;
  tab: ActiveTab;
  open: boolean;
  onToggle: () => void;
  onOpen: (guideId: string) => void;
  onFrame: (url: string, title: string) => void;
}

function AssistantCard({ a, state, tab, open, onToggle, onOpen, onFrame }: CardProps) {
  const counts = newCount(a);
  const fresh = counts.guides + counts.notices;
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // What was new when the card opened stays marked while it is open, though it counts as seen.
  const [wasNew, setWasNew] = useState<{ guides: Set<string>; notices: Set<string> }>({
    guides: new Set(),
    notices: new Set(),
  });

  useEffect(() => {
    if (!open) return;
    setWasNew({
      guides: new Set(a.guides.filter((g) => !a.seenGuides.includes(g.id)).map((g) => g.id)),
      notices: new Set(a.notices.filter((n) => !a.seenNotices.includes(n.id)).map((n) => n.id)),
    });
    void markSeen(a.id, { guides: true, notices: true });
    // only when the card opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function run(label: string, job: () => Promise<void>): Promise<void> {
    setBusy(label);
    setError('');
    try {
      await job();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy('');
    }
  }

  const openGuide = (url: string, entry?: FeedEntry) =>
    run(entry?.id ?? url, async () => {
      const id = await addGuideFrom(state, a, url, entry);
      onOpen(id);
    });

  const openHome = () =>
    run('home', async () => {
      const url = a.card.home!;
      if (await frameable(url)) onFrame(url, a.card.name);
      else await openHere(url);
    });

  const check = () => run('check', () => refreshNow(a.id));

  const name = a.card.name;
  return (
    <li class={open ? 'asst open' : 'asst'}>
      <button class="asst-head" onClick={onToggle} aria-expanded={open}>
        <span class="asst-name">{name}</span>
        <span class="asst-meta">
          {!open && fresh > 0 && <span class="tag tag-new">{fresh} new</span>}
          {a.error && (
            <span class="dot-err" title={a.error} aria-label="Could not read it">
              !
            </span>
          )}
          <span class="asst-host">{hostOf(a.address)}</span>
        </span>
      </button>
      {open && (
        <div class="asst-body">
          {a.error && (
            <p class="error" role="alert">
              {a.error}
            </p>
          )}
          <div class="asst-tools">
            {a.card.ask && (
              <button class="btn btn-primary" onClick={() => setAsking(!asking)} aria-expanded={asking}>
                Ask {name}…
              </button>
            )}
            {a.card.home && (
              <button class="btn" onClick={openHome} disabled={busy === 'home'}>
                Open {name}
              </button>
            )}
            <button class="btn btn-quiet" onClick={check} disabled={busy === 'check'}>
              {busy === 'check' ? 'Checking…' : 'Check now'}
            </button>
          </div>
          {asking && a.card.ask && <AskBox a={a} tab={tab} onDone={() => setAsking(false)} />}

          {a.notices.length > 0 && (
            <>
              <h3 class="sub">Notices</h3>
              <ul class="notices">
                {a.notices.map((n) => (
                  <NoticeRow
                    key={n.id}
                    n={n}
                    isNew={wasNew.notices.has(n.id)}
                    busy={busy === n.guide}
                    onGuide={(url) => void openGuide(url)}
                  />
                ))}
              </ul>
            </>
          )}

          <h3 class="sub">Guides</h3>
          {a.guides.length === 0 ? (
            <p class="empty">{a.card.guides ? 'No guides from here yet.' : `${name} does not list guides.`}</p>
          ) : (
            <ul class="feed">
              {sortFeed(a.guides).map((g) => {
                const have = state.guides[g.id];
                const stale = !!have && have.source.updated && g.updated && g.updated > have.source.updated;
                return (
                  <li key={g.id}>
                    <button class="feed-row" onClick={() => void openGuide(g.url, g)} disabled={busy === g.id}>
                      <span class="feed-title">{g.title}</span>
                      <span class="feed-line">
                        {wasNew.guides.has(g.id) && <span class="tag tag-new">new</span>}
                        {stale && <span class="tag">updated</span>}
                        {have && !stale && <span class="tag tag-have">in your list</span>}
                        {g.for && <span>for {g.for}</span>}
                        {g.updated && <span>{ago(g.updated)}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <p class="hint">{a.checked ? `Checked ${ago(a.checked)}.` : 'Not read yet.'}</p>
        </div>
      )}
    </li>
  );
}

function NoticeRow({
  n,
  isNew,
  busy,
  onGuide,
}: {
  n: Notice;
  isNew: boolean;
  busy: boolean;
  onGuide: (url: string) => void;
}) {
  return (
    <li class={isNew ? 'notice new' : 'notice'}>
      <p>
        {isNew && <span class="tag tag-new">new</span>}
        {n.text}
      </p>
      <div class="notice-tools">
        {n.guide && (
          <button class="btn btn-primary" onClick={() => onGuide(n.guide!)} disabled={busy}>
            Open the guide
          </button>
        )}
        {n.url && (
          <button class="btn" onClick={() => void openHere(n.url!)}>
            Open here
          </button>
        )}
        {n.time && <span class="when">{ago(n.time)}</span>}
      </div>
    </li>
  );
}

/** Ask the assistant for a guide. The text and, if ticked, the page you are on; nothing else. */
function AskBox({ a, tab, onDone }: { a: Assistant; tab: ActiveTab; onDone: () => void }) {
  const [text, setText] = useState('');
  const [withPage, setWithPage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const page = tab.url && /^https?:/i.test(tab.url) ? tab.url : '';

  async function send(): Promise<void> {
    const t = text.trim();
    if (!t) {
      setError('Say what you want to do first.');
      return;
    }
    if (t.length > 4000) {
      setError('That is too long for an ask. Keep it under 4000 characters.');
      return;
    }
    setBusy(true);
    setError('');
    const payload: AskPayload = { handrail: 1, text: t, time: now() };
    if (withPage && page) payload.page = tab.title ? { url: page, title: tab.title } : { url: page };
    const id = newId();
    const item = { id, kind: 'ask' as const, to: a.card.name, assistant: a.id, time: payload.time, text: t };
    await addSent(payload.page ? { ...item, page: payload.page } : item);
    try {
      const r = await postAsk({ address: a.address, key: a.key }, a.card.ask!, payload);
      const line = r.message ?? 'Sent. The guide will show up in the list.';
      await patchSent(id, { reply: line });
      setReply(line);
      setText('');
      toast('Sent');
      if (r.guide) {
        // answered at once: pull the lists so the new guide shows
        await refreshNow(a.id);
      }
    } catch (e) {
      const m = message(e);
      await patchSent(id, { error: m });
      setError(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="ask">
      <label class="visually-hidden" for={`ask-${a.id}`}>
        What do you want to do?
      </label>
      <textarea
        id={`ask-${a.id}`}
        class="paste"
        placeholder="What do you want to do? One or two sentences."
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        rows={3}
      />
      {page && (
        <label class="check">
          <input type="checkbox" checked={withPage} onChange={() => setWithPage(!withPage)} />
          With the page I am on ({hostOf(page)})
        </label>
      )}
      <div class="add-row">
        <button class="btn btn-primary" onClick={() => void send()} disabled={busy}>
          {busy ? 'Sending…' : `Send to ${a.card.name}`}
        </button>
        <button class="btn btn-quiet" onClick={onDone}>
          Close
        </button>
      </div>
      {reply && (
        <p class="reply" role="status">
          {reply}
        </p>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function sortFeed(list: FeedEntry[]): FeedEntry[] {
  return [...list].sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
}
