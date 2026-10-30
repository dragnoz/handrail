import { describe, expect, it } from 'vitest';
import { urlMatches, whereAmI, parseGuide } from '../src/lib/guide';

describe('urlMatches', () => {
  it('matches a pattern with * anywhere', () => {
    expect(urlMatches('http://camelot:25895/*', 'http://camelot:25895/boards/edu')).toBe(true);
    expect(urlMatches('http://camelot:25895/*', 'http://camelot:25895/')).toBe(true);
    expect(urlMatches('http://camelot:25895/*', 'http://camelot:25896/')).toBe(false);
    expect(urlMatches('https://*.example.org/*', 'https://docs.example.org/a?b=c')).toBe(true);
    expect(urlMatches('https://*.example.org/*', 'https://example.org/a')).toBe(false);
    expect(urlMatches('*://example.org/*', 'http://example.org/x')).toBe(true);
  });

  it('matches a plain address exactly, ignoring fragment, trailing slash and case', () => {
    expect(urlMatches('https://example.org/status', 'https://example.org/status')).toBe(true);
    expect(urlMatches('https://example.org/status', 'https://example.org/status/#top')).toBe(true);
    expect(urlMatches('https://example.org/status', 'HTTPS://Example.org/Status')).toBe(true);
    expect(urlMatches('https://example.org/status', 'https://example.org/status/2')).toBe(false);
    expect(urlMatches('https://example.org/status', 'https://example.org/status?x=1')).toBe(false);
    expect(urlMatches('https://example.org/', 'https://example.org')).toBe(true);
  });

  it('matches nothing when either side is empty', () => {
    expect(urlMatches('', 'https://example.org')).toBe(false);
    expect(urlMatches('https://example.org', '')).toBe(false);
  });

  it('treats regex characters in a pattern as plain text', () => {
    expect(urlMatches('https://example.org/a.b?c=(d)*', 'https://example.org/a.b?c=(d)&e')).toBe(true);
    expect(urlMatches('https://example.org/a.b*', 'https://example.org/aXb')).toBe(false);
  });
});

describe('whereAmI', () => {
  const guide = parseGuide(
    [
      '## One',
      '## Two',
      '    url: https://two.example/*',
      '## Three',
      '    url: https://three.example/*',
      '## Four',
      '    url: https://three.example/*',
      '',
    ].join('\n'),
  );

  it('offers the first later step that matches the tab', () => {
    expect(whereAmI(guide, 0, 'https://three.example/page')).toBe(2);
    expect(whereAmI(guide, 0, 'https://two.example/')).toBe(1);
  });

  it('stays quiet when the current step matches', () => {
    expect(whereAmI(guide, 2, 'https://three.example/page')).toBe(null);
  });

  it('does not look back', () => {
    expect(whereAmI(guide, 2, 'https://two.example/')).toBe(null);
  });

  it('stays quiet with no tab, no match, or past the end', () => {
    expect(whereAmI(guide, 0, undefined)).toBe(null);
    expect(whereAmI(guide, 0, 'https://else.example/')).toBe(null);
    expect(whereAmI(guide, 4, 'https://three.example/')).toBe(null);
  });
});
