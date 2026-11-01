import type { Guide, Step } from './types';

/** A guide that cannot be read. The message is for the person, in plain words. */
export class GuideError extends Error {}

const KNOWN_FIELDS = new Set(['url', 'copy', 'expect', 'target', 'image', 'note', 'optional']);
const FIELD = /^(?:[ ]{2,}|\t+)([A-Za-z][\w-]*):(?:[ \t]+(.*)|[ \t]*)$/;
const H1 = /^#(?!#)[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const H2 = /^##(?!#)[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const ITEM = /^(\d+)[.)][ \t]+(.*)$/;
const BULLET = /^[-*+][ \t]+(?:\[[ xX]\][ \t]+)?(.*)$/;
const FENCE = /^[ ]{0,3}(`{3,}|~{3,})/;

/** Markdown (or the JSON form) -> a Guide. Throws GuideError when there is nothing to walk. */
export function parseGuide(text: string): Guide {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const trimmed = src.trim();
  if (!trimmed) throw new GuideError('The guide is empty.');
  if (trimmed.startsWith('{')) {
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      throw new GuideError('This looks like JSON, but it does not parse.');
    }
    return fromJson(obj);
  }

  const { meta, body } = splitFrontMatter(src);
  const isList = str(meta.kind).toLowerCase() === 'list';
  const lines = body.split('\n');
  const mode = detectMode(lines, isList);
  if (!mode) {
    throw new GuideError(
      isList
        ? 'No items found. Items are "## " headings, a numbered list, or "- " lines.'
        : 'No steps found. Steps are "## " headings or a numbered list (1. 2. 3.).',
    );
  }
  const parsed = collect(lines, mode === 'headings' ? H2 : mode === 'list' ? ITEM : BULLET, mode !== 'headings');
  const title = str(meta.title) || parsed.title || parsed.steps[0]?.title || 'Untitled guide';
  const guide: Guide = {
    id: str(meta.id) || slug(title),
    title,
    sources: list(meta.sources),
    intro: parsed.intro,
    steps: parsed.steps,
  };
  if (str(meta.by)) guide.by = str(meta.by);
  if (str(meta.for)) guide.for = str(meta.for);
  if (str(meta.version)) guide.version = str(meta.version);
  if (isList) guide.kind = 'list';
  return guide;
}

/** The JSON form -> a Guide, with every missing field filled in. */
export function fromJson(input: unknown): Guide {
  if (!input || typeof input !== 'object') throw new GuideError('The guide JSON is not an object.');
  const o = input as Record<string, unknown>;
  if (!Array.isArray(o.steps) || o.steps.length === 0) {
    throw new GuideError('The guide JSON has no steps.');
  }
  const steps: Step[] = o.steps.map((raw, i) => {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const step: Step = {
      title: cleanTitle(str(s.title) || `Step ${i + 1}`),
      body: str(s.body),
      url: list(s.url),
      copy: list(s.copy),
      target: list(s.target),
      optional: truthy(s.optional),
    };
    if (str(s.expect)) step.expect = str(s.expect);
    if (str(s.image)) step.image = str(s.image);
    if (str(s.note)) step.note = str(s.note);
    return step;
  });
  const title = str(o.title) || steps[0]?.title || 'Untitled guide';
  const guide: Guide = {
    id: str(o.id) || slug(title),
    title,
    sources: list(o.sources),
    intro: str(o.intro),
    steps,
  };
  if (str(o.by)) guide.by = str(o.by);
  if (str(o.for)) guide.for = str(o.for);
  if (str(o.version)) guide.version = str(o.version);
  if (str(o.kind).toLowerCase() === 'list') guide.kind = 'list';
  return guide;
}

/** A Guide -> the JSON form (a plain object, safe to stringify). */
export function toJson(guide: Guide): Record<string, unknown> {
  return JSON.parse(JSON.stringify(guide)) as Record<string, unknown>;
}

/** A stable id from a title: lowercase, ascii, dashes. */
export function slug(title: string): string {
  const s = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s || 'guide';
}

/** "1. Open a terminal" -> "Open a terminal"; "Step 3: Publish" -> "Publish". */
export function cleanTitle(title: string): string {
  return title.replace(/^(?:step[ \t]+)?\d+[ \t]*[.):-][ \t]+/i, '').trim();
}

// ---------------------------------------------------------------- internals

type Meta = Record<string, string | string[]>;

function splitFrontMatter(src: string): { meta: Meta; body: string } {
  const lines = src.split('\n');
  if ((lines[0] ?? '').trim() !== '---') return { meta: {}, body: src };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return { meta: {}, body: src };
  return { meta: parseYamlish(lines.slice(1, end)), body: lines.slice(end + 1).join('\n') };
}

/** The small YAML we accept: `key: value` (quoted or not), `key: [a, b]`, and `key:` followed by `- item` lines. */
function parseYamlish(lines: string[]): Meta {
  const meta: Meta = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = (m[2] ?? '').trim();
    if (value === '') {
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1] ?? '')) {
        items.push(unquote((lines[i + 1] ?? '').replace(/^\s*-\s+/, '')));
        i++;
      }
      meta[key] = items;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      meta[key] = value
        .slice(1, -1)
        .split(',')
        .map((v) => unquote(v))
        .filter(Boolean);
    } else {
      meta[key] = unquote(value);
    }
  }
  return meta;
}

function unquote(v: string): string {
  const t = v.trim();
  const dq = t.startsWith('"') && t.endsWith('"');
  const sq = t.startsWith("'") && t.endsWith("'");
  return t.length >= 2 && (dq || sq) ? t.slice(1, -1) : t;
}

/** Which lines are the steps. Bullets count only in a list (`kind: list`). */
function detectMode(lines: string[], bullets: boolean): 'headings' | 'list' | 'bullets' | null {
  let fence = false;
  let hasList = false;
  let hasBullet = false;
  for (const line of lines) {
    if (FENCE.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (H2.test(line)) return 'headings';
    if (ITEM.test(line)) hasList = true;
    else if (BULLET.test(line)) hasBullet = true;
  }
  return hasList ? 'list' : bullets && hasBullet ? 'bullets' : null;
}

interface Parsed {
  title?: string;
  intro: string;
  steps: Step[];
}

interface Raw {
  title: string;
  lines: string[];
}

/** Walk the lines; `marker` opens a step. Lines before the first step are the intro. */
function collect(lines: string[], marker: RegExp, dedentBody: boolean): Parsed {
  let title: string | undefined;
  const intro: string[] = [];
  const raws: Raw[] = [];
  let cur: Raw | null = null;
  let fence = false;
  for (const line of lines) {
    if (FENCE.test(line)) fence = !fence;
    else if (!fence) {
      const m = marker.exec(line);
      if (m) {
        if (cur) raws.push(cur);
        cur = { title: (m[m.length - 1] ?? '').trim(), lines: [] };
        continue;
      }
      if (!cur && title === undefined) {
        const h = H1.exec(line);
        if (h) {
          title = h[1]!.trim();
          continue;
        }
      }
    }
    (cur ? cur.lines : intro).push(line);
  }
  if (cur) raws.push(cur);
  const parsed: Parsed = {
    intro: intro.join('\n').trim(),
    steps: raws.map((r) => buildStep(r, dedentBody)),
  };
  if (title !== undefined) parsed.title = title;
  return parsed;
}

/** Fields are the indented `key: value` lines right under the step's title; the rest is the body. */
function buildStep(raw: Raw, dedentBody: boolean): Step {
  const step: Step = {
    title: cleanTitle(raw.title),
    body: '',
    url: [],
    copy: [],
    target: [],
    optional: false,
  };
  let i = 0;
  while (i < raw.lines.length && !(raw.lines[i] ?? '').trim()) i++;
  while (i < raw.lines.length) {
    const m = FIELD.exec(raw.lines[i] ?? '');
    if (!m) break;
    const key = m[1]!.toLowerCase();
    if (!KNOWN_FIELDS.has(key)) break;
    applyField(step, key, (m[2] ?? '').trim());
    i++;
  }
  let rest = raw.lines.slice(i);
  if (dedentBody) rest = dedent(rest);
  step.body = rest.join('\n').trim();
  return step;
}

function applyField(step: Step, key: string, value: string): void {
  switch (key) {
    case 'url':
      if (value) step.url.push(value);
      break;
    case 'copy':
      if (value) step.copy.push(stripTicks(value));
      break;
    case 'target':
      if (value) step.target.push(value);
      break;
    case 'expect':
      if (value) step.expect = value;
      break;
    case 'image':
      if (value) step.image = value;
      break;
    case 'note':
      if (value) step.note = value;
      break;
    case 'optional':
      step.optional = truthy(value);
      break;
  }
}

function stripTicks(v: string): string {
  const m = /^`(.*)`$/.exec(v);
  return m ? m[1]! : v;
}

function dedent(lines: string[]): string[] {
  let min = Infinity;
  for (const l of lines) {
    if (!l.trim()) continue;
    const n = /^[ \t]*/.exec(l)![0].length;
    if (n < min) min = n;
  }
  if (!isFinite(min) || min === 0) return lines;
  return lines.map((l) => (l.trim() ? l.slice(min) : ''));
}

function truthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return /^(true|yes|on|1)$/i.test(String(v ?? '').trim());
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function list(v: unknown): string[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => String(x).trim()).filter(Boolean);
}
