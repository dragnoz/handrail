# Changelog

One line per change, per version.

## 0.1.1 — 2026-10-30

- Firefox: the sidebar from the same code (`pnpm build` makes `dist/` for Chrome and `dist-firefox/` for Firefox); the toolbar button toggles it.
- The browser API goes through webextension-polyfill in both browsers.
- Firefox manifest: `optional_permissions` for guide addresses, a gecko id, "no data collected" declared.
- Release zips for both browsers; CI lints the Firefox build with web-ext.

## 0.1.0 — 2026-10-30

- Chrome side panel: the drawer opens from the toolbar button.
- Guides from a paste, a link (asks for that one site) or a file; drop a .md on the panel.
- Parser: Markdown with front matter, `##` headings or a numbered list, fields under each step; JSON form in and out.
- One step open at a time; done steps fold to a ticked line; the rest listed below.
- Copy chips, "You should see", pictures, optional steps with Skip.
- Keys: n next, p back, c copy, o open; ignored while typing.
- "Open here": links and a step's address open in the current tab, never a new window.
- "Where am I": offers a jump when the tab lands on a later step's page; never jumps by itself.
- Progress per guide, kept in the browser; the drawer reopens where you were.
- Settings: text size, export and import as one JSON file, remove everything.
- Options page with the same settings.
- Light and dark follow the system; reduced motion respected; keyboard throughout.
- Tests: parser and matcher against docs/guide-format.md; Playwright for the drawer; CI builds the zip.
