#!/usr/bin/env node
// A folder is an assistant. Node, no dependencies.
//
//   node serve.mjs --folder ./my-assistant --port 7077 [--key secret] [--name "My assistant"] [--home https://…]
//
// The folder:
//   guides/*.md        the guides list, and the guides themselves
//   notices.json       the notices list (optional), newest first
//   inbox/             every ask lands here as a Markdown file: answer it by writing a guide into guides/
//   notes.md           every note is appended here
//
// The card is served at /handrail.json; add http://localhost:7077/handrail.json in Handrail's Settings.
// It speaks the contract in docs/assistant.md and nothing more.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const args = parse(process.argv.slice(2));
const folder = resolve(args.folder ?? '.');
const port = Number(args.port ?? 7077);
const key = args.key ?? '';
const name = args.name ?? basename(folder);
const home = args.home ?? '';
mkdirSync(join(folder, 'guides'), { recursive: true });
mkdirSync(join(folder, 'inbox'), { recursive: true });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return end(res, 204, '', headers);
  if (key && req.headers.authorization !== `Bearer ${key}`) {
    return end(res, 401, JSON.stringify({ error: 'key' }), { ...headers, 'content-type': 'application/json' });
  }
  try {
    if (url.pathname === '/handrail.json') {
      const card = { handrail: 1, name, guides: 'guides.json', ask: 'ask', notes: 'notes', notices: 'notices.json' };
      if (home) card.home = home;
      return json(res, card, headers);
    }
    if (url.pathname === '/guides.json') return json(res, guidesList(), headers);
    if (url.pathname === '/notices.json') return json(res, notices(), headers);
    if (url.pathname.startsWith('/guides/')) {
      const file = safeGuide(url.pathname.slice('/guides/'.length));
      if (!file) return end(res, 404, 'not found', headers);
      return end(res, 200, readFileSync(file, 'utf8'), { ...headers, 'content-type': 'text/markdown; charset=utf-8' });
    }
    if (req.method === 'POST' && url.pathname === '/ask') {
      const ask = await body(req);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${stamp}-${slug(ask.text ?? 'ask')}.md`;
      const lines = [`# Ask: ${(ask.text ?? '').split('\n')[0]}`, '', `Time: ${ask.time ?? ''}`];
      if (ask.page?.url) lines.push(`Page: ${ask.page.url}${ask.page.title ? ` (${ask.page.title})` : ''}`);
      lines.push('', ask.text ?? '', '');
      writeFileSync(join(folder, 'inbox', fileName), lines.join('\n'));
      console.log(`ask -> inbox/${fileName}`);
      return json(res, { message: `Noted. It is in the inbox as ${fileName}. The guide will show up in the list.` }, headers);
    }
    if (req.method === 'POST' && url.pathname === '/notes') {
      const n = await body(req);
      const lines = [`## ${n.title ?? n.guide} — step ${n.step}: ${n.stepTitle ?? ''}`, `Time: ${n.time ?? ''}`];
      if (n.page?.url) lines.push(`Page: ${n.page.url}`);
      lines.push('', n.text ?? '', '');
      appendFileSync(join(folder, 'notes.md'), lines.join('\n') + '\n');
      console.log(`note -> notes.md (${n.guide}, step ${n.step})`);
      return json(res, { message: 'Written to notes.md.' }, headers);
    }
    return end(res, 404, 'not found', headers);
  } catch (e) {
    console.error(e);
    return end(res, 500, 'error', headers);
  }
});

server.listen(port, () => {
  console.log(`${name}: http://localhost:${port}/handrail.json  (folder ${folder}${key ? ', with a key' : ''})`);
});

/** Every guides/*.md and *.json: id and title from the front matter or the first heading; pages from the url: lines. */
function guidesList() {
  const dir = join(folder, 'guides');
  return readdirSync(dir)
    .filter((f) => /\.(md|markdown|json)$/i.test(f))
    .map((f) => {
      const path = join(dir, f);
      const text = readFileSync(path, 'utf8');
      const meta = frontMatter(text);
      const id = meta.id || slug(meta.title || f.replace(/\.\w+$/, ''));
      const title = meta.title || heading(text) || f;
      const entry = { id, title, url: `guides/${encodeURIComponent(f)}`, updated: statSync(path).mtime.toISOString(), pages: pages(text) };
      if (meta.for) entry.for = meta.for;
      return entry;
    })
    .sort((a, b) => b.updated.localeCompare(a.updated));
}

function notices() {
  const file = join(folder, 'notices.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function safeGuide(nameInUrl) {
  const f = decodeURIComponent(nameInUrl);
  if (!/^[\w .()-]+\.(md|markdown|json)$/i.test(f)) return null;
  const path = join(folder, 'guides', f);
  return existsSync(path) ? path : null;
}

function frontMatter(text) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

function heading(text) {
  const m = /^#\s+(.+)$/m.exec(text);
  return m ? m[1].trim() : '';
}

/** The url: field lines of every step, as patterns. */
function pages(text) {
  const out = new Set();
  for (const m of text.matchAll(/^(?:[ ]{2,}|\t+)url:[ \t]+(\S+)/gm)) out.add(m[1]);
  return [...out];
}

function slug(s) {
  return (
    String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'guide'
  );
}

function body(req) {
  return new Promise((resolvePromise, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(data || '{}'));
      } catch {
        reject(new Error('not json'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, obj, headers) {
  end(res, 200, JSON.stringify(obj, null, 2), { ...headers, 'content-type': 'application/json; charset=utf-8' });
}

function end(res, status, text, headers) {
  res.writeHead(status, headers);
  res.end(text);
}

function parse(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  }
  return out;
}
