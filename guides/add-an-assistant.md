---
title: Add an assistant
id: add-an-assistant
by: Handrail
for: Dragnoz
version: 1
---

An assistant is a place that writes guides for you. You add it once; after that its guides show up here by themselves. You need its address and, if it wants one, its key. Both come from whoever runs it.

## 1. Open Settings
    expect: a page of settings, "Assistants" at the top
Press the gear at the top right of the drawer.

## 2. Press "Add an assistant…"
    expect: two boxes appear: Address, and Key
It is the button under the Assistants heading.

## 3. Paste the address
    expect: the address in the first box, starting with https://
The address the assistant's owner gave you. It ends in something like handrail.json.

## 4. Paste the key
    optional: true
    expect: dots in the second box
Only if the assistant has one. The key stays in this browser and goes to that address only.

## 5. Press Add
    expect: the browser asks to allow that site once; then a line "… added" at the bottom
Handrail checks the address, reads the assistant's name and keeps it.

## 6. Go back to the guides
    expect: an "Assistants" section under your guides, with the new one in it
Press "← Back" at the top. The assistant's row shows how many new guides and notices it has.

## 7. Open the row
    expect: its notices and its guides, and an "Ask …" button if it takes asks
Press the assistant's name. Press a guide to walk it. Press "Ask …" to tell it what you want to do.
