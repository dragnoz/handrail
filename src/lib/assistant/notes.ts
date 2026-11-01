// Small pure helpers around assistants and notes: counts, the offer for a page, a note as text.
import { urlMatches } from '../guide/match';
import type { Assistant, FeedEntry, NotePayload } from './types';

/** How many guides and notices the person has not looked at yet. */
export function newCount(a: Assistant): { guides: number; notices: number } {
  const seenG = new Set(a.seenGuides);
  const seenN = new Set(a.seenNotices);
  return {
    guides: a.guides.filter((g) => !seenG.has(g.id)).length,
    notices: a.notices.filter((n) => !seenN.has(n.id)).length,
  };
}

/** The first guide in any assistant's list whose pages match the tab. Null when none does. */
export function guideForPage(
  assistants: Assistant[],
  tabUrl: string | undefined,
): { assistant: Assistant; entry: FeedEntry } | null {
  if (!tabUrl) return null;
  for (const assistant of assistants) {
    for (const entry of assistant.guides) {
      if (entry.pages.some((p) => urlMatches(p, tabUrl))) return { assistant, entry };
    }
  }
  return null;
}

/** A note as plain text, for the clipboard, a file or a mail. */
export function noteText(n: NotePayload): string {
  const lines = [`# ${n.title}, step ${n.step}: ${n.stepTitle}`, ''];
  if (n.page?.url) lines.push(`Page: ${n.page.url}`);
  lines.push(`Time: ${n.time}`, '', n.text.trim(), '');
  return lines.join('\n');
}

/** Every note for one guide as one Markdown file. */
export function noteFileName(guideId: string): string {
  return `handrail-notes-${guideId}.md`;
}

export function mailtoFor(n: NotePayload): string {
  const subject = `Handrail: ${n.title}, step ${n.step}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(noteText(n))}`;
}
