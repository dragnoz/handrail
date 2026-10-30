// The guide, as the parser produces it and as JSON feeds send it.
// docs/guide-format.md is the contract; this file only names the shape.

export interface Step {
  /** The step's title, without a leading number. */
  title: string;
  /** The step's body, Markdown. May be empty. */
  body: string;
  /** Where the step happens: URLs or match patterns (`https://host/path*`). */
  url: string[];
  /** Values to copy with one click. Never run. */
  copy: string[];
  /** What the person should see when the step is done. */
  expect?: string;
  /** What to point at on the page (0.3): CSS selectors or `text=...`, tried in order. */
  target: string[];
  /** A picture for the step: a URL or a data URI. */
  image?: string;
  /** A hint for the notes-back panel (0.2). */
  note?: string;
  /** The step may be skipped without being done. */
  optional: boolean;
}

export interface Guide {
  /** Stable id; progress is kept by it. From front matter, else from the title. */
  id: string;
  title: string;
  by?: string;
  for?: string;
  version?: string;
  sources: string[];
  /** Markdown before the first step. */
  intro: string;
  steps: Step[];
}
