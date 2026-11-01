# A static assistant

A folder of files is a valid assistant: it offers guides and notices, and no server code runs. Put this folder on any web host (GitHub Pages, a shared folder behind a web server, an S3 bucket) and add the address of `handrail.json` in Handrail's Settings.

- `handrail.json`: the card. Its `guides` and `notices` are relative to it.
- `guides.json`: the list. `updated` makes the drawer fetch a guide again when it changed; `pages` makes the drawer offer the guide when the person is on a matching page.
- `guides/`: the guides, in the [guide format](../../docs/guide-format.md).
- `notices.json`: short lines; the drawer counts the ones the person has not looked at.

No ask and no notes: a static folder cannot receive anything. For that, see `../folder-assistant/`.

To try it on this machine, any static server does, for example `npx serve examples/static-assistant` and then `http://localhost:3000/handrail.json`.
