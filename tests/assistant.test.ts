// The assistant contract is tested against the examples in docs/assistant.md, the contract.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseCard,
  parseFeed,
  parseNotices,
  parseReply,
  looksLikeKey,
  newCount,
  guideForPage,
  noteText,
  mailtoFor,
  AssistantError,
  type Assistant,
  type NotePayload,
} from '../src/lib/assistant';

const doc = readFileSync(new URL('../docs/assistant.md', import.meta.url), 'utf8');

/** The fenced block that follows `<!-- example: name -->` in the contract. */
function example(name: string): string {
  const re = new RegExp(`<!-- example: ${name} -->\\s*\\n\`\`\`\\w*\\n([\\s\\S]*?)\\n\`\`\``);
  const m = re.exec(doc);
  if (!m) throw new Error(`docs/assistant.md has no example "${name}"`);
  return m[1]!;
}

const ADDRESS = 'https://example.org/assistant/handrail.json';

describe('the card', () => {
  const card = parseCard(JSON.parse(example('card')), ADDRESS);

  it('reads the name and resolves relative parts against its own address', () => {
    expect(card.name).toBe('Example assistant');
    expect(card.guides).toBe('https://example.org/assistant/guides.json');
    expect(card.ask).toBe('https://example.org/assistant/ask');
    expect(card.notes).toBe('https://example.org/assistant/notes');
    expect(card.notices).toBe('https://example.org/assistant/notices.json');
    expect(card.home).toBe('https://example.org/');
  });

  it('accepts a card with a name only', () => {
    expect(parseCard({ handrail: 1, name: 'Bare' }, ADDRESS)).toEqual({ name: 'Bare' });
  });

  it('refuses what is not a card, in plain words', () => {
    expect(() => parseCard({ name: 'x' }, ADDRESS)).toThrow(/does not answer as a Handrail assistant/);
    expect(() => parseCard('text', ADDRESS)).toThrow(AssistantError);
    expect(() => parseCard({ handrail: 1 }, ADDRESS)).toThrow(/has no name/);
    expect(() => parseCard({ handrail: 1, name: 'x', ask: 'ftp://x/y' }, ADDRESS)).toThrow(/"ask" address/);
  });
});

describe('the guides list', () => {
  const list = parseFeed(JSON.parse(example('guides')), 'https://example.org/assistant/guides.json');

  it('reads id, title, url, updated, for and pages', () => {
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      id: 'add-deploy-key',
      title: 'Add a deploy key to a repository',
      url: 'https://example.org/assistant/guides/add-deploy-key.md',
      updated: '2026-10-30T10:00:00Z',
      for: 'Dragnoz',
      pages: ['https://git.example.org/*'],
    });
    expect(list[1]!.pages).toEqual([]);
  });

  it('takes a {guides: [...]} object too, and drops lines without id, title or url', () => {
    const out = parseFeed({ guides: [{ id: 'a', title: 'A', url: 'a.md' }, { id: 'b' }, 'junk'] }, 'https://h/x/f.json');
    expect(out.map((g) => g.id)).toEqual(['a']);
    expect(out[0]!.url).toBe('https://h/x/a.md');
  });

  it('refuses something that is not a list', () => {
    expect(() => parseFeed({ nope: 1 }, 'https://h/f.json')).toThrow(/not a list/);
  });
});

describe('the notices list', () => {
  const list = parseNotices(JSON.parse(example('notices')), 'https://example.org/assistant/notices.json');

  it('reads id, text, guide, url and time', () => {
    expect(list[0]).toEqual({
      id: 'n-41',
      text: 'Your guide is ready: Add a deploy key to a repository.',
      guide: 'https://example.org/assistant/guides/add-deploy-key.md',
      time: '2026-10-30T10:01:00Z',
    });
    expect(list[1]!.url).toBe('https://example.org/inbox/');
  });
});

describe('asks and notes', () => {
  it('match the shapes in the contract', () => {
    const ask = JSON.parse(example('ask'));
    expect(ask.handrail).toBe(1);
    expect(typeof ask.text).toBe('string');
    expect(ask.page.url).toMatch(/^https:/);
    const note = JSON.parse(example('note')) as NotePayload;
    expect(note.handrail).toBe(1);
    expect(note.step).toBe(2);
    expect(noteText(note)).toContain('# Add a deploy key to a repository, step 2: Make the key');
    expect(mailtoFor(note)).toMatch(/^mailto:\?subject=Handrail%3A%20Add%20a%20deploy%20key/);
  });

  it('reads a reply, and nothing from a reply that is not an object', () => {
    expect(parseReply(JSON.parse(example('reply')), 'https://example.org/assistant/ask')).toEqual({
      message: 'Working on it. Give me five minutes.',
      guide: 'https://example.org/assistant/guides/instagram-api.md',
    });
    expect(parseReply('ok', 'https://h/')).toEqual({});
    expect(parseReply(null, 'https://h/')).toEqual({});
  });
});

describe('the key guard', () => {
  it('lets ordinary notes through', () => {
    for (const t of [
      'done, but the button was called Create key',
      'the page said 404 at https://git.example.org/settings/keys',
      'deploy_key.pub was written to ~/.ssh',
      'commit 3f2a9c1 is on main',
      'Error: ENOENT: no such file or directory',
      'the-long-option-name-with-dashes-and-more-dashes',
    ]) {
      expect(looksLikeKey(t), t).toBeNull();
    }
  });

  it('stops what looks like a key, a token or a password', () => {
    expect(looksLikeKey('here is the key sk-proj-AbCdEf0123456789XyZ')).toBe('a key');
    expect(looksLikeKey('token ghp_ABCDEFghijkl0123456789MNOP')).toBe('a key');
    expect(looksLikeKey('password: hunter2hunter2')).toBe('a password or key written after its name');
    expect(looksLikeKey('-----BEGIN OPENSSH PRIVATE KEY-----\nabc')).toBe('a private key');
    expect(looksLikeKey('it printed Q7mZp2Lk9vR4tX1nB8cD5fG0hJ3s')).toBe('a key or token');
    expect(looksLikeKey('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123')).toBe('a key');
  });
});

describe('counts and the offer for a page', () => {
  const a: Assistant = {
    id: 'a1',
    address: 'https://example.org/assistant/handrail.json',
    card: { name: 'Example assistant' },
    added: '2026-10-30T09:00:00Z',
    guides: parseFeed(JSON.parse(example('guides')), 'https://example.org/assistant/guides.json'),
    notices: parseNotices(JSON.parse(example('notices')), 'https://example.org/assistant/notices.json'),
    seenGuides: ['reset-the-router'],
    seenNotices: [],
  };

  it('counts what has not been looked at', () => {
    expect(newCount(a)).toEqual({ guides: 1, notices: 2 });
    expect(newCount({ ...a, seenGuides: ['add-deploy-key', 'reset-the-router'], seenNotices: ['n-41', 'n-42'] })).toEqual({
      guides: 0,
      notices: 0,
    });
  });

  it('offers the guide whose pages match the tab, and nothing otherwise', () => {
    expect(guideForPage([a], 'https://git.example.org/me/repo/settings/keys')?.entry.id).toBe('add-deploy-key');
    expect(guideForPage([a], 'https://example.com/')).toBeNull();
    expect(guideForPage([a], undefined)).toBeNull();
  });
});
