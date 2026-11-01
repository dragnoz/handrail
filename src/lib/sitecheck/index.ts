// Checks a site for the visible signs of a break-in: hidden off-screen spam, spam wording,
// scripts from unexpected places, machine-made account names, a tampered login.
// The analyzers are pure functions over text, so the tests feed them text directly.

export type Level = 'good' | 'review' | 'bad' | 'skip';

export interface Finding {
  level: 'bad' | 'review' | 'note';
  text: string;
}

export interface CheckResult {
  id: 'homepage' | 'users' | 'sitemap' | 'login';
  title: string;
  level: Level;
  findings: Finding[];
}

export interface SiteReport {
  host: string;
  time: string;
  overall: Level;
  wordpress: boolean;
  checks: CheckResult[];
}

/** What a probe of one address came back with. Null when the network said no. */
export interface Probe {
  status: number;
  text: string;
  /** The address after redirects. */
  url: string;
}

export type ProbeFn = (path: string) => Promise<Probe | null>;

// Wording that has no business on most sites. One hit is a problem.
const SPAM_STRONG =
  /\b(1xbet|viagra|cialis|xanax|casinos?|online slots?|payday loans?|judi bola|link alternatif)\b/gi;
// Wording that can be innocent; several distinct hits are worth a look.
const SPAM_WEAK = /\b(apuestas|wetten|gokken|roulette|blackjack|betrouwbare casino|slot gacor)\b/gi;
// The off-screen trick: content pushed far outside the viewport, for search engines only.
const CLOAK = /position\s*:\s*absolute\s*;?\s*(?:left|top)\s*:\s*-\d{3,}px/gi;
const INDENT = /text-indent\s*:\s*-\d{4,}px/gi;

// Script hosts that are everyday tools. Everything else gets pointed out, not condemned.
const KNOWN_SCRIPT_HOSTS = [
  'google.com', 'gstatic.com', 'googleapis.com', 'googletagmanager.com', 'google-analytics.com',
  'googlesyndication.com', 'youtube.com', 'ytimg.com', 'facebook.net', 'facebook.com', 'fbcdn.net',
  'instagram.com', 'linkedin.com', 'twitter.com', 'cloudflare.com', 'cloudflareinsights.com',
  'jsdelivr.net', 'unpkg.com', 'jquery.com', 'wp.com', 'wordpress.com', 'gravatar.com',
  'stripe.com', 'paypal.com', 'hotjar.com', 'clarity.ms', 'msgsndr.com', 'leadconnectorhq.com',
  'convertkit.com', 'mailchimp.com', 'list-manage.com', 'hs-scripts.com', 'hubspot.com',
  'typekit.net', 'fontawesome.com', 'recaptcha.net', 'vimeo.com', 'wistia.com', 'calendly.com',
  'intercom.io', 'crisp.chat', 'tawk.to', 'plausible.io', 'matomo.cloud', 'newrelic.com',
  'sentry.io', 'usefathom.com', 'statcounter.com',
];

function hostKnown(host: string, siteHost: string): boolean {
  const h = host.toLowerCase();
  if (h === siteHost || h.endsWith('.' + siteHost)) return true;
  return KNOWN_SCRIPT_HOSTS.some((k) => h === k || h.endsWith('.' + k));
}

/** True for account names that look machine-made: long, letters-and-digits mash, almost no vowels. */
export function looksRandom(name: string): boolean {
  const s = (name || '').toLowerCase();
  if (s.length < 16 || !/^[a-z0-9]+$/.test(s) || !/[0-9]/.test(s)) return false;
  const vowels = (s.match(/[aeiou]/g) ?? []).length;
  return vowels / s.length < 0.28;
}

function uniq(list: string[]): string[] {
  return [...new Set(list.map((s) => s.toLowerCase()))];
}

/** Looks through a page's HTML for hidden spam, spam wording and scripts from odd places. */
export function analyzeHomepage(html: string, siteHost: string): Finding[] {
  const out: Finding[] = [];

  const cloaked = html.match(CLOAK);
  if (cloaked) {
    out.push({
      level: 'bad',
      text: `Content pushed off-screen ${cloaked.length} time(s) (for example "${cloaked[0]}"). Visitors never see it; search engines do. This is how injected spam hides.`,
    });
  }
  if (INDENT.test(html)) {
    out.push({ level: 'review', text: 'Text pulled off-screen with text-indent. Sometimes styling, sometimes hidden spam.' });
  }

  const strong = html.match(SPAM_STRONG);
  if (strong) {
    out.push({
      level: 'bad',
      text: `Spam wording on the page: ${uniq(strong).slice(0, 6).join(', ')} (${strong.length} hit(s)). If this site is not about gambling or medicine, it should not be there.`,
    });
  } else {
    const weak = html.match(SPAM_WEAK);
    if (weak && uniq(weak).length >= 2) {
      out.push({ level: 'review', text: `Possible spam wording: ${uniq(weak).slice(0, 4).join(', ')}.` });
    }
  }

  const refresh = /<meta[^>]+http-equiv=["']?refresh[^>]*>/i.exec(html);
  if (refresh && /url\s*=\s*["']?https?:\/\//i.test(refresh[0]) && !refresh[0].toLowerCase().includes(siteHost)) {
    out.push({ level: 'bad', text: 'The page tells the browser to move on to a different website.' });
  }

  const hosts: string[] = [];
  const re = /<script[^>]+src=["']https?:\/\/([^/"']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) hosts.push(m[1]!);
  const strange = uniq(hosts).filter((h) => !hostKnown(h, siteHost));
  if (strange.length) {
    out.push({
      level: 'review',
      text: `Scripts load from: ${strange.slice(0, 5).join(', ')}. Often legitimate tools; make sure you know each one.`,
    });
  }

  const gen = /<meta name=["']generator["'] content=["']([^"']+)/i.exec(html);
  if (gen) out.push({ level: 'note', text: `The page names its software: ${gen[1]}. Consider hiding that.` });

  return out;
}

/** Reads the public user list (JSON, or whatever the page said). */
export function analyzeUsers(text: string): { findings: Finding[]; closed: boolean } {
  const names: string[] = [];
  let parsedAsError = false;
  try {
    const j: unknown = JSON.parse(text);
    if (Array.isArray(j)) {
      for (const u of j) {
        const slug = (u as { slug?: unknown })?.slug;
        if (typeof slug === 'string') names.push(slug);
      }
    } else if (j && typeof j === 'object' && 'code' in (j as object)) {
      parsedAsError = true;
    }
  } catch {
    if (/rest_no_route|rest_cannot_access|rest_user_cannot_view|not found/i.test(text)) parsedAsError = true;
  }
  if (parsedAsError || (!names.length && !text.trim().startsWith('['))) {
    return { findings: [{ level: 'note', text: 'The user list is closed to outsiders. That is how it should be.' }], closed: true };
  }
  return { findings: nameFindings(names, 'The user list is open to anyone'), closed: false };
}

/** Reads an author sitemap for account names. */
export function analyzeSitemap(xml: string): { findings: Finding[]; closed: boolean } {
  const names: string[] = [];
  const re = /\/author\/([^/<"]+)\//gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) names.push(decodeURIComponent(m[1]!));
  if (!names.length) {
    return { findings: [{ level: 'note', text: 'No author names exposed there. Good.' }], closed: true };
  }
  return { findings: nameFindings(names, 'Author names are public'), closed: false };
}

function nameFindings(names: string[], openLine: string): Finding[] {
  const out: Finding[] = [];
  const flagged = uniq(names).filter(looksRandom);
  if (flagged.length) {
    out.push({
      level: 'bad',
      text: `Machine-made account name(s): ${flagged.join(', ')}. Intruders hide behind names like this. If you did not create it, treat the site as broken into.`,
    });
  }
  if (names.length) {
    out.push({
      level: flagged.length ? 'note' : 'review',
      text: `${openLine}: ${uniq(names).slice(0, 10).join(', ')}${names.length > 10 ? '…' : ''}. Do you recognise every name? Hiding this list is good practice.`,
    });
  }
  return out;
}

function levelOf(findings: Finding[]): Level {
  if (findings.some((f) => f.level === 'bad')) return 'bad';
  if (findings.some((f) => f.level === 'review')) return 'review';
  return 'good';
}

/** Runs every check against one site. The probe function does the fetching, so tests can stub it. */
export async function runSiteCheck(host: string, probe: ProbeFn): Promise<SiteReport> {
  const checks: CheckResult[] = [];

  // 1. The homepage.
  const home = await probe('/');
  let wordpress = false;
  if (!home) {
    checks.push({
      id: 'homepage', title: 'The page itself', level: 'skip',
      findings: [{ level: 'note', text: 'Could not read the site. Is the address right, and the site up?' }],
    });
  } else {
    wordpress = /wp-content|wp-includes/i.test(home.text);
    const findings = analyzeHomepage(home.text, host);
    if (!findings.length) findings.push({ level: 'note', text: 'No hidden spam, spam wording, or odd scripts found.' });
    checks.push({ id: 'homepage', title: 'The page itself', level: levelOf(findings), findings });
  }

  // The remaining checks are WordPress doors.
  if (home && !wordpress) {
    const note: Finding = { level: 'note', text: 'This does not look like a WordPress site, so this check does not apply.' };
    checks.push({ id: 'users', title: 'The user list', level: 'skip', findings: [note] });
    checks.push({ id: 'sitemap', title: 'The author sitemap', level: 'skip', findings: [note] });
    checks.push({ id: 'login', title: 'The login page', level: 'skip', findings: [note] });
  } else {
    // 2. The public user list.
    const users = await probe('/wp-json/wp/v2/users?per_page=100');
    if (!users) {
      checks.push({ id: 'users', title: 'The user list', level: 'skip', findings: [{ level: 'note', text: 'Could not be read.' }] });
    } else if (users.status >= 400) {
      checks.push({
        id: 'users', title: 'The user list', level: 'good',
        findings: [{ level: 'note', text: 'Closed to outsiders. That is how it should be.' }],
      });
    } else {
      const r = analyzeUsers(users.text);
      checks.push({ id: 'users', title: 'The user list', level: r.closed ? 'good' : levelOf(r.findings), findings: r.findings });
    }

    // 3. The author sitemap.
    const map = await probe('/wp-sitemap-users-1.xml');
    if (!map || map.status >= 400) {
      checks.push({
        id: 'sitemap', title: 'The author sitemap', level: 'good',
        findings: [{ level: 'note', text: 'Not exposed. Good.' }],
      });
    } else {
      const r = analyzeSitemap(map.text);
      checks.push({ id: 'sitemap', title: 'The author sitemap', level: r.closed ? 'good' : levelOf(r.findings), findings: r.findings });
    }

    // 4. The login page: does it stay on this site?
    const login = await probe('/wp-login.php');
    if (!login) {
      checks.push({ id: 'login', title: 'The login page', level: 'skip', findings: [{ level: 'note', text: 'Could not be read.' }] });
    } else {
      let loginHost = host;
      try { loginHost = new URL(login.url).host.replace(/^www\./, ''); } catch { /* keep */ }
      const findings: Finding[] = [];
      if (loginHost !== host.replace(/^www\./, '')) {
        findings.push({ level: 'bad', text: `The login hands you to a different website (${loginHost}). A strong sign the sign-in was tampered with.` });
      } else if (login.status === 403 || /just a moment|challenge/i.test(login.text)) {
        findings.push({ level: 'note', text: 'The login sits behind a security check. That is protection, not a problem.' });
      } else {
        findings.push({ level: 'note', text: 'The login stays on this site.' });
      }
      checks.push({ id: 'login', title: 'The login page', level: levelOf(findings), findings });
    }
  }

  const levels = checks.map((c) => c.level);
  const overall: Level = levels.includes('bad') ? 'bad'
    : levels.includes('review') ? 'review'
    : levels.every((l) => l === 'skip') ? 'skip' : 'good';

  return { host, time: new Date().toISOString(), overall, wordpress, checks };
}
