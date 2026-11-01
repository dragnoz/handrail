import { describe, expect, it } from 'vitest';
import {
  analyzeHomepage,
  analyzeSitemap,
  analyzeUsers,
  looksRandom,
  runSiteCheck,
  type Probe,
} from '../src/lib/sitecheck';
import { cleanupGuideFor } from '../src/lib/sitecheck/guide';
import { AUDIENCES, reportFor, verdictLine } from '../src/lib/sitecheck/report';
import { parseGuide } from '../src/lib/guide';

const HOST = 'example.org';

const CLEAN_PAGE = `<!doctype html><html><head>
<script src="https://example.org/wp-content/themes/plain/app.js"></script>
<script src="https://www.googletagmanager.com/gtag.js"></script>
</head><body><p>Plain pages about moving house.</p><link href="/wp-content/x.css"></body></html>`;

const CLOAKED_PAGE = `<html><body>
<div id="block-8" class="widget widget_block">
<div style="position: absolute; left: -17308px;">Want gaming? <a href="https://spam.example.net">casino</a></div>
<div style="position: absolute; left: -15808px;">link alternatif time</div>
</div>
<p>wp-content theme page</p></body></html>`;

describe('looksRandom', () => {
  it('flags a long letters-and-digits mash with few vowels', () => {
    expect(looksRandom('zwlnmi9lwnacwxozlbsybmbhscpz1wp6654')).toBe(true);
  });
  it('leaves ordinary names alone', () => {
    expect(looksRandom('kate-austin')).toBe(false);
    expect(looksRandom('dragnoz')).toBe(false);
    expect(looksRandom('alison2024')).toBe(false); // short
    expect(looksRandom('marketing-team-account')).toBe(false); // hyphens, words
  });
});

describe('analyzeHomepage', () => {
  it('finds nothing wrong with a clean page', () => {
    const f = analyzeHomepage(CLEAN_PAGE, HOST);
    expect(f.filter((x) => x.level === 'bad')).toHaveLength(0);
    expect(f.filter((x) => x.level === 'review')).toHaveLength(0);
  });
  it('spots off-screen blocks and spam wording', () => {
    const f = analyzeHomepage(CLOAKED_PAGE, HOST);
    const bad = f.filter((x) => x.level === 'bad').map((x) => x.text);
    expect(bad.some((t) => t.includes('off-screen'))).toBe(true);
    expect(bad.find((t) => t.includes('off-screen'))).toContain('left: -17308px');
    expect(bad.some((t) => t.includes('casino') || t.includes('link alternatif'))).toBe(true);
  });
  it('points out scripts from unknown places without condemning them', () => {
    const page = `<script src="https://cdn.odd-widgets.example.net/x.js"></script> wp-content`;
    const f = analyzeHomepage(page, HOST);
    const review = f.filter((x) => x.level === 'review');
    expect(review).toHaveLength(1);
    expect(review[0]!.text).toContain('odd-widgets');
  });
  it('notes a generator tag', () => {
    const f = analyzeHomepage(`<meta name="generator" content="WordPress 7.0.8" /> wp-content`, HOST);
    expect(f.some((x) => x.level === 'note' && x.text.includes('WordPress 7.0.8'))).toBe(true);
  });
});

describe('analyzeUsers', () => {
  it('reads a user list and flags the machine-made name', () => {
    const json = JSON.stringify([
      { slug: 'kate-austin' },
      { slug: 'zwlnmi9lwnacwxozlbsybmbhscpz1wp6654' },
    ]);
    const r = analyzeUsers(json);
    expect(r.closed).toBe(false);
    expect(r.findings.some((f) => f.level === 'bad' && f.text.includes('zwlnmi9'))).toBe(true);
  });
  it('treats an open but ordinary list as worth a look, not a problem', () => {
    const r = analyzeUsers(JSON.stringify([{ slug: 'kate-austin' }, { slug: 'sam' }]));
    expect(r.findings.some((f) => f.level === 'bad')).toBe(false);
    expect(r.findings.some((f) => f.level === 'review')).toBe(true);
  });
  it('recognises a closed list', () => {
    const r = analyzeUsers('{"code":"rest_no_route","message":"No route was found","data":{"status":404}}');
    expect(r.closed).toBe(true);
  });
});

describe('analyzeSitemap', () => {
  it('reads author addresses and flags machine-made ones', () => {
    const xml = `<urlset><url><loc>https://example.org/author/kate-austin/</loc></url>
<url><loc>https://example.org/author/zwlnmi9lwnacwxozlbsybmbhscpz1wp6654/</loc></url></urlset>`;
    const r = analyzeSitemap(xml);
    expect(r.closed).toBe(false);
    expect(r.findings.some((f) => f.level === 'bad')).toBe(true);
  });
  it('treats no author addresses as closed', () => {
    expect(analyzeSitemap('<urlset></urlset>').closed).toBe(true);
  });
});

describe('runSiteCheck', () => {
  const stub =
    (answers: Record<string, Probe | null>) =>
    async (path: string): Promise<Probe | null> =>
      answers[path] ?? { status: 404, text: 'not found', url: `https://${HOST}${path}` };

  it('comes back bad for a cloaked site with an intruder account', async () => {
    const report = await runSiteCheck(
      HOST,
      stub({
        '/': { status: 200, text: CLOAKED_PAGE, url: `https://${HOST}/` },
        '/wp-json/wp/v2/users?per_page=100': {
          status: 200,
          text: JSON.stringify([{ slug: 'zwlnmi9lwnacwxozlbsybmbhscpz1wp6654' }]),
          url: `https://${HOST}/wp-json/wp/v2/users?per_page=100`,
        },
        '/wp-login.php': { status: 200, text: '<form>log in</form>', url: `https://${HOST}/wp-login.php` },
      }),
    );
    expect(report.overall).toBe('bad');
    expect(report.wordpress).toBe(true);
    expect(report.checks.find((c) => c.id === 'homepage')?.level).toBe('bad');
    expect(report.checks.find((c) => c.id === 'users')?.level).toBe('bad');
    expect(report.checks.find((c) => c.id === 'login')?.level).toBe('good');
  });

  it('comes back good for a clean, closed-up site', async () => {
    const report = await runSiteCheck(
      HOST,
      stub({
        '/': { status: 200, text: CLEAN_PAGE, url: `https://${HOST}/` },
        '/wp-login.php': { status: 403, text: 'Just a moment', url: `https://${HOST}/wp-login.php` },
      }),
    );
    expect(report.overall).toBe('good');
  });

  it('calls a login that lands on another site a problem', async () => {
    const report = await runSiteCheck(
      HOST,
      stub({
        '/': { status: 200, text: CLEAN_PAGE, url: `https://${HOST}/` },
        '/wp-login.php': { status: 200, text: 'welcome', url: 'https://somewhere-else.example.net/lander' },
      }),
    );
    expect(report.checks.find((c) => c.id === 'login')?.level).toBe('bad');
    expect(report.overall).toBe('bad');
  });

  it('skips the WordPress doors on a site that is not WordPress', async () => {
    const report = await runSiteCheck(
      HOST,
      stub({ '/': { status: 200, text: '<html><body>a plain site</body></html>', url: `https://${HOST}/` } }),
    );
    expect(report.wordpress).toBe(false);
    expect(report.checks.find((c) => c.id === 'users')?.level).toBe('skip');
  });
});

describe('cleanupGuideFor', () => {
  it('writes a guide the parser accepts, aimed at the one site', () => {
    const guide = parseGuide(cleanupGuideFor('example.org'));
    expect(guide.id).toBe('clean-example.org');
    expect(guide.steps.length).toBe(9);
    expect(guide.steps.some((s) => s.url.some((u) => u.includes('https://example.org/wp-admin')))).toBe(true);
    const last = guide.steps[guide.steps.length - 1]!;
    expect(last.optional).toBe(true);
  });
});

// ---- reports

describe('reportFor', () => {
  const answer =
    (answers: Record<string, Probe | null>) =>
    async (path: string): Promise<Probe | null> =>
      answers[path] ?? { status: 404, text: 'not found', url: `https://${HOST}${path}` };

  async function badReport() {
    return runSiteCheck(
      HOST,
      answer({
        '/': { status: 200, text: CLOAKED_PAGE, url: `https://${HOST}/` },
        '/wp-json/wp/v2/users?per_page=100': {
          status: 200,
          text: JSON.stringify([{ slug: 'zwlnmi9lwnacwxozlbsybmbhscpz1wp6654' }]),
          url: `https://${HOST}/wp-json/wp/v2/users?per_page=100`,
        },
        '/wp-login.php': { status: 200, text: '<form>log in</form>', url: `https://${HOST}/wp-login.php` },
      }),
    );
  }

  it('writes all four reports, each short enough for a mail link', async () => {
    const report = await badReport();
    for (const a of AUDIENCES) {
      const rep = reportFor(a.id, report);
      expect(rep.text).toContain(HOST);
      expect(rep.filename).toBe(`site-check-${HOST}-${a.id}.md`);
      expect(rep.text.length).toBeLessThan(1900);
    }
  });

  it('tells the host what was advised but not confirmed', async () => {
    const rep = reportFor('host', await badReport());
    expect(rep.text).toContain('advised, not done');
    expect(rep.text).toContain('snapshot');
  });

  it('asks the agency to act and report back', async () => {
    const rep = reportFor('agency', await badReport());
    expect(rep.text).toContain('handle this for me');
    expect(rep.text).toContain('two-factor is on');
  });

  it('keeps the overview calm on a clean site', async () => {
    const report = await runSiteCheck(
      HOST,
      answer({
        '/': { status: 200, text: CLEAN_PAGE, url: `https://${HOST}/` },
        '/wp-login.php': { status: 403, text: 'Just a moment', url: `https://${HOST}/wp-login.php` },
      }),
    );
    expect(verdictLine(report)).toContain('No signs of a break-in');
    expect(reportFor('overview', report).text).toContain('No problems found');
  });
});
