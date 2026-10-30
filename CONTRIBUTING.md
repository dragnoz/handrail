# Contributing

Handrail is small on purpose. Read `BRIEF.md` for what it is and is not.

## The rules

- Every release bumps the version in `package.json` (the manifest takes it from there) and adds one terse line per change to `CHANGELOG.md`.
- Plain words in the UI, the README and every error. No marketing voice. The person in examples is Dragnoz.
- The drawer never acts by itself: no auto-jump, no auto-send, no auto-click.
- No telemetry, no remote code, no `<all_urls>`. Permissions are the minimum, asked for when needed.
- `docs/guide-format.md` is the single source of truth for the format. The parser's tests read its examples; change the doc first, then the parser.
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

The browser API is used only through `webextension-polyfill` (`import browser from 'webextension-polyfill'`), never `chrome.*` directly, except the one Chrome-only `sidePanel` call in the background script. The manifest for each browser is generated in `src/manifest.ts`.

Layout:

```
src/background/   service worker: the toolbar button opens the drawer (0.2: feed refresh)
src/sidepanel/    the drawer page
src/options/      the settings page (same component as the drawer's Settings)
src/lib/guide/    parser, types, "where am I" matcher: pure, tested
src/lib/store/    chrome.storage.local wrapper, export/import
src/lib/ui/       Preact views
src/lib/ext.ts    the one place that talks to tabs and permissions
src/manifest.ts   the manifest, generated per browser at build
docs/             the guide format contract, screenshots
guides/           example guides
tests/            unit tests (vitest) and tests/e2e (Playwright)
```

## Writing a guide

See `docs/guide-format.md`. Short version: Markdown, `## ` headings are the steps, indented `key: value` lines right under a heading are the step's fields (`url:`, `copy:`, `expect:`, `optional: true`), the prose is the body. `guides/write-your-first-guide.md` walks you through it inside Handrail.

## Adding a destination (0.2)

Notes back arrive in 0.2. A destination will be one small module in `src/lib/destinations/`: an id, a label, an optional settings shape, and a `send(note)` that delivers `{ guideId, step, tabUrl, time, text }` and resolves or throws a plain message. It must not send anything unless the person pressed Send, and must show what it is about to send the first time it talks to a new address.

## Commits

One change per commit, in plain words. Don't bump the version in a change commit; bump it in the release commit with the changelog lines.
