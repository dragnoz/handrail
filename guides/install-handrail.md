---
title: Install Handrail in the other browser
id: install-handrail
by: Handrail
for: Dragnoz
version: 1
---

You have Handrail in one browser. This guide installs it in the other one, from the build on this machine. Walk it in the drawer you already have.

## 1. Find the build
    optional: true
The Handrail folder holds `dist` for Chrome and `dist-firefox` for Firefox. If they are missing, run `pnpm build` there first.

## 2. Chrome: open the extensions page
    copy: chrome://extensions
    expect: a page listing your extensions, with a "Developer mode" switch at the top right
Paste the address into Chrome's address bar. The drawer cannot open it for you; Chrome's own pages only open by hand.

## 3. Chrome: turn on Developer mode
    expect: three new buttons appear: Load unpacked, Pack extension, Update
The switch is at the top right.

## 4. Chrome: load the folder
    expect: a Handrail card appears in the list, switched on
Press **Load unpacked** and choose the `dist` folder inside the Handrail folder.

## 5. Chrome: open the drawer
    expect: the drawer opens at the right side of the window, on its home screen
Press the Handrail button in the toolbar. If it is hidden, press the puzzle-piece button and pin Handrail.

## 6. Firefox: open the debugging page
    copy: about:debugging#/runtime/this-firefox
    expect: a page titled "This Firefox" with a "Load Temporary Add-on…" button
Paste the address into Firefox's address bar. Needs Firefox 142 or newer.

## 7. Firefox: load the manifest
    expect: Handrail appears under "Temporary Extensions"
Press **Load Temporary Add-on…** and choose `manifest.json` inside `dist-firefox`.

## 8. Firefox: open the drawer
    expect: the drawer opens as a sidebar
Press the Handrail button in the toolbar. A temporary add-on is gone when Firefox closes; load it again the same way, or wait for the signed build in 0.4.

## 9. Walk a real guide
    optional: true
Paste a guide into the new drawer's box and press **Add guide**. The practice guide in `guides/try-handrail.md` is a good first walk.
