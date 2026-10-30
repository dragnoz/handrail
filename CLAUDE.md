# Handrail

Read `BRIEF.md` first; it is the whole specification. Build milestone 0.1 as it describes, then stop and show the result (a screenshot of the drawer with a loaded guide) before 0.2.

Rules that apply to every change here:
- Every release bumps the version (`package.json` + `manifest`) and adds one terse line per change to `CHANGELOG.md`.
- Plain words in the UI, the README and errors. No marketing voice. The person in examples is Dragnoz.
- The drawer never acts by itself: no auto-jump, no auto-send, no auto-click.
- No telemetry, no remote code, no `<all_urls>`. Minimal permissions, asked for when needed.
- `docs/guide-format.md` is the single source of truth for the guide format; the parser tests are written against its examples.
- Open source, MIT, from the first commit.
