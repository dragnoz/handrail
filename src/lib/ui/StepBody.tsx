// The inside of a step or a list item, shared by the step guide and the list: the body, the chips,
// what to expect, the picture, the addresses to open. And the two actions every view needs.
import { useState } from 'preact/hooks';
import type { Guide, Step } from '../guide';
import { isOpenable, openHere } from '../ext';
import type { Run } from '../store';
import { Markdown } from './Markdown';
import { toast } from './toast';

interface Props {
  step: Step;
  index: number;
  onCopy: (v: string) => void;
  onOpen: (url: string) => void;
  /** The routines a step's `routine:` may point at. Left out inside a routine, so a routine never nests. */
  routines?: Record<string, Guide>;
  runs?: Record<string, Run>;
}

export function StepBody({ step, index, onCopy, onOpen, routines, runs }: Props) {
  const opens = step.url.filter((u) => openable(u));
  return (
    <>
      {step.routine && routines && (
        <RoutinePill id={step.routine} routine={routines[step.routine]} run={runs?.[step.routine]} onCopy={onCopy} onOpen={onOpen} />
      )}
      {step.body && <Markdown md={step.body} onLink={onOpen} />}
      {step.copy.length > 0 && (
        <div class="chips">
          {step.copy.map((v) => (
            <button key={v} class="chip" onClick={() => onCopy(v)} aria-label={`Copy: ${v}`}>
              <code>{v}</code>
              <span class="chip-act" aria-hidden="true">
                copy
              </span>
            </button>
          ))}
        </div>
      )}
      {step.expect && (
        <p class="expect">
          <span class="expect-label">You should see:</span> {step.expect}
        </p>
      )}
      {step.image && <img class="step-image" src={step.image} alt={`Picture for step ${index + 1}`} />}
      {opens.length > 0 && (
        <div class="opens">
          {opens.map((u) => (
            <button key={u} class="btn btn-open" onClick={() => onOpen(u)}>
              <span>Open here</span>
              <span class="url">{shortUrl(openable(u)!)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

interface PillProps {
  id: string;
  routine: Guide | undefined;
  run: Run | undefined;
  onCopy: (v: string) => void;
  onOpen: (url: string) => void;
}

/** A routine inside a step: one pill. Open the first time, closed once it has been done before; a press flips it. */
export function RoutinePill({ id, routine, run, onCopy, onOpen }: PillProps) {
  const [flipped, setFlipped] = useState<boolean | null>(null);
  const times = run?.count ?? 0;
  const open = flipped ?? times === 0;
  if (!routine) {
    return (
      <p class="pill-missing" role="status">
        The routine “{id}” is not here yet. Paste it like a guide, or take it from an assistant's list.
      </p>
    );
  }
  return (
    <div class={open ? 'routine open' : 'routine'}>
      <button class="pill" aria-expanded={open} onClick={() => setFlipped(!open)}>
        <span class="pill-mark" aria-hidden="true">
          {times > 0 ? '✓' : '↻'}
        </span>
        <span class="pill-name">{routine.title}</span>
        <span class="pill-meta">
          {routine.steps.length} {routine.steps.length === 1 ? 'step' : 'steps'} · {timesText(times)}
        </span>
      </button>
      {open && (
        <ol class="routine-steps" aria-label={routine.title}>
          {routine.steps.map((s, i) => (
            <li key={i}>
              <div class="rs-head">
                <span class="num" aria-hidden="true">
                  {i + 1}
                </span>
                <span class="rs-title">{s.title}</span>
                {s.optional && <span class="tag">optional</span>}
              </div>
              <StepBody step={s} index={i} onCopy={onCopy} onOpen={onOpen} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** "first time", "done once", "done 4 times". */
export function timesText(n: number): string {
  return n === 0 ? 'first time' : n === 1 ? 'done once' : `done ${n} times`;
}

export async function copyValue(v: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(v);
    toast('Copied');
  } catch {
    toast('Could not copy');
  }
}

/** Opens a step's address in the tab under the drawer. Never a new window. */
export async function openUrl(url: string): Promise<void> {
  const target = openable(url);
  if (!target) {
    toast('Only http and https addresses open here');
    return;
  }
  try {
    await openHere(target);
  } catch {
    toast('Could not open that here');
  }
}

/** The address to open for a `url:` value: the part before the first `*`, when that is a real address. */
export function openable(u: string): string | null {
  const base = u.split('*')[0] ?? '';
  if (!isOpenable(base)) return null;
  try {
    const parsed = new URL(base);
    if (!parsed.hostname || parsed.hostname.includes('*')) return null;
    return base;
  } catch {
    return null;
  }
}

export function shortUrl(u: string): string {
  const s = u.replace(/^https?:\/\//i, '');
  return s.length > 40 ? s.slice(0, 38) + '…' : s;
}

export function uniq(xs: number[]): number[] {
  return [...new Set(xs)].sort((a, b) => a - b);
}
