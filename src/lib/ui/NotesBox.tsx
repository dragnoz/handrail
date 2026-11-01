import { useState } from 'preact/hooks';
import type { Step } from '../guide';
import { looksLikeKey, type NotePayload } from '../assistant';
import { addSent, newId, now, patchSent, type State, type StoredGuide } from '../store';
import { destinationFor } from '../destinations';
import { requestOrigin } from '../ext';
import { message, type ActiveTab } from './hooks';
import { toast } from './toast';

interface Props {
  stored: StoredGuide;
  step: Step;
  /** 0-based. */
  index: number;
  state: State;
  tab: ActiveTab;
  onSettings: () => void;
}

/** Notes back: closed until pressed; one box, one Send, to the place chosen in Settings. */
export function NotesBox({ stored, step, index, state, tab, onSettings }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [withPage, setWithPage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const to = state.settings.notesTo;
  const dest = destinationFor(to);
  const label = dest.label(to, state.assistants);
  const page = tab.url && /^https?:/i.test(tab.url) ? tab.url : '';

  async function send(): Promise<void> {
    const t = text.trim();
    if (!t) {
      setError('Write the note first.');
      return;
    }
    const keyish = looksLikeKey(t);
    if (keyish) {
      setError(`This looks like ${keyish}. Handrail does not send keys or passwords. Take it out and send again.`);
      return;
    }
    setBusy(true);
    setError('');
    setDone('');
    const note: NotePayload = {
      handrail: 1,
      guide: stored.guide.id,
      title: stored.guide.title,
      step: index + 1,
      stepTitle: step.title,
      time: now(),
      text: t,
    };
    if (withPage && page) note.page = tab.title ? { url: page, title: tab.title } : { url: page };
    try {
      // A webhook on a new host needs the browser's permission; asked first, while this is still a click.
      if (to.kind === 'webhook' && to.url) await requestOrigin(to.url);
      const earlier = state.sent
        .filter((s) => s.kind === 'note' && s.guide === note.guide)
        .map(toPayload)
        .reverse();
      const line = await dest.send(note, {
        settings: state.settings,
        assistants: state.assistants,
        notesForGuide: [...earlier, note],
      });
      const item = {
        id: newId(),
        kind: 'note' as const,
        to: label,
        time: note.time,
        text: t,
        guide: note.guide,
        title: note.title,
        step: note.step,
        stepTitle: note.stepTitle,
        reply: line,
      };
      await addSent(
        to.kind === 'assistant'
          ? { ...item, assistant: to.assistant, ...(note.page ? { page: note.page } : {}) }
          : { ...item, ...(note.page ? { page: note.page } : {}) },
      );
      setDone(line);
      setText('');
      toast(line);
    } catch (e) {
      const m = message(e);
      setError(m);
      const id = newId();
      await addSent({
        id,
        kind: 'note',
        to: label,
        time: note.time,
        text: t,
        guide: note.guide,
        title: note.title,
        step: note.step,
        stepTitle: note.stepTitle,
        ...(to.kind === 'assistant' ? { assistant: to.assistant } : {}),
      });
      await patchSent(id, { error: m });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div class="notes-closed">
        <button class="btn btn-quiet" onClick={() => setOpen(true)} aria-expanded={false}>
          Send a note back…
        </button>
      </div>
    );
  }

  return (
    <section class="notes" aria-label="Note back">
      <label class="visually-hidden" for="note">
        Your note
      </label>
      <textarea
        id="note"
        class="paste"
        rows={3}
        placeholder={step.note ?? 'What did you find? An error, a value, "done, but the button was called X".'}
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />
      {page && (
        <label class="check">
          <input type="checkbox" checked={withPage} onChange={() => setWithPage(!withPage)} />
          With the page I am on
        </label>
      )}
      <div class="add-row">
        <button class="btn btn-primary" onClick={() => void send()} disabled={busy}>
          {busy ? 'Sending…' : `Send to ${label}`}
        </button>
        <button class="btn btn-quiet" onClick={onSettings}>
          Change where
        </button>
        <button class="btn btn-quiet" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {done && (
        <p class="reply" role="status">
          {done}
        </p>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function toPayload(s: State['sent'][number]): NotePayload {
  const n: NotePayload = {
    handrail: 1,
    guide: s.guide ?? '',
    title: s.title ?? '',
    step: s.step ?? 0,
    stepTitle: s.stepTitle ?? '',
    time: s.time,
    text: s.text,
  };
  if (s.page) n.page = s.page;
  return n;
}
