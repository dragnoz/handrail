// Where a note back goes. One small module per destination: a label and a send() that delivers
// the note and resolves with a line for the person, or throws a plain message.
// Nothing here runs unless the person pressed Send.
import type { Assistant, NotePayload } from '../assistant/types';
import { mailtoFor, noteFileName, noteText } from '../assistant/notes';
import { postNote } from '../assistant/client';
import { AssistantError } from '../assistant/parse';
import { ensureOrigin } from '../ext';
import type { NotesTo, Settings } from '../store';

export interface SendContext {
  settings: Settings;
  assistants: Record<string, Assistant>;
  /** Every note sent for this guide so far, oldest first, this one included; the file destination writes them all. */
  notesForGuide: NotePayload[];
}

export interface Destination {
  kind: NotesTo['kind'];
  /** "the clipboard", "a file", "Perseus". */
  label(to: NotesTo, assistants: Record<string, Assistant>): string;
  send(note: NotePayload, ctx: SendContext): Promise<string>;
}

const copy: Destination = {
  kind: 'copy',
  label: () => 'the clipboard',
  async send(note) {
    try {
      await navigator.clipboard.writeText(noteText(note));
    } catch {
      throw new Error('Could not copy.');
    }
    return 'Copied';
  },
};

const file: Destination = {
  kind: 'file',
  label: () => 'a file',
  async send(note, ctx) {
    const all = ctx.notesForGuide.length ? ctx.notesForGuide : [note];
    const body = all.map(noteText).join('\n---\n\n');
    download(noteFileName(note.guide), body, 'text/markdown');
    return `Saved as ${noteFileName(note.guide)}`;
  },
};

const mail: Destination = {
  kind: 'mail',
  label: () => 'your mail program',
  async send(note) {
    const a = document.createElement('a');
    a.href = mailtoFor(note);
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'Handed to your mail program';
  },
};

const webhook: Destination = {
  kind: 'webhook',
  label: (to) => (to.kind === 'webhook' && to.url ? hostOf(to.url) : 'a webhook'),
  async send(note, ctx) {
    const to = ctx.settings.notesTo;
    if (to.kind !== 'webhook' || !to.url) throw new Error('No webhook address is set. See Settings.');
    await ensureOrigin(to.url);
    const headers = new Headers({ 'content-type': 'application/json' });
    const h = (to.header ?? '').trim();
    const colon = h.indexOf(':');
    if (colon > 0) headers.set(h.slice(0, colon).trim(), h.slice(colon + 1).trim());
    let res: Response;
    try {
      res = await fetch(to.url, { method: 'POST', headers, body: JSON.stringify(note), credentials: 'omit' });
    } catch {
      throw new Error('Could not reach the webhook.');
    }
    if (!res.ok) throw new Error(`The webhook answered ${res.status}.`);
    return `Sent to ${hostOf(to.url)}`;
  },
};

const assistant: Destination = {
  kind: 'assistant',
  label: (to, assistants) =>
    to.kind === 'assistant' ? (assistants[to.assistant]?.card.name ?? 'an assistant') : 'an assistant',
  async send(note, ctx) {
    const to = ctx.settings.notesTo;
    const a = to.kind === 'assistant' ? ctx.assistants[to.assistant] : undefined;
    if (!a) throw new Error('That assistant is gone. Pick another in Settings.');
    if (!a.card.notes) throw new AssistantError(`${a.card.name} does not take notes.`);
    const reply = await postNote({ address: a.address, key: a.key }, a.card.notes, note);
    return reply.message ? `${a.card.name}: ${reply.message}` : `Sent to ${a.card.name}`;
  },
};

export const destinations: Destination[] = [copy, file, mail, webhook, assistant];

export function destinationFor(to: NotesTo): Destination {
  return destinations.find((d) => d.kind === to.kind) ?? copy;
}

/** A link that saves a file, without the downloads permission. */
export function download(name: string, body: string, type: string): void {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
