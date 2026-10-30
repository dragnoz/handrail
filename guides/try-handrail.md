---
title: Try Handrail
id: try-handrail
by: Handrail
for: Dragnoz
version: 1
---

Two minutes. Every step shows one thing the drawer does. Nothing here changes anything.

## 1. Press Next
This is a step. Press **Next** below, or the **n** key.

## 2. Copy a value
    copy: Hello from Handrail
    expect: the word "Copied" at the bottom of the drawer
Press the grey box. Paste it anywhere with Ctrl+V if you want to check.

## 3. Open a page, here
    url: https://example.org/
Press **Open here**. The page opens in the tab you are on, under the drawer. No new window.

## 4. Skip one
    optional: true
This step is optional, so it has a **Skip** button. Press it.

## 5. Go somewhere, and let the drawer notice
Press this link: [the Handrail page](https://github.com/dragnoz/handrail). It opens in this tab. Then look at the top of the drawer.

## 6. You are on the Handrail page
    url: https://github.com/dragnoz/handrail*
The drawer saw where the tab is and offered this step. It never jumps by itself: you pressed the button.

## 7. Go back one
Press **Back**, or the **p** key. Then press **Next** to come back here.

## 8. Done
Press **Done**. The guide stays in your list with its progress. Close the drawer and open it again: you land where you were.
