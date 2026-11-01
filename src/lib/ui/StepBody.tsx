// The inside of a step or a list item, shared by the step guide and the list: the body, the chips,
// what to expect, the picture, the addresses to open. And the two actions every view needs.
import type { Step } from '../guide';
import { isOpenable, openHere } from '../ext';
import { Markdown } from './Markdown';
import { toast } from './toast';

interface Props {
  step: Step;
  index: number;
  onCopy: (v: string) => void;
  onOpen: (url: string) => void;
}

export function StepBody({ step, index, onCopy, onOpen }: Props) {
  const opens = step.url.filter((u) => openable(u));
  return (
    <>
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
