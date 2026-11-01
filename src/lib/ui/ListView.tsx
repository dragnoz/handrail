import { useEffect, useRef, useState } from 'preact/hooks';
import { parseGuide, urlMatches, whichItem } from '../guide';
import { freshProgress, now, saveGuide, setProgress, type Progress, type State, type StoredGuide } from '../store';
import { message, type ActiveTab } from './hooks';
import { Markdown } from './Markdown';
import { NotesBox } from './NotesBox';
import { copyValue, openUrl, StepBody, uniq } from './StepBody';
import { toast } from './toast';

interface Props {
  stored: StoredGuide;
  progress: Progress | undefined;
  state: State;
  tab: ActiveTab;
  onHome: () => void;
  onSettings: () => void;
}

/**
 * A list (`kind: list`): every item shown with its box, ticked in any order; one item open at a
 * time for its details. In the progress, `current` is the open item, or -1 when none is.
 */
export function ListView({ stored, progress, state, tab, onHome, onSettings }: Props) {
  const guide = stored.guide;
  const n = guide.steps.length;
  const p = progress ?? freshProgress();
  const done = p.done.filter((i) => i < n);
  const skipped = p.skipped.filter((i) => i < n && !done.includes(i));
  const open = p.current >= 0 && p.current < n ? p.current : -1;
  const left = guide.steps.map((_, i) => i).filter((i) => !done.includes(i) && !skipped.includes(i));
  const allDone = n > 0 && left.length === 0;

  // "There is an item for this page": any item left whose address matches the tab, unless the open one does.
  const url = tab.url;
  const openMatches = open >= 0 && !!url && guide.steps[open]!.url.some((u) => urlMatches(u, url));
  const suggestion = openMatches ? null : whichItem(guide, url, [...done, ...skipped, open]);
  const suggestionKey = suggestion != null ? `${suggestion}|${url ?? ''}` : '';
  const [dismissed, setDismissed] = useState('');
  const showWhere = suggestion != null && dismissed !== suggestionKey;

  const [adding, setAdding] = useState('');
  const [error, setError] = useState('');

  /** The progress with new ticks; finished once nothing is left. */
  function progressWith(d: number[], s: number[], extra: Partial<Progress> = {}): Progress {
    const next: Progress = { ...p, ...extra, done: d, skipped: s, updated: now() };
    if (d.length + s.length >= n) next.finished = p.finished ?? now();
    else delete next.finished;
    return next;
  }

  function save(next: Progress): void {
    void setProgress(guide.id, next);
  }

  /** Ticks an item, or unticks a ticked one. */
  function tick(i: number): void {
    const d = done.includes(i) ? done.filter((x) => x !== i) : uniq([...done, i]);
    save(progressWith(d, skipped.filter((x) => x !== i)));
  }

  function skip(i: number): void {
    save(progressWith(done.filter((x) => x !== i), uniq([...skipped, i])));
  }

  /** Opens an item's details, or closes the open one. */
  function show(i: number): void {
    save(progressWith(done, skipped, { current: open === i ? -1 : i }));
  }

  /** `n`: tick the open item and open the next one left; with none open, open the first left. */
  function next(): void {
    if (open < 0) {
      if (left[0] != null) save(progressWith(done, skipped, { current: left[0] }));
      return;
    }
    const rest = left.filter((i) => i !== open);
    const following = rest.find((i) => i > open) ?? rest[0] ?? -1;
    save(progressWith(uniq([...done, open]), skipped.filter((x) => x !== open), { current: following }));
  }

  /** `p`: open the item above. */
  function back(): void {
    if (open > 0) save(progressWith(done, skipped, { current: open - 1 }));
    else if (open < 0 && n > 0) save(progressWith(done, skipped, { current: n - 1 }));
  }

  function restart(): void {
    void setProgress(guide.id, freshProgress());
  }

  async function addItem(): Promise<void> {
    const title = adding.trim();
    if (!title) return;
    try {
      const raw = withItem(stored.raw, title);
      await saveGuide({ ...stored, guide: parseGuide(raw), raw, updated: now() });
      setAdding('');
      setError('');
      toast('Item added');
    } catch (e) {
      setError(message(e));
    }
  }

  // Keys: n tick and next, p back, c copy the open item's first value, o open its address. Not while typing.
  const item = open >= 0 ? guide.steps[open] : undefined;
  const actions = useRef({ next, back, copy: () => {}, open: () => {} });
  actions.current = {
    next,
    back,
    copy: () => {
      const v = item?.copy[0];
      if (v) void copyValue(v);
    },
    open: () => {
      const u = item?.url[0];
      if (u) void openUrl(u);
    },
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const a = actions.current;
      if (e.key === 'n') a.next();
      else if (e.key === 'p') a.back();
      else if (e.key === 'c') a.copy();
      else if (e.key === 'o') a.open();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="view">
      <header class="top">
        <button class="btn btn-quiet" onClick={onHome}>
          ← Guides
        </button>
        <button class="btn btn-quiet" onClick={onSettings} aria-label="Settings" title="Settings">
          ⚙
        </button>
      </header>

      <h1 class="title">{guide.title}</h1>
      {(guide.by || guide.for) && (
        <p class="meta">
          {guide.by && `by ${guide.by}`}
          {guide.by && guide.for && ' · '}
          {guide.for && `for ${guide.for}`}
        </p>
      )}

      <div
        class="progress"
        role="progressbar"
        aria-label="Items done"
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={done.length}
      >
        <div class="bar" style={{ width: `${n ? (done.length / n) * 100 : 0}%` }} />
      </div>
      <p class="progress-text">
        {done.length} of {n} done
        {skipped.length > 0 && `, ${skipped.length} skipped`}
      </p>

      {guide.intro && <Markdown md={guide.intro} onLink={openUrl} class="intro" />}

      {showWhere && suggestion != null && (
        <div class="where" role="status">
          <span>
            There is an item for this page: <b>{guide.steps[suggestion]!.title}</b>.
          </span>
          <button class="btn btn-primary" onClick={() => show(suggestion)}>
            Open it
          </button>
          <button class="btn btn-quiet" onClick={() => setDismissed(suggestionKey)}>
            Not now
          </button>
        </div>
      )}

      <ol class="steps list">
        {guide.steps.map((s, i) => {
          const isDone = done.includes(i);
          const isSkipped = skipped.includes(i);
          const isOpen = i === open;
          const rowState = isDone ? 'done' : isSkipped ? 'skipped' : 'later';
          return (
            <li key={i} class={isOpen ? `${rowState} open` : rowState}>
              <div class="row item-row">
                <button
                  class="tick"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={`Done: ${s.title}`}
                  onClick={() => tick(i)}
                >
                  {isDone ? '✓' : isSkipped ? '↷' : ''}
                </button>
                <button class="row-title item-title" aria-expanded={isOpen} onClick={() => show(i)}>
                  <span>{s.title}</span>
                  {s.optional && <span class="tag">optional</span>}
                </button>
              </div>
              {isOpen && (
                <>
                  <section class="card" aria-label={s.title}>
                    <StepBody step={s} index={i} onCopy={copyValue} onOpen={openUrl} />
                    <div class="actions">
                      {s.optional && !isSkipped && (
                        <button class="btn" onClick={() => skip(i)}>
                          Skip
                        </button>
                      )}
                      <button class="btn btn-primary" onClick={() => tick(i)}>
                        {isDone ? 'Not done' : 'Done'}
                      </button>
                    </div>
                  </section>
                  <NotesBox stored={stored} step={s} index={i} state={state} tab={tab} onSettings={onSettings} />
                </>
              )}
            </li>
          );
        })}
      </ol>

      <form
        class="add-item"
        onSubmit={(e) => {
          e.preventDefault();
          void addItem();
        }}
      >
        <input
          type="text"
          aria-label="A new item"
          placeholder="Add an item"
          value={adding}
          onInput={(e) => setAdding((e.target as HTMLInputElement).value)}
        />
        <button class="btn" type="submit" disabled={!adding.trim()}>
          Add
        </button>
      </form>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}

      {allDone && (
        <div class="finished" role="status">
          <h2>All done.</h2>
          <p>
            {done.length} of {n} done{skipped.length > 0 && `, ${skipped.length} skipped`}.
          </p>
          <div class="actions">
            <button class="btn" onClick={restart}>
              Start again
            </button>
            <button class="btn btn-primary" onClick={onHome}>
              Your guides
            </button>
          </div>
        </div>
      )}

      <p class="keys">
        Keys: <kbd>n</kbd> tick, next · <kbd>p</kbd> back · <kbd>c</kbd> copy · <kbd>o</kbd> open
      </p>
    </div>
  );
}

/** The text with one more item at the end, written the way the list is written. */
function withItem(raw: string, title: string): string {
  const t = raw.trim();
  if (t.startsWith('{')) {
    const o = JSON.parse(t) as { steps?: unknown[] };
    o.steps = [...(Array.isArray(o.steps) ? o.steps : []), { title }];
    return JSON.stringify(o, null, 2);
  }
  const text = raw.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  const numbered = text.match(/^\d+[.)][ \t]+/gm);
  const line = /^##(?!#)[ \t]+/m.test(text) ? `## ${title}` : numbered ? `${numbered.length + 1}. ${title}` : `- [ ] ${title}`;
  return `${text}\n${line}\n`;
}
