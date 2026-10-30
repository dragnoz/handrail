# The guide format

This file is the contract. The parser's tests are written against the examples here. If the parser and this file disagree, this file wins and the parser gets fixed.

A guide is a Markdown file. It can be written in a text editor or produced by a tool. Nothing in it is proprietary.

## The shape

- **Front matter** (optional): a block between `---` lines at the top, `key: value` per line.
- **Steps**: either the `## ` headings or the numbered list (`1.` `2.` `3.` at the start of a line). When a file has both, the headings are the steps.
- **Fields**: a small indented block right under a step's title, one `key: value` per line.
- **Body**: the prose under a step, Markdown. It can be empty.
- **Intro**: the text before the first step. A `# Title` line there is the guide's title when the front matter has none.

## Example: headings with front matter

<!-- example: nozlab -->
```markdown
---
title: Set up the site on nozlab
id: nozlab-site-setup
by: Claude (NOZ)
for: Dragnoz
version: 1
sources: https://example.org/guides/nozlab-site-setup.md
---

Makes the `nozsite` user and installs the one-command key, once.

## 1. Open a terminal on this laptop
Not on Camelot: that machine holds no key for nozlab.

## 2. Run the setup
    copy: ssh perseus-host 'sh /root/nozlab-site-setup.sh'
    expect: it ends with "nozlab-site is set up. Camelot may publish now."

## 3. Restart the Perseus server
    url: http://camelot:25895/*
    target: button:has-text("Restart")
Say "restart" to Claude, or press the button on the Servers page.

## 4. Publish a page
    url: http://camelot:25895/*
    target: text=🌐 Publish
Open any board's Workbook and press Publish.
```

## Example: a numbered list, no front matter

<!-- example: list -->
```markdown
# Reset the router

Takes two minutes. Nothing is lost.

1. Unplug it
   Wait ten seconds before the next step.
2. Plug it back in
   expect: the lights come back one by one
3. Check the connection
   url: https://example.org/status
   optional: true
   Only if the first page you open does not load.
```

## Front matter

| key | meaning |
|---|---|
| `title` | the guide's name |
| `id` | a stable id; progress is kept by it. Without one, the id is made from the title (`Set up the site` becomes `set-up-the-site`). A guide with the same id replaces the earlier one. |
| `by` | who wrote it |
| `for` | who it is for |
| `version` | the guide's own version, any text |
| `sources` | where it came from: one address, a `[a, b]` list, or `- item` lines |

Values may be quoted or not. Other keys are ignored.

## Steps

- A step's title is the heading text or the list item's first line. A leading number is dropped: `## 1. Open a terminal` and `## Step 1: Open a terminal` both give **Open a terminal**.
- Headings and numbered lines inside a code fence (` ``` `) are not steps.
- In a list guide, the lines under an item belong to it (indented or not) until the next item.

## Fields

The field block is the lines right under the step's title (blank lines before it are fine), each indented by two or more spaces or a tab, in the form `key: value`. The first line that is not a known field ends the block; everything after is the body. A line with an unknown key is not a field: it stays in the body as written, so a typo shows rather than vanishes.

| field | meaning |
|---|---|
| `url:` | where this step happens: an address or a pattern with `*`. Used for "where am I" and for "open here". Several lines allowed. |
| `copy:` | a value to copy with one click. The drawer never runs it. Several allowed. Backticks around the value are removed. |
| `expect:` | what the person should see when the step is done. |
| `target:` | what to point at on the page (0.3): a CSS selector, or `text=...` for visible text. Several allowed, tried in order. |
| `image:` | a picture for the step: an address or a data URI. |
| `note:` | a hint for the notes-back panel (0.2): what to paste back at this step. |
| `optional: true` | the step may be skipped. `yes`, `on` and `1` also mean true. |

### How `url:` matches

- A pattern with `*` matches any characters there: `http://camelot:25895/*` matches every page on that server; `https://*.example.org/*` matches every page on its subdomains.
- A plain address matches that page exactly. The `#fragment`, a trailing slash and letter case are ignored. `https://example.org/status` and `https://example.org/status/#top` are the same page.
- "Where am I" looks at the steps after the current one only, and offers the first that matches. It never jumps by itself.

## The JSON form

The parser turns Markdown into exactly this shape, and a guide may arrive as JSON directly (a pasted text that starts with `{` is read as JSON). This is what feeds send.

<!-- example: json -->
```json
{
  "id": "nozlab-site-setup",
  "title": "Set up the site on nozlab",
  "by": "Claude (NOZ)",
  "for": "Dragnoz",
  "version": "1",
  "sources": ["https://example.org/guides/nozlab-site-setup.md"],
  "intro": "Makes the `nozsite` user and installs the one-command key, once.",
  "steps": [
    {
      "title": "Open a terminal on this laptop",
      "body": "Not on Camelot: that machine holds no key for nozlab.",
      "url": [],
      "copy": [],
      "target": [],
      "optional": false
    },
    {
      "title": "Run the setup",
      "body": "",
      "url": [],
      "copy": ["ssh perseus-host 'sh /root/nozlab-site-setup.sh'"],
      "expect": "it ends with \"nozlab-site is set up. Camelot may publish now.\"",
      "target": [],
      "optional": false
    },
    {
      "title": "Restart the Perseus server",
      "body": "Say \"restart\" to Claude, or press the button on the Servers page.",
      "url": ["http://camelot:25895/*"],
      "copy": [],
      "target": ["button:has-text(\"Restart\")"],
      "optional": false
    },
    {
      "title": "Publish a page",
      "body": "Open any board's Workbook and press Publish.",
      "url": ["http://camelot:25895/*"],
      "copy": [],
      "target": ["text=🌐 Publish"],
      "optional": false
    }
  ]
}
```

In JSON, `url`, `copy`, `target` and `sources` may be a single string instead of a list. Missing fields are filled with their empty value. `expect`, `image` and `note` are left out when empty.

## Feeds (0.2)

A feed is a JSON list at an address:

```json
[
  { "id": "nozlab-site-setup", "title": "Set up the site on nozlab", "url": "https://example.org/guides/nozlab-site-setup.md", "updated": "2026-10-30T10:00:00Z", "for": "Dragnoz", "done": false }
]
```

The drawer lists a feed's guides newest first and fetches a guide when it is opened. A feed may need a header (a bearer token the person pastes into the feed's settings); the token is kept locally and sent only to that feed's origin.
