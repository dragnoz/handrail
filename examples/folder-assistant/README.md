# A folder assistant

`serve.mjs` turns a folder into an assistant that takes asks and notes. Node 20 or newer, no dependencies.

```
node examples/folder-assistant/serve.mjs --folder ./my-assistant --port 7077 --key choose-a-secret --name "My assistant"
```

Then, in Handrail's Settings, add `http://localhost:7077/handrail.json` with that key.

- Guides in `my-assistant/guides/*.md` are the list. The drawer offers one when the person is on a page a step's `url:` names.
- An **ask** from the drawer is written to `my-assistant/inbox/<time>-<words>.md`. Whoever or whatever answers (a person, a script, an AI tool) writes a guide into `guides/`; it shows up in the drawer within five minutes, or at once after "Check now".
- A **note** from the drawer is appended to `my-assistant/notes.md`.
- Lines in `my-assistant/notices.json` (the shape in [docs/assistant.md](../../docs/assistant.md)) show as notices; one with a `guide` address shows "Open the guide".
- `--home https://…` adds a page the drawer can show.

Everything the script does is a file write, so it is easy to read and easy to replace with your own.
