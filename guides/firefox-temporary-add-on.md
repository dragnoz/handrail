---
title: Load a temporary add-on in Firefox
id: firefox-temporary-add-on
kind: routine
by: Claude
for: Dragnoz
version: 1
---

The way to try a build that is not signed yet. Lasts until Firefox closes.

## 1. Open the add-on debugging page
    url: about:debugging#/runtime/this-firefox
    expect: "This Firefox" with a list of temporary extensions

## 2. Remove the old card
    optional: true
    expect: the card is gone
Only when the same add-on is already there: **Remove** on its card. Loading over it does not replace it.

## 3. Load the zip
    expect: a new card with the add-on's name
**Load Temporary Add-on…** → pick the zip in Downloads → **Open**. Leave it zipped.

## 4. Allow it on every site
    url: about:addons
    optional: true
    expect: the switch "Access your data for all websites" is on
Only for add-ons that read pages: puzzle piece → the add-on → **Permissions** → the switch.
