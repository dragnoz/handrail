// A note never carries a key. This is a guard, not a guarantee: it catches the common shapes.

const KNOWN = [
  /^(?:sk|pk|rk)[-_](?:live|test|proj|ant|or)?[-_]?[A-Za-z0-9_-]{8,}$/, // sk-… style API keys
  /^(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{8,}$/, // GitHub tokens
  /^xox[abpr]-[A-Za-z0-9-]{8,}$/, // Slack
  /^AKIA[0-9A-Z]{12,}$/, // AWS access key id
  /^AIza[0-9A-Za-z_-]{20,}$/, // Google API key
  /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*$/, // a JWT
  /^glpat-[A-Za-z0-9_-]{16,}$/, // GitLab
];

/**
 * Returns what the text looks like when it seems to hold a key, password or token; null when it looks fine.
 * Addresses (anything with `://`) are left alone.
 */
export function looksLikeKey(text: string): string | null {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) return 'a private key';
  if (/\b(?:password|passwd|passphrase|secret|api[ _-]?key|access[ _-]?token|bearer)\b\s*[:=]\s*\S{4,}/i.test(text)) {
    return 'a password or key written after its name';
  }
  for (const raw of text.split(/\s+/)) {
    const t = raw.replace(/^[("'`<[{]+|[)"'`>\]}.,;:!?]+$/g, '');
    if (t.length < 16 || t.includes('://')) continue;
    if (KNOWN.some((re) => re.test(t))) return 'a key';
    // A long run of letters and digits in both cases, with nothing word-like about it.
    if (
      t.length >= 24 &&
      /^[A-Za-z0-9_\-+/=]+$/.test(t) &&
      /[a-z]/.test(t) &&
      /[A-Z]/.test(t) &&
      /[0-9]/.test(t) &&
      !/^[A-Za-z]+[-_][A-Za-z]+/.test(t)
    ) {
      return 'a key or token';
    }
  }
  return null;
}
