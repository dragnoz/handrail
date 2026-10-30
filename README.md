# Handrail

A step-by-step guide at the side of the page you are working on.

When you have to do something complex on the web, the instructions live in one window and the work in another. Handrail puts the guide in a drawer beside the page: one step at a time, a value to copy with one click, links that open under the drawer, and a quiet "you seem to be on step 6, jump?" when you land on the page a later step is about.

![The drawer with a guide: step 1 done, step 2 open with a command to copy, steps 3 and 4 below](docs/screenshots/0.1-drawer.png)

It is not an assistant and not an automation tool. The guide is written elsewhere, by a person or by an assistant. Handrail is the rail you hold while you walk it. There is no account, no server and no telemetry. Nothing leaves the browser.

## Install (Chrome, 0.1)

1. Get `dist/`: download the latest `handrail-chrome` zip from the Actions tab and unpack it, or build it (`pnpm install && pnpm build`).
2. Open `chrome://extensions`, turn on **Developer mode**, press **Load unpacked** and choose the `dist` folder.
3. Press the Handrail button in the toolbar. The drawer opens at the side.

Firefox comes in 0.2 from the same code. Stores come in 0.4.

## Use

- **Add a guide**: paste its text into the box at the top, or paste a link to a `.md` file (Handrail asks for that one site), or open a file, or drop a `.md` on the panel.
- **Walk it**: the open step shows its title, body, chips for values to copy, what you should see, and a picture. **Next**, **Back**, **Skip** on optional steps, **Done** on the last. Done steps fold to a ticked line; click one to reopen it.
- **Keys**: `n` next, `p` back, `c` copy the first value, `o` open the step's address here.
- **Open here**: a link in a step, or the step's address, opens in the tab you are on. Never a new window.
- **Where am I**: when the tab you are on matches a later step's address, the drawer offers a jump. It never jumps by itself.
- **Settings**: text size, export and import everything as one JSON file, remove everything.

## The guide format

A guide is Markdown. Steps are the `## ` headings (or a numbered list). Fields sit in an indented block right under a step.

```markdown
---
title: Set up the site on nozlab
id: nozlab-site-setup
for: Dragnoz
---

## 1. Open a terminal on this laptop
Not on Camelot: that machine holds no key for nozlab.

## 2. Run the setup
    copy: ssh perseus-host 'sh /root/nozlab-site-setup.sh'
    expect: it ends with "nozlab-site is set up."

## 3. Restart the Perseus server
    url: http://camelot:25895/*
Press the button on the Servers page.
```

| field | meaning |
|---|---|
| `url:` | where the step happens; `*` matches anything. Used for "where am I" and "open here". |
| `copy:` | a value to copy with one click. Never run. |
| `expect:` | what you should see when the step is done. |
| `image:` | a picture (address or data URI). |
| `optional: true` | the step may be skipped. |
| `target:`, `note:` | for 0.3 (pointing at the page) and 0.2 (notes back). |

The whole contract, with the JSON form and feeds, is in [docs/guide-format.md](docs/guide-format.md). Two example guides are in [guides/](guides/), one of them a guide that teaches you to write one.

## Permissions, and why

| permission | why |
|---|---|
| `storage` | your guides, progress and settings stay in the browser |
| `sidePanel` | the drawer |
| `tabs` | the address of the tab you are on, for "where am I" and "open here". Chrome words this as "read your browsing history"; Handrail reads the active tab's address and records nothing. |
| one site, when you add a guide by link | fetching that file; asked for at that moment, for that site only |

No `<all_urls>`, no content scripts in 0.1, no remote code.

## Develop

```
pnpm install
pnpm build        # dist/
pnpm test         # parser and matcher, against docs/guide-format.md
pnpm test:e2e     # the drawer in Chromium
pnpm screenshot   # README pictures
pnpm zip          # release/handrail-chrome-<version>.zip
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout and the rules. Every change is one line in [CHANGELOG.md](CHANGELOG.md).

## Roadmap

| version | brings |
|---|---|
| 0.1 | Chrome side panel; paste, link and file guides; the parser; one step at a time; chips; keys; open here; where am I; export and import |
| 0.2 | Firefox sidebar from the same code; feeds; notes back to a file, the clipboard, a webhook or mail |
| 0.3 | Pointing at the page: outline the button a step names, per-site permission |
| 0.4 | Store listings, docs, a feed example |

## Licence

MIT. See [LICENSE](LICENSE).
