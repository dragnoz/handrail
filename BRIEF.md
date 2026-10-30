# Handrail — a guide at your side, in the browser

*Brief, 30 Oct 2026. Working name; Dragnoz picks the final one. Open source from day one.*

## The problem

When a person has to do something complex on the web — set up a server from a hosting panel, configure a service, follow a twelve-step procedure across three sites — the instructions live in one window and the work in another. They swap between the two, lose their place, and end up with a thousand windows. The instructions are often written for them by an assistant (an AI, a colleague, a support agent), as a step-by-step guide. The guide should sit **beside** the page they are working on, follow them from page to page, know which step they are on, and take their notes back.

## What Handrail is

A browser extension that opens as a **drawer** at the side of any web page (Chrome's side panel; Firefox's sidebar) and shows a step-by-step guide:

- one step at a time, big and plain; done steps fold away; the next step is one click or one key;
- a value the step needs (a command, a key name, an address) is copied with one click;
- a link in a step opens **in the current tab**, under the drawer — never a new window;
- the drawer knows which tab and address you are on and marks the step that belongs there ("where am I");
- a small **notes back** panel: paste or type what you found (an error, a value, "done, but the button was called X") and send it where you configured — a file, the clipboard, a webhook, your mail client;
- later: it can **point at the page** — outline the button the step names, scroll to it, mark the field — on sites that allow it.

It is not an AI, not a recorder, not an automation tool. The guide is written elsewhere (by a person or an assistant); Handrail is the rail you hold while you walk it.

## Principles

1. **Open source, MIT.** Anyone can use it, ship guides for it, or host a guide feed for their users.
2. **No account, no server, no telemetry.** Nothing leaves the browser except to the destinations the user configured, when they press send.
3. **Guides are plain text.** Markdown with a little front matter. A guide written in a text editor works. A guide produced by a tool works. Nothing proprietary.
4. **Works offline** with a pasted or local guide.
5. **Minimal permissions**, asked for when needed: reading the page is optional and per site; the drawer itself needs nothing but storage and the side panel.
6. **ADHD-friendly by construction**: each step once; the current step is the only open thing; no walls of text; progress visible; one key to the next step; nothing moves on its own.
7. **Accessible**: keyboard throughout, labelled controls, respects the system's dark mode and reduced motion, readable at 200% zoom.
8. **Every release has a version and a changelog line per change.**

## The guide format (the contract)

A guide is a Markdown file. Front matter is optional. Steps are the ordered list items or the `##` headings — whichever the file uses (headings win when both appear). Each step may carry fields in a small indented block.

```markdown
---
title: Add a deploy key to a repository
id: add-deploy-key
by: Claude
for: Dragnoz
version: 1
sources: https://example.org/guides/add-deploy-key.md
---

Lets one server read one repository, and nothing else.

## 1. Open a terminal on the server
Not on your own computer: the key belongs to the server.

## 2. Make the key
    copy: ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ""
    expect: two new files in ~/.ssh: deploy_key and deploy_key.pub

## 3. Open the repository's deploy keys
    url: https://git.example.org/*/settings/keys
    target: text=Add deploy key
In the repository: Settings, then Deploy keys.

## 4. Add the public half
    url: https://git.example.org/*/settings/keys/new
    target: button:has-text("Add key")
Paste the one line from `deploy_key.pub` and press Add key. Leave write access off.
```

Fields (all optional, one per line, indented under the step):

| field | meaning |
|---|---|
| `url:` | where this step happens: a URL or a match pattern (`https://host/path*`). Used for "where am I" and to offer "open here". Several `url:` lines allowed. |
| `copy:` | a value to copy with one click (shown as a chip; the drawer never runs it). Several allowed. |
| `expect:` | what the person should see when the step is done. |
| `target:` | what to point at on the page (phase 2): a CSS selector, or `text=…` for visible text. Several allowed, tried in order. |
| `image:` | a picture for the step (URL or data URI). |
| `note:` | a hint for the notes-back panel: what to paste back at this step. |
| `optional: true` | the step may be skipped without being done. |

Plain prose under a step is the step's body (Markdown). A guide may also arrive as JSON (`{ title, id, steps: [{ title, body, url: [], copy: [], expect, target: [], image, note, optional }] }`); the parser produces exactly this shape from the Markdown, and the JSON form is what feeds send.

**Feeds.** A feed is a JSON list at a URL: `[{ id, title, url (the guide's .md), updated, for?, done? }]`. The drawer lists the feed's guides newest first and fetches a guide when opened. A feed may need a header (a bearer token the user pastes into the feed's settings); the token is stored locally and sent only to that feed's origin. This is how a team's tool (a CMS, an assistant, a help desk) hands guides to a person.

## The drawer

- **Home**: the guides you have (from feeds, pasted, opened from a URL or a file), newest first, with progress. A paste box: paste Markdown or a URL, it becomes a guide. Drag a `.md` file in.
- **A guide**: title; progress (3 of 9); the current step open: its title, body, chips for `copy:` values (click = copied, with a quiet "copied"), the `expect:` line, the `image:`; **Next**, **Back**, **Skip** (optional steps), **Done** on the last. Done steps collapse to one line with a tick; click one to reopen. Keys: `n` next, `p` back, `c` copy the first value, `o` open the step's URL here.
- **Where am I**: when the active tab's URL matches a later step's `url:`, a quiet line offers "You seem to be on step 6 — jump?" It never jumps by itself.
- **Open here**: a link in a step, or the step's `url:`, navigates the active tab. New-window behaviour never.
- **Notes back**: a box under the guide; "Send" delivers to the chosen destination with `{ guide id, step n, tab URL, time, text }`; a local history of what was sent, with resend. Destinations: **download as a file** (`.md` with the note appended; always available), **copy**, **webhook** (POST JSON to a URL, optional header), **mail** (opens `mailto:` with the note), and a place for more (a destination is one small module).
- **Settings**: feeds (URL, header, name), destinations, pointing at pages (per-site permission list), theme follows the system, text size.
- **State**: everything in `chrome.storage.local` (guides, progress per guide, history, settings). Export/import as one JSON file. Nothing synced by default; `storage.sync` for settings as an option later.

## Pointing at the page (phase 2)

On "Show me", and only then, the drawer asks for the site's permission (the browser's own prompt) and injects a content script that finds the step's `target:` (selector, or visible text), scrolls it into view and draws a ring around it (an overlay element, high z-index, pointer-events none, pulsing twice then still, removed on next/back or after 20 s, respects reduced motion). It never clicks, types or changes the page's data. When nothing matches, it says so plainly ("could not find *Restart* on this page") rather than guessing. Sites that block injection (browser pages, stores, strict CSP) degrade to "open here" + the text.

A later phase may add "do it for me" per step — click or fill with an explicit confirmation each time — but that is a separate decision and a separate permission, not in this brief.

## Architecture

- **WebExtension, Manifest V3**, TypeScript, built with Vite (`@crxjs/vite-plugin` or plain Vite with a manifest step). Preact or no framework; keep the panel under ~150 KB.
- Parts: `background` (service worker: tab URL changes → "where am I"; feed refresh), `sidepanel` (the drawer UI; `sidebar_action` on Firefox from the same page), `content` (the pointer, injected on demand via `scripting.executeScript`), `options` (settings page; the same UI as the drawer's Settings), `lib/guide` (the parser + types: pure, tested), `lib/destinations` (file, copy, webhook, mail), `lib/store` (storage wrapper, export/import).
- Permissions: `storage`, `sidePanel`, `activeTab`, `tabs` (for the URL of the active tab; if the reviewers push back, `activeTab` + the panel's own tab events), `scripting` (phase 2), optional host permissions requested per site; `downloads` for the file destination. Fetching a guide or a feed by URL: from the side panel with the user's optional host permission for that origin, or the user pastes. No `<all_urls>` by default, ever.
- Firefox: `sidebar_action` + `webextension-polyfill`; one codebase, two manifests generated at build.
- Security: no remote code, no `eval`, strict CSP, Markdown rendered through a sanitiser (links allowed, scripts and styles stripped), `target:` selectors run only in the content script's own overlay logic. Webhook destination shows the URL and the body before the first send to a new URL.
- Tests: unit tests for the parser (Markdown → steps, headings vs lists, fields, JSON round-trip), the "where am I" matcher, and each destination's payload; Playwright for the drawer (load a guide, step through with keys, copy a chip, send a note to a local webhook stub). CI: GitHub Actions builds both zips on every push and runs the tests.

## Repository

```
handrail/
  README.md           what it is, a picture, install (unpacked) in Chrome and Firefox, the guide format in one screen
  LICENSE             MIT
  CHANGELOG.md        one terse line per change, per version
  CONTRIBUTING.md     how to add a destination, how to write a guide, the rules below
  docs/guide-format.md  the contract above, with examples
  guides/             example guides (including the one above and a "write your first guide" guide)
  src/{background,sidepanel,content,options,lib}/
  tests/
  .github/workflows/build.yml
```

## Milestones

| version | brings |
|---|---|
| **0.1** | Chrome side panel; paste / URL / file guides; the parser; one step at a time, chips, keys, progress; "open here"; "where am I"; state in storage; export/import. Usable by Dragnoz for the next real guide. |
| **0.2** | Firefox sidebar from the same code; feeds (with header); notes back with file, copy, webhook, mail; history. |
| **0.3** | Pointing at the page: selector and `text=` targets, per-site permission, graceful failure. |
| **0.4** | Store listings (Chrome Web Store, AMO), docs, a "write your first guide" guide, a feed example (a static JSON on any web host). |

Each milestone ships with its version bump, its changelog lines, and a screenshot in the README.

## Acceptance (0.1)

Dragnoz opens Chrome, opens the drawer, pastes a guide Claude wrote for him (the deploy key guide above), and does the job without opening a second window: copies the command from the chip, is offered the jump when he lands on the repository's settings page, ticks through, and at the end has a note in the history. Nothing was sent anywhere. The extension asked for no permission beyond the side panel and storage.

## What this is not (v1)

Not an assistant (no model inside; the guide comes from outside); not a recorder; no automation; no account or sync service; no mobile (Chrome on Android has no extensions; Firefox Android is a later look); no analytics of any kind.

## Rules for whoever builds it

- Version and changelog on every release; plain words everywhere (README, UI, errors); no marketing voice.
- The person is **Dragnoz** in any example or acknowledgement; no real names. No internal names either: no machine, server, host, folder or private product names; example addresses are `example.org` ones.
- The drawer never does anything by itself: no auto-jump, no auto-send, no auto-click.
- Small, boring dependencies; no framework unless it earns its place; no telemetry library, ever.
- When a store policy and a feature collide, the policy wins and the feature degrades gracefully.
- Keep `docs/guide-format.md` the single source of truth for the format; the parser's tests are written against its examples.

## How the first guides will arrive

Anyone can write a guide in this format, by hand or with a tool. A guide reaches the drawer three ways: pasted; from a feed someone keeps for the sites they know; or from the site itself, which hosts its own feed. Dragnoz's own tools that already write step-by-step guides will each expose a feed once 0.2 exists; until then he pastes. The format is the only coupling: Handrail knows nothing about any one tool or site.
