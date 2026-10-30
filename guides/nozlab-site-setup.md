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
