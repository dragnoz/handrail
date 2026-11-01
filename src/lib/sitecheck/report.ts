// Reports of a site check, each written for its reader: a general overview, the site's admin,
// the agency that manages the site, the hosting company. Pure text building, tested directly.
// Short on purpose: a report must survive a mailto: link.
import type { SiteReport } from './index';

export type Audience = 'overview' | 'admin' | 'agency' | 'host';

export interface ReportText {
  title: string;
  filename: string;
  text: string;
}

export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'overview', label: 'A general overview' },
  { id: 'admin', label: 'For the admin' },
  { id: 'agency', label: 'For my agency' },
  { id: 'host', label: 'For the host' },
];

const LEVEL_WORD = { good: 'looks fine', review: 'worth a look', bad: 'problem', skip: 'skipped' } as const;

/** The one-line verdict, shared with the view. */
export function verdictLine(r: SiteReport): string {
  return r.overall === 'bad'
    ? `Signs of a break-in on ${r.host}.`
    : r.overall === 'review'
      ? `Nothing broken found on ${r.host}, but a few things are worth a look.`
      : r.overall === 'skip'
        ? `Could not read ${r.host}.`
        : `No signs of a break-in found on ${r.host}.`;
}

function day(r: SiteReport): string {
  return r.time.slice(0, 10);
}

function found(r: SiteReport, level: 'bad' | 'review'): string[] {
  const out: string[] = [];
  for (const c of r.checks) {
    for (const f of c.findings) {
      if (f.level === level) out.push(`- ${c.title}: ${f.text}`);
    }
  }
  return out.slice(0, 8);
}

function findingsBlock(r: SiteReport): string {
  const bad = found(r, 'bad');
  const review = found(r, 'review');
  const parts: string[] = [];
  if (bad.length) parts.push('Problems found:', ...bad);
  if (review.length) parts.push(bad.length ? '\nWorth a look:' : 'Worth a look:', ...review);
  if (!bad.length && !review.length) parts.push('No problems found by these checks.');
  return parts.join('\n');
}

const CHECKED =
  'Checked addresses: the homepage, /wp-json/wp/v2/users, /wp-sitemap-users-1.xml, /wp-login.php — public pages, read like any visitor would.';

const LIMITS =
  'Limits: this catches the common, visible kinds of compromise. A clean result does not prove a clean server.';

function overview(r: SiteReport): string {
  const rows = r.checks.map((c) => `- ${c.title}: ${LEVEL_WORD[c.level]}`);
  return [
    `# Site check: ${r.host}`,
    `${day(r)}, read from a browser like any visitor. Nothing was sent anywhere.`,
    '',
    `Verdict: ${verdictLine(r)}`,
    '',
    ...rows,
    '',
    findingsBlock(r),
    '',
    LIMITS,
  ].join('\n');
}

function admin(r: SiteReport): string {
  const steps =
    r.overall === 'good'
      ? [
          'Nothing needs fixing from these checks. Two things still worth doing:',
          '1. Two-factor login for every admin account.',
          '2. Keep WordPress, the theme and every plugin up to date; delete the unused ones.',
        ]
      : [
          'Do these, in order:',
          '1. Lock the email account behind the site first: new password, two-step verification.',
          '2. Ask the host for a full backup now, a malware and back-door scan, and the access logs.',
          '3. Delete accounts you did not create (random-jumble names are the intruder’s).',
          '4. Remove the injected spam: widgets first, then search posts and pages.',
          '5. New passwords for every user, then log every session out.',
          '6. Update WordPress, the theme, every plugin; delete the unused ones.',
          '7. Two-factor login for every admin.',
          '8. Once clean, request a review in Google Search Console.',
        ];
  return [
    `# Site check for the admin of ${r.host}`,
    `${day(r)}. ${verdictLine(r)}`,
    '',
    findingsBlock(r),
    '',
    ...steps,
    '',
    CHECKED,
    LIMITS,
  ].join('\n');
}

function agency(r: SiteReport): string {
  const ask =
    r.overall === 'good'
      ? ['Nothing urgent was found. Please double-check the admin accounts and updates on your next visit.']
      : [
          'Please handle this for me, in this order:',
          '1. Take a full backup (files and database) before changing anything.',
          '2. Open a ticket with the host: malware and back-door scan, and the access logs.',
          '3. Remove accounts the owner did not create, and the injected spam.',
          '4. Reset every password, log all sessions out, update everything, add two-factor.',
          '',
          'When done, please send me: what the logs showed, what you removed, and confirmation that every password was reset and two-factor is on.',
        ];
  return [
    `# ${r.host}: cleanup request`,
    `A check on ${day(r)} came back: ${verdictLine(r)}`,
    '',
    findingsBlock(r),
    '',
    ...ask,
    '',
    CHECKED,
  ].join('\n');
}

function host(r: SiteReport): string {
  const bad = found(r, 'bad');
  return [
    `# ${r.host}: suspected break-in, please scan`,
    `An outside check of public pages on ${day(r)} found:`,
    '',
    bad.length ? bad.join('\n') : '- No direct signs from outside; this is a precautionary request.',
    ...(found(r, 'review').length ? ['', 'Also worth noting:', ...found(r, 'review')] : []),
    '',
    'Please:',
    '1. Take a full snapshot (files and database) now, before anything changes, to preserve evidence.',
    '2. Run a malware and back-door scan: core file integrity, mu-plugins, PHP files under uploads, wp-config, database admin users, scheduled tasks.',
    '3. Check the access logs: how and when did it start?',
    '4. Reset server-side credentials (panel, SFTP, database) and help the owner regain admin access if needed.',
    '',
    'The owner has been advised to reset passwords, remove rogue accounts and spam, update everything and add two-factor. We cannot yet confirm which of these are done; treat them as advised, not done.',
    '',
    CHECKED,
  ].join('\n');
}

export function reportFor(audience: Audience, r: SiteReport): ReportText {
  const text =
    audience === 'admin' ? admin(r) : audience === 'agency' ? agency(r) : audience === 'host' ? host(r) : overview(r);
  const title = text.slice(2, text.indexOf('\n'));
  return { title, filename: `site-check-${r.host}-${audience}.md`, text };
}
