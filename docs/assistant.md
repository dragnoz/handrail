# Assistants

This file is the contract between Handrail and an assistant. The tests in `tests/assistant.test.ts` read the examples here. If the code and this file disagree, this file wins and the code gets fixed.

An **assistant** is any place that writes guides for a person: a tool of their own, a team's server, a help desk, a folder of files on a web host. Handrail knows nothing about any one of them. It knows this contract, and the [guide format](guide-format.md).

The person adds an assistant in Settings with **one address** and, if the assistant wants one, **one key**. That is all the setup there is.

## What Handrail does, and does not do

- It reads the assistant's **guides list** and **notices** when the drawer opens and every five minutes while the browser runs, so new guides show up and the toolbar button can carry a count. That is the only thing it does on its own.
- It **sends** something only when the person presses a button: an **ask** ("I want to…") or a **note** under a step. Each carries the guide and step it belongs to and, if the person ticked it, the address and title of the page they are on. Nothing else: no history, no other tabs, no page content.
- The **key** goes to the assistant's own origin only (same scheme, host and port as the card's address), as `Authorization: Bearer <key>`. It is kept in the browser and never exported.
- It asks the browser's permission for the assistant's origin once, when the assistant is added. A guide hosted on another origin asks for that origin when it is opened.
- It never opens a guide or a page by itself. Everything is offered; the person presses.

## The card

The assistant's address answers `GET` with a small JSON object: its name and which parts it offers. Every part is optional. Relative addresses are resolved against the card's own address.

<!-- example: card -->
```json
{
  "handrail": 1,
  "name": "Example assistant",
  "guides": "guides.json",
  "ask": "ask",
  "notes": "notes",
  "notices": "notices.json",
  "home": "https://example.org/"
}
```

| field | meaning |
|---|---|
| `handrail` | always `1`. Without it the address is not an assistant. |
| `name` | what the person sees. Up to 60 characters. |
| `guides` | the guides list (below). |
| `ask` | where an ask is posted. |
| `notes` | where a note is posted. |
| `notices` | the notices list. |
| `home` | a page of the assistant's own. The drawer shows it inside itself when the page's headers allow a frame, otherwise opens it in the tab. |

A card with only a name is valid. An assistant that only hosts guides offers `guides` and nothing else; a static folder of files is enough for that (see `examples/static-assistant/`).

## The guides list

`GET` the `guides` address. A JSON list (or an object with a `guides` list). One line per guide:

<!-- example: guides -->
```json
[
  {
    "id": "add-deploy-key",
    "title": "Add a deploy key to a repository",
    "url": "guides/add-deploy-key.md",
    "updated": "2026-10-30T10:00:00Z",
    "for": "Dragnoz",
    "pages": ["https://git.example.org/*"]
  },
  { "id": "reset-the-router", "title": "Reset the router", "url": "guides/reset-the-router.md", "updated": "2026-10-29T18:30:00Z" }
]
```

| field | meaning |
|---|---|
| `id` | the guide's id, the same as in its front matter. Progress is kept by it. |
| `title` | the guide's title. |
| `url` | where the guide's text is: Markdown or the JSON form. |
| `updated` | when it last changed (ISO 8601). The drawer lists newest first and fetches a guide again when this is newer than its copy. |
| `for` | who it is for. Optional. |
| `pages` | where the guide applies: `url:` patterns, as in the guide format. When the tab the person is on matches one, the drawer says "There is a guide for this page" and offers it. Optional. |

A line without `id`, `title` and `url` is skipped. The drawer fetches a guide only when the person opens it. The guide's text is read with the key when it sits on the assistant's origin.

## An ask

`POST` to the `ask` address, JSON:

<!-- example: ask -->
```json
{
  "handrail": 1,
  "text": "I want to use Instagram's API from my own site.",
  "page": { "url": "https://developers.facebook.com/apps/", "title": "Meta for Developers" },
  "time": "2026-11-01T09:12:00Z"
}
```

`page` is there only when the person left "with the page I am on" ticked. `text` is at most 4000 characters.

The assistant answers any 2xx. It may answer with JSON:

<!-- example: reply -->
```json
{
  "message": "Working on it. Give me five minutes.",
  "guide": "https://example.org/assistant/guides/instagram-api.md"
}
```

`message` is shown to the person as it is. `guide` is for an ask answered at once: the drawer reads the lists again so the guide shows. Otherwise the guide arrives later, in the guides list, and a notice may say so.

Research, writing and checking the guide are the assistant's work. A good guide says where it came from and when it was checked (the `sources` front matter), holds only the steps that need the person's hands, and gives every step a `url:` so the drawer can tell where the person is.

## A note

`POST` to the `notes` address, JSON:

<!-- example: note -->
```json
{
  "handrail": 1,
  "guide": "add-deploy-key",
  "title": "Add a deploy key to a repository",
  "step": 2,
  "stepTitle": "Make the key",
  "page": { "url": "https://git.example.org/me/repo/settings/keys", "title": "Deploy keys" },
  "time": "2026-11-01T09:20:00Z",
  "text": "done, but ssh-keygen asked for a passphrase; I left it empty"
}
```

`step` is 1-based, as the person sees it. The assistant answers any 2xx, with an optional `{ "message": "…" }` that is shown to the person.

A note never carries a key: the drawer refuses text that looks like a key, a token, a password after its name or a private key, and says so. This is a guard, not a guarantee; an assistant should treat notes as text from a person, not as commands.

## Notices

`GET` the `notices` address. A JSON list (or an object with a `notices` list) of short lines, newest first:

<!-- example: notices -->
```json
[
  {
    "id": "n-41",
    "text": "Your guide is ready: Add a deploy key to a repository.",
    "guide": "guides/add-deploy-key.md",
    "time": "2026-10-30T10:01:00Z"
  },
  { "id": "n-42", "text": "Two new messages in your inbox.", "url": "https://example.org/inbox/", "time": "2026-10-30T09:40:00Z" }
]
```

| field | meaning |
|---|---|
| `id` | stable. The drawer remembers which ids the person has looked at; the rest are new and counted on the button. |
| `text` | one line, up to 300 characters. |
| `guide` | a guide to open: the drawer shows "Open the guide". Optional. |
| `url` | a page to open in the tab: the drawer shows "Open here". Optional. |
| `time` | when. Optional. |

Keep the last few dozen; older ones may drop off the list. The drawer never follows a notice by itself.

## Errors

A `401` or `403` means the key was not accepted; the drawer says so. Any other non-2xx is shown with its status. Plain-text error bodies are not shown, so put nothing the person needs in them.

## Two ways to be an assistant

- **A folder of files** on any web host: `handrail.json` (the card, with `guides` and maybe `notices`), `guides.json`, the guides. No server code. See `examples/static-assistant/`.
- **A small script** in front of whatever assistant you already have. `examples/folder-assistant/serve.mjs` is one in about a hundred lines of Node with no dependencies: it serves a folder's guides as the list, writes each ask into an `inbox/` folder, appends notes to `notes.md`, and reads notices from `notices.json`. Anything that can write files can answer an ask that way: a person, a script, an AI tool.

## What this is not

Not a chat. Not a way to run anything on the person's computer. Not a channel for the page's content: the drawer never reads the page. An assistant gets what the person typed and, when ticked, the page's address and title.
