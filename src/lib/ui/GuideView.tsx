import { useEffect, useRef, useState } from 'preact/hooks';
import { whereAmI, type Step } from '../guide';
import { freshProgress, now, setProgress, type Progress, type State, type StoredGuide } from '../store';
import type { ActiveTab } from './hooks';
import { Markdown } from './Markdown';
import { NotesBox } from './NotesBox';
import { copyValue, openUrl, StepBody, uniq } from './StepBody';

interface Props {
  stored: StoredGuide;
  progress: Progress | undefined;
  state: State;
  tab: ActiveTab;
  onHome: () => void;
  onSettings: () => void;
}

/** One guide: the open step, done steps folded above it, the rest listed below. */
export function GuideView({ stored, progress, state, tab, onHome, onSettings }: Props) {
  const guide = stored.guide;
  const n = guide.steps.length;
  const p = progress ?? freshProgress();
  const current = Math.min(p.current, n);
  const finished = current >= n;
  const step = guide.steps[current];
  const doneCount = p.done.filter((i) => i < n).length;
  const skippedCount = p.skipped.filter((i) => i < n).length;

  const suggestion = finished ? null : whereAmI(guide, current, tab.url);
  const suggestionKey = suggestion != null ? `${suggestion}|${tab.url ?? ''}` : '';
  const [dismissed, setDismissed] = useState('');
  const showWhere = suggestion != null && dismissed !== suggestionKey;

  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  function save(next: Partial<Progress>): void {
    void setProgress(guide.id, { ...p, ...next, updated: now() });
  }

  function next(): void {
    if (finished) return;
    const c = current + 1;
    const patch: Partial<Progress> = {
      current: c,
      done: uniq([...p.done, current]),
      skipped: p.skipped.filter((i) => i !== current),
    };
    if (c >= n) patch.finished = now();
    save(patch);
  }

  function skip(): void {
    if (finished || !step?.optional) return;
    const c = current + 1;
    const patch: Partial<Progress> = {
      current: c,
      skipped: uniq([...p.skipped, current]),
      done: p.done.filter((i) => i !== current),
    };
    if (c >= n) patch.finished = now();
    save(patch);
  }

  function back(): void {
    if (current === 0) return;
    goTo(current - 1);
  }

  /** Opens a step. Reopening a done step un-ticks it; Next ticks it again. */
  function goTo(i: number): void {
    const patch: Partial<Progress> = {
      current: i,
      done: p.done.filter((x) => x !== i),
      skipped: p.skipped.filter((x) => x !== i),
    };
    delete patch.finished;
    void setProgress(guide.id, { ...p, ...patch, finished: undefined, updated: now() } as Progress);
  }

  function restart(): void {
    void setProgress(guide.id, freshProgress());
  }

  const open = openUrl;

  // Keys: n next, p back, c copy the first value, o open the step's address. Not while typing.
  const actions = useRef({ next, back, copy: () => {}, open: () => {} });
  actions.current = {
    next,
    back,
    copy: () => {
      const v = step?.copy[0];
      if (v) void copyValue(v);
    },
    open: () => {
      const u = step?.url[0];
      if (u) void open(u);
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

  // The open step gets the focus when it changes, so the keyboard and screen readers land on it.
  useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [current]);

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
        aria-label="Steps done"
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={doneCount}
      >
        <div class="bar" style={{ width: `${n ? (doneCount / n) * 100 : 0}%` }} />
      </div>
      <p class="progress-text">
        {doneCount} of {n} done
        {skippedCount > 0 && `, ${skippedCount} skipped`}
      </p>

      {guide.intro && current === 0 && doneCount === 0 && <Markdown md={guide.intro} onLink={open} class="intro" />}

      {showWhere && suggestion != null && (
        <div class="where" role="status">
          <span>You seem to be on step {suggestion + 1}.</span>
          <button class="btn btn-primary" onClick={() => goTo(suggestion)}>
            Jump there
          </button>
          <button class="btn btn-quiet" onClick={() => setDismissed(suggestionKey)}>
            Not now
          </button>
        </div>
      )}

      <ol class="steps">
        {guide.steps.map((s, i) => {
          if (i === current && step) {
            return (
              <li key={i} class="open">
                <StepCard
                  step={step}
                  index={i}
                  isLast={i === n - 1}
                  headingRef={headingRef}
                  onNext={next}
                  onBack={back}
                  onSkip={skip}
                  onCopy={copyValue}
                  onOpen={open}
                />
                {step && <NotesBox stored={stored} step={step} index={i} state={state} tab={tab} onSettings={onSettings} />}
              </li>
            );
          }
          const done = p.done.includes(i);
          const skipped = !done && p.skipped.includes(i);
          const rowState = done ? 'done' : skipped ? 'skipped' : 'later';
          return (
            <li key={i} class={rowState}>
              <button class="row" onClick={() => goTo(i)} aria-label={`${rowLabel(rowState)} ${i + 1}: ${s.title}`}>
                <span class="mark" aria-hidden="true">
                  {done ? '✓' : skipped ? '↷' : i + 1}
                </span>
                <span class="row-title">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {finished && (
        <div class="finished" role="status">
          <h2>Done.</h2>
          <p>
            {doneCount} of {n} steps done{skippedCount > 0 && `, ${skippedCount} skipped`}.
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
        Keys: <kbd>n</kbd> next · <kbd>p</kbd> back · <kbd>c</kbd> copy · <kbd>o</kbd> open
      </p>
    </div>
  );
}

interface CardProps {
  step: Step;
  index: number;
  isLast: boolean;
  headingRef: { current: HTMLHeadingElement | null };
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onCopy: (v: string) => void;
  onOpen: (url: string) => void;
}

function StepCard({ step, index, isLast, headingRef, onNext, onBack, onSkip, onCopy, onOpen }: CardProps) {
  const id = `step-${index}`;
  return (
    <section class="card" aria-labelledby={id}>
      <div class="card-head">
        <span class="num" aria-hidden="true">
          {index + 1}
        </span>
        <h2 id={id} tabIndex={-1} ref={headingRef}>
          {step.title}
        </h2>
        {step.optional && <span class="tag">optional</span>}
      </div>
      <StepBody step={step} index={index} onCopy={onCopy} onOpen={onOpen} />
      <div class="actions">
        <button class="btn" onClick={onBack} disabled={index === 0}>
          Back
        </button>
        {step.optional && (
          <button class="btn" onClick={onSkip}>
            Skip
          </button>
        )}
        <button class="btn btn-primary" onClick={onNext}>
          {isLast ? 'Done' : 'Next'}
        </button>
      </div>
    </section>
  );
}

function rowLabel(state: string): string {
  return state === 'done' ? 'Done, reopen step' : state === 'skipped' ? 'Skipped, open step' : 'Go to step';
}
