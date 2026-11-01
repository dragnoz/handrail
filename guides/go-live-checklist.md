---
title: Before the site goes live
id: go-live-checklist
kind: list
by: Claude
for: Dragnoz
version: 1
---

Once each, in any order. Tick them as you go; add what your site needs.

- [ ] Point the domain at the server
      url: https://dns.example.org/*
      expect: the site opens at its own name within an hour
- [ ] Turn on HTTPS, and send http to https
      url: https://panel.example.org/ssl
      expect: a lock in the address bar, no warning
- [ ] Nightly backups, kept 30 days
      url: https://panel.example.org/backups
      note: where the backups land, and who can restore them
- [ ] Two-factor login for every admin account
- [ ] A page for privacy and contact
      expect: both linked from the footer
- [ ] Try every page on a phone
      optional: true
- [ ] Tell the search engines
      url: https://search.google.com/search-console
      optional: true
