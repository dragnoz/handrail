// The parser is tested against the examples in docs/guide-format.md, the contract.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGuide, fromJson, toJson, slug, cleanTitle, GuideError } from '../src/lib/guide';

const doc = readFileSync(new URL('../docs/guide-format.md', import.meta.url), 'utf8');

/** The fenced block that follows `<!-- example: name -->` in the contract. */
function example(name: string): string {
  const re = new RegExp(`<!-- example: ${name} -->\\s*\\n\`\`\`\\w*\\n([\\s\\S]*?)\\n\`\`\``);
  const m = re.exec(doc);
  if (!m) throw new Error(`docs/guide-format.md has no example "${name}"`);
  return m[1]!;
}

describe('the headings example (nozlab)', () => {
  const g = parseGuide(example('nozlab'));

  it('reads the front matter', () => {
    expect(g.title).toBe('Set up the site on nozlab');
    expect(g.id).toBe('nozlab-site-setup');
    expect(g.by).toBe('Claude (NOZ)');
    expect(g.for).toBe('Dragnoz');
    expect(g.version).toBe('1');
    expect(g.sources).toEqual(['https://example.org/guides/nozlab-site-setup.md']);
  });

  it('keeps the intro', () => {
    expect(g.intro).toBe('Makes the `nozsite` user and installs the one-command key, once.');
  });

  it('finds four steps with clean titles', () => {
    expect(g.steps.map((s) => s.title)).toEqual([
      'Open a terminal on this laptop',
      'Run the setup',
      'Restart the Perseus server',
      'Publish a page',
    ]);
  });

  it('separates fields from the body', () => {
    const [s1, s2, s3, s4] = g.steps;
    expect(s1!.body).toBe('Not on Camelot: that machine holds no key for nozlab.');
    expect(s1!.copy).toEqual([]);

    expect(s2!.copy).toEqual(["ssh perseus-host 'sh /root/nozlab-site-setup.sh'"]);
    expect(s2!.expect).toBe('it ends with "nozlab-site is set up. Camelot may publish now."');
    expect(s2!.body).toBe('');

    expect(s3!.url).toEqual(['http://camelot:25895/*']);
    expect(s3!.target).toEqual(['button:has-text("Restart")']);
    expect(s3!.body).toBe('Say "restart" to Claude, or press the button on the Servers page.');

    expect(s4!.url).toEqual(['http://camelot:25895/*']);
    expect(s4!.target).toEqual(['text=🌐 Publish']);
    expect(s4!.optional).toBe(false);
  });

  it('equals the JSON example in the contract', () => {
    expect(toJson(g)).toEqual(JSON.parse(example('json')));
  });

  it('survives a round trip through JSON', () => {
    expect(fromJson(toJson(g))).toEqual(g);
  });
});

describe('the list example', () => {
  const g = parseGuide(example('list'));

  it('takes the title from the # heading and the text after it as the intro', () => {
    expect(g.title).toBe('Reset the router');
    expect(g.id).toBe('reset-the-router');
    expect(g.intro).toBe('Takes two minutes. Nothing is lost.');
  });

  it('reads the items as steps, fields and bodies', () => {
    expect(g.steps.map((s) => s.title)).toEqual(['Unplug it', 'Plug it back in', 'Check the connection']);
    expect(g.steps[0]!.body).toBe('Wait ten seconds before the next step.');
    expect(g.steps[1]!.expect).toBe('the lights come back one by one');
    expect(g.steps[1]!.body).toBe('');
    expect(g.steps[2]!.url).toEqual(['https://example.org/status']);
    expect(g.steps[2]!.optional).toBe(true);
    expect(g.steps[2]!.body).toBe('Only if the first page you open does not load.');
  });
});

describe('the rules', () => {
  it('headings win when both headings and a list appear', () => {
    const g = parseGuide('## A\n1. not a step\n2. nor this\n## B\n');
    expect(g.steps.map((s) => s.title)).toEqual(['A', 'B']);
    expect(g.steps[0]!.body).toBe('1. not a step\n2. nor this');
  });

  it('ignores headings and numbered lines inside code fences', () => {
    const g = parseGuide('## One\n```\n## not a step\n1. nor this\n```\n## Two\n');
    expect(g.steps.map((s) => s.title)).toEqual(['One', 'Two']);
    expect(g.steps[0]!.body).toBe('```\n## not a step\n1. nor this\n```');
  });

  it('drops a leading number from a title', () => {
    expect(cleanTitle('1. Open a terminal')).toBe('Open a terminal');
    expect(cleanTitle('Step 3: Publish')).toBe('Publish');
    expect(cleanTitle('2) Plug it in')).toBe('Plug it in');
    expect(cleanTitle('2026 budget')).toBe('2026 budget');
    expect(cleanTitle('3-way call')).toBe('3-way call');
  });

  it('allows blank lines before the field block', () => {
    const g = parseGuide('## A\n\n    copy: x\nBody.');
    expect(g.steps[0]!.copy).toEqual(['x']);
    expect(g.steps[0]!.body).toBe('Body.');
  });

  it('ends the field block at the first unknown key, which stays in the body', () => {
    const g = parseGuide('## A\n    copy: x\n    warning: careful\n    expect: y\n');
    expect(g.steps[0]!.copy).toEqual(['x']);
    expect(g.steps[0]!.expect).toBeUndefined();
    expect(g.steps[0]!.body).toBe('warning: careful\n    expect: y');
  });

  it('takes several url, copy and target lines', () => {
    const g = parseGuide('## A\n  url: https://a/*\n  url: https://b/*\n  copy: `one`\n  copy: two\n  target: #x\n  target: text=Go\n');
    const s = g.steps[0]!;
    expect(s.url).toEqual(['https://a/*', 'https://b/*']);
    expect(s.copy).toEqual(['one', 'two']);
    expect(s.target).toEqual(['#x', 'text=Go']);
  });

  it('reads optional as true for true, yes, on and 1', () => {
    for (const v of ['true', 'yes', 'on', '1']) {
      expect(parseGuide(`## A\n    optional: ${v}\n`).steps[0]!.optional).toBe(true);
    }
    expect(parseGuide('## A\n    optional: false\n').steps[0]!.optional).toBe(false);
  });

  it('accepts Windows line endings and a BOM', () => {
    const g = parseGuide('﻿---\r\ntitle: T\r\n---\r\n## A\r\n    copy: x\r\nBody.\r\n');
    expect(g.title).toBe('T');
    expect(g.steps[0]!.copy).toEqual(['x']);
    expect(g.steps[0]!.body).toBe('Body.');
  });

  it('reads sources as one value, a [list] or dash lines', () => {
    expect(parseGuide('---\nsources: https://a\n---\n## A\n').sources).toEqual(['https://a']);
    expect(parseGuide('---\nsources: [https://a, "https://b"]\n---\n## A\n').sources).toEqual(['https://a', 'https://b']);
    expect(parseGuide('---\nsources:\n  - https://a\n  - https://b\n---\n## A\n').sources).toEqual(['https://a', 'https://b']);
  });

  it('makes an id from the title when there is none', () => {
    expect(parseGuide('# Set up the site\n## A\n').id).toBe('set-up-the-site');
    expect(parseGuide('## Only a step\n').title).toBe('Only a step');
    expect(slug('Café: déjà vu!')).toBe('cafe-deja-vu');
    expect(slug('')).toBe('guide');
  });

  it('refuses an empty text or one without steps, in plain words', () => {
    expect(() => parseGuide('')).toThrow(GuideError);
    expect(() => parseGuide('Just a paragraph.')).toThrow(/No steps found/);
    expect(() => parseGuide('{ not json')).toThrow(/does not parse/);
    expect(() => parseGuide('{"title":"x"}')).toThrow(/no steps/);
  });

  it('reads the JSON form with strings where lists are expected', () => {
    const g = fromJson({ title: 'T', steps: [{ title: '1. A', url: 'https://a/*', copy: 'x', optional: 'yes' }] });
    expect(g.id).toBe('t');
    expect(g.steps[0]).toEqual({ title: 'A', body: '', url: ['https://a/*'], copy: ['x'], target: [], optional: true });
  });
});
