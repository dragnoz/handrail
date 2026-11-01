// The assistant contract, as types. The words are in docs/assistant.md, which wins when they disagree.

/** What an assistant's address answers: its name and which parts it offers, as absolute addresses. */
export interface Card {
  name: string;
  /** The guides list (a feed). */
  guides?: string;
  /** Where an ask is posted. */
  ask?: string;
  /** Where notes back are posted. */
  notes?: string;
  /** The notices list. */
  notices?: string;
  /** A page of the assistant's own, shown in the drawer or opened in the tab. */
  home?: string;
}

/** One line of the guides list. */
export interface FeedEntry {
  id: string;
  title: string;
  /** The guide's text (Markdown or JSON), absolute. */
  url: string;
  /** When the guide last changed; the drawer fetches again when this is newer than its copy. */
  updated: string;
  for?: string;
  /** Where the guide applies: `url:` patterns. The drawer offers the guide when the tab matches one. */
  pages: string[];
}

/** One line of the notices list. */
export interface Notice {
  id: string;
  text: string;
  /** A guide to open, absolute. */
  guide?: string;
  /** A page to open here, absolute. */
  url?: string;
  time?: string;
}

/** What the drawer posts when the person asks for a guide. */
export interface AskPayload {
  handrail: 1;
  text: string;
  page?: { url: string; title?: string };
  time: string;
}

/** What the drawer posts (or copies, saves, mails) when the person sends a note back. */
export interface NotePayload {
  handrail: 1;
  guide: string;
  title: string;
  /** 1-based, as the person sees it. */
  step: number;
  stepTitle: string;
  page?: { url: string; title?: string };
  time: string;
  text: string;
}

/** What an assistant may answer to an ask or a note. Both fields optional; any 2xx is fine. */
export interface Reply {
  message?: string;
  /** An ask answered at once: the guide's address. */
  guide?: string;
}

/** An assistant as the drawer keeps it. The key stays in the browser and is never exported. */
export interface Assistant {
  id: string;
  address: string;
  key?: string;
  card: Card;
  added: string;
  /** The last time the list and the notices were read. */
  checked?: string;
  /** The last read's problem, in plain words; empty when the last read worked. */
  error?: string;
  guides: FeedEntry[];
  notices: Notice[];
  /** Ids of guides already looked at on Home; the rest count as new. */
  seenGuides: string[];
  seenNotices: string[];
}
