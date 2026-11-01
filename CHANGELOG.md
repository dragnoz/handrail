# Changelog

One line per change, per version.

## 0.2.0 — 2026-11-01

- Assistants: add one in Settings by address, with a key if it wants one; it lists guides, takes asks and notes, and posts notices. The contract is docs/assistant.md; anyone can be one.
- Ask: say what you want to do; the assistant writes the guide and it shows up in your list.
- Notes back under every step: to the clipboard, a file, your mail program, a webhook or an assistant. Text that looks like a key or a password is refused.
- "There is a guide for this page": offered when the tab matches a listed guide's pages. Never opened by itself.
- Notices from an assistant, with a count on the toolbar button; the background reads the lists every five minutes (new `alarms` permission). Off in Settings.
- An assistant's own page inside the drawer when its headers allow a frame; in the tab otherwise.
- Sent: asks and notes with what came back, and send again, in Settings.
- Export leaves the assistants' keys out.
- Two example assistants in examples/: a static folder, and a Node script that turns a folder into one.
- guides/add-an-assistant.md: how to connect one, as a guide.
- The background is an ES module in Firefox too, so it shares code with the drawer.

## 0.1.4 — 2026-10-30

- No internal names left: examples, guides, tests and screenshots use neutral names and example.org addresses.
- guides/add-deploy-key.md replaces the old example guide; the README, the brief and the format doc use it.
- guides/install-handrail.md: no folder paths from one machine; it points to the practice guide.
- guides/try-handrail.md: an eight-step practice guide that shows every part of the drawer on harmless pages.
- The rule against internal names is written into CONTRIBUTING.md and CLAUDE.md.

## 0.1.3 — 2026-10-30

- Fix: release zips made on Windows had backslash paths, so Firefox found the manifest but not the drawer page; the zip is now written by our own script, forward slashes only.
- CI artifacts are the unpacked builds, so the downloaded handrail-firefox.zip loads straight into Firefox.

## 0.1.2 — 2026-10-30

- Firefox: the sidebar opens once, right after install, so the first run needs no hunting for a button.
- guides/install-handrail.md: a guide, in Handrail's own format, that installs it in the other browser.

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
