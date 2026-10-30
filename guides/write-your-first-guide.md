---
title: Write your first guide
id: write-your-first-guide
by: Handrail
for: Dragnoz
version: 1
---

A guide is a plain text file. This one shows you how to write one, step by step, and ends with you walking it in Handrail.

## 1. Open a text editor
Any editor that saves plain text. Name the file something like `my-first-guide.md`.

## 2. Give it a title
    copy: title: My first guide
Put this at the very top, between two lines of three dashes:

```
---
title: My first guide
---
```

Everything between the dashes is called front matter. You can leave it out, and then the first `# Heading` is the title.

## 3. Write the steps as headings
    copy: ## 1. Do the first thing
Each step is a line that starts with `## `. The number is optional; Handrail drops it. Under the heading, write what to do, in plain words. Keep each step to one thing.

## 4. Add a value to copy
    copy: copy: echo hello
    expect: a chip under the step, which copies the value when clicked
Right under a step's heading, indent a line by four spaces and write `copy:` followed by the value. The person copies it with one click. Handrail never runs it.

## 5. Say where a step happens
    copy: url: https://example.org/*
    optional: true
Indent a `url:` line under a step. When the person lands on a page that matches, Handrail offers to jump to that step. It never jumps by itself. A `*` matches anything.

## 6. Paste it into Handrail
Copy the whole file, open the drawer, paste it into the box at the top of the home screen and press **Add guide**. Your guide appears in the list. Open it and walk it.

## 7. Keep it
    optional: true
Save the file somewhere you will find it, or put it on a web host and add it to Handrail by its address.
