// The cleanup guide the site check offers after a bad result: the generic steps for a hacked
// WordPress site, written for the one site that was checked, so every step's address opens there.
// guides/clean-a-hacked-site.md is the same guide the example.org way.

export function cleanupGuideFor(host: string): string {
  const h = host.replace(/[^a-z0-9.-]/gi, '').toLowerCase();
  const wp = `https://${h}/wp-admin`;
  return `---
title: Clean up ${h}
id: clean-${h}
by: Handrail site check
version: 1
---

The site showed signs of a break-in. These steps close the door, in the right order.
Deleting the visible spam alone is not enough: whoever got in can put it back.

## 1. Lock your email account first
Change the password on the email inbox this site uses, and turn on two-step verification there.
Every other password reset flows through that inbox, so it comes first.

## 2. Ask your hosting company for help
    note: the ticket number, so you can find it again
Open a ticket with the company that hosts the site. Ask for three things: a full backup
(files and database) taken now, before anything changes; a malware and back-door scan;
and the access logs, so they can tell you how and when the break-in happened.

## 3. Get back into WordPress
    url: https://${h}/wp-login.php
    expect: your dashboard
If your password no longer works, use "Lost your password?". If the reset email never
arrives, the intruder may have changed the email on your account: your host can reset it.

## 4. Delete accounts you did not create
    url: ${wp}/users.php
    target: text=Users
Look at every account with the Administrator or Editor role. A name like a random jumble
of letters and digits is the intruder's. Delete it; WordPress will offer to keep its
content under your name.

## 5. Remove the hidden spam
    url: ${wp}/widgets.php
Injected spam often sits in a widget, pushed off-screen so only Google sees it. Open each
widget and remove any you did not put there. Then search your posts and pages for words
like "casino" that do not belong.

## 6. Change every password, then log everyone out
    url: ${wp}/profile.php
Set a new, long password for your own account, then for every other user. New passwords
do not end sessions the intruder already has open, so if your security plugin offers
"log everyone out", use it now.

## 7. Update everything, delete the unused
    url: ${wp}/update-core.php
    expect: everything shows as up to date
Run every waiting update: WordPress itself, the theme, each plugin. Then delete the
plugins and themes you do not use. Out-of-date software is the most common way in.

## 8. Turn on two-factor login
    url: ${wp}/plugin-install.php?s=two-factor&tab=search&type=term
Install a two-factor plugin (the free one called "Two-Factor" is fine) and switch it on
for every administrator. A stolen password alone then no longer opens the door.

## 9. Tell Google once it is clean
    url: https://search.google.com/search-console
    optional: true
In Search Console, check Security Issues and Manual Actions for this site, and request a
review if anything is flagged, so any spam pages drop out of the search results.
`;
}
