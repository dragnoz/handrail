---
title: Add a deploy key to a repository
id: add-deploy-key
by: Claude
for: Dragnoz
version: 1
sources: https://example.org/guides/add-deploy-key.md
---

Lets one server read one repository, and nothing else.

## 1. Open a terminal on the server
Not on your own computer: the key belongs to the server.

## 2. Make the key
    copy: ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ""
    expect: two new files in ~/.ssh: deploy_key and deploy_key.pub

## 3. Open the repository's deploy keys
    url: https://git.example.org/*/settings/keys
    target: text=Add deploy key
In the repository: Settings, then Deploy keys.

## 4. Add the public half
    url: https://git.example.org/*/settings/keys/new
    target: button:has-text("Add key")
Paste the one line from `deploy_key.pub` and press Add key. Leave write access off.
