# Contributing

Handrail is small on purpose. Read `BRIEF.md` for what it is and is not.

## The rules

- Every release bumps the version in `package.json` (the manifest takes it from there) and adds one terse line per change to `CHANGELOG.md`.
- Plain words in the UI, the README and every error. No marketing voice. The person in examples is Dragnoz. No internal names: no machine, server, host, folder or private product names; example addresses are example.org ones.
- The drawer never acts by itself: no auto-jump, no auto-send, no auto-click.
- No telemetry, no remote code, no `<all_urls>`. Permissions are the minimum, asked for when needed.
- `docs/guide-format.md` is the single source of truth for the guide format and `docs/assistant.md` for the assistant contract. The tests read their examples; change the doc first, then the code.
- Small, boring dependencies. No framework beyond Preact; no analytics library, ever.
- When a store policy and a feature collide, the policy wins and the feature degrades gracefully.

## Working on it

```
pnpm install
pnpm build          # dist/ for Chrome and dist-firefox/ for Firefox
pnpm build:chrome   # one of them; pnpm watch rebuilds Chrome on change
pnpm test           # parser, matcher
pnpm test:e2e       # the drawer in Chromium (needs a build first)
pnpm lint:firefox   # web-ext lint on dist-firefox (Playwright cannot load Firefox add-ons, so Firefox is tested by hand)
pnpm typecheck
pnpm screenshot     # the README pictures, from the built extension
pnpm zip            # release/handrail-<browser>-<version>.zip
```

The browser API is used only through `webextension-polyfill` (`import browser from 'webextension-polyfill'`), never `chrome.*` directly, except the one Chrome-only `sidePanel` call in the background script. The background is an ES module in both browsers, so it shares `src/lib` with the drawer. The manifest for each browser is generated in `src/manifest.ts`.

Layout:

```
src/background/   the toolbar button opens the drawer; reads the assistants' lists every five minutes; the count on the button
src/sidepanel/    the drawer page
src/options/      the settings page (same component as the drawer's Settings)
src/lib/guide/    parser, types, "where am I" matcher: pure, tested
src/lib/assistant/ the assistant contract: card, lists, asks, notes, notices, the key guard: pure, tested
src/lib/destinations/ where a note goes: clipboard, file, mail, webhook, an assistant
src/lib/store/    chrome.storage.local wrapper, export/import
src/lib/ui/       Preact views
src/lib/ext.ts    the one place that talks to tabs and permissions
src/manifest.ts   the manifest, generated per browser at build
docs/             the guide format and the assistant contract, screenshots
examples/         two assistants: a static folder, and a Node script in front of a folder
guides/           example guides
tests/            unit tests (vitest) and tests/e2e (Playwright)
```

## Writing a guide

See `docs/guide-format.md`. Short version: Markdown, `## ` headings are the steps, indented `key: value` lines right under a heading are the step's fields (`url:`, `copy:`, `expect:`, `optional: true`), the prose is the body. `guides/write-your-first-guide.md` walks you through it inside Handrail.

## Adding a destination

A destination is one entry in `src/lib/destinations/index.ts`: a kind, a `label()` and a `send(note, ctx)` that delivers the note payload from `docs/assistant.md` and resolves with one line for the person, or throws a plain message. It must not send anything unless the person pressed Send; a new host asks for the browser's permission first, inside that click.

## Being an assistant

Read `docs/assistant.md`. The tests in `tests/assistant.test.ts` read its examples, so change the doc first. The two examples in `examples/` must keep working against it.

## Commits

One change per commit, in plain words. Don't bump the version in a change commit; bump it in the release commit with the changelog lines.
