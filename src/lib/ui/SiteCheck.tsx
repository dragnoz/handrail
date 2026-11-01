import { useEffect, useState } from 'preact/hooks';
import { runSiteCheck, type Level, type SiteReport } from '../sitecheck';
import { cleanupGuideFor } from '../sitecheck/guide';
import { AUDIENCES, reportFor, verdictLine, type Audience } from '../sitecheck/report';
import { download } from '../destinations';
import { parseGuide } from '../guide';
import { freshProgress, now, saveGuide, setProgress, type State } from '../store';
import { fetchProbe, openHere, requestOrigin } from '../ext';
import { message, type ActiveTab } from './hooks';
import { toast } from './toast';

interface Props {
  state: State;
  tab: ActiveTab;
  onBack: () => void;
  onOpen: (id: string) => void;
}

/** One site address, or nothing. */
function hostOf(raw: string | undefined): string {
  const t = (raw ?? '').trim().toLowerCase();
  if (!t) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/.test(t) ? t : `https://${t}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(u.hostname) ? u.hostname : '';
  } catch {
    return '';
  }
}

const LEVEL_WORD: Record<Level, string> = { good: 'looks fine', review: 'worth a look', bad: 'problem', skip: 'skipped' };

/**
 * Site check: reads a site the way any visitor could and looks for the visible signs of a
 * break-in. Runs only when the button is pressed, on the one origin it asked for.
 */
export function SiteCheck({ state, tab, onBack, onOpen }: Props) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SiteReport | null>(null);
  const [aud, setAud] = useState<Audience | null>(null);

  // The box follows the tab until the person types their own address.
  useEffect(() => {
    if (!touched) setText(hostOf(tab.url));
  }, [tab.url, touched]);

  async function run(): Promise<void> {
    const host = hostOf(text);
    if (!host) {
      setError('Type a site address, like example.org.');
      return;
    }
    try {
      // First thing, so the browser still counts the permission prompt as the person's click.
      await requestOrigin(`https://${host}/`);
    } catch (e) {
      setError(message(e));
      return;
    }
    setBusy(true);
    setError('');
    setReport(null);
    setAud(null);
    try {
      setReport(await runSiteCheck(host, (path) => fetchProbe(`https://${host}${path}`)));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function walkCleanup(): Promise<void> {
    if (!report) return;
    const raw = cleanupGuideFor(report.host);
    const guide = parseGuide(raw);
    await saveGuide({ guide, raw, source: { kind: 'check', url: `https://${report.host}/` }, added: now(), updated: now() });
    if (!state.progress[guide.id]) await setProgress(guide.id, freshProgress());
    toast('Cleanup guide added');
    onOpen(guide.id);
  }

  async function sendReport(how: 'copy' | 'file' | 'mail'): Promise<void> {
    if (!report || !aud) return;
    const rep = reportFor(aud, report);
    try {
      if (how === 'copy') {
        await navigator.clipboard.writeText(rep.text);
        toast('Copied');
      } else if (how === 'file') {
        download(rep.filename, rep.text, 'text/markdown');
        toast(`Saved as ${rep.filename}`);
      } else {
        const href = `mailto:?subject=${encodeURIComponent(rep.title)}&body=${encodeURIComponent(rep.text)}`;
        if (href.length > 1900) {
          await navigator.clipboard.writeText(rep.text);
          toast('Too long for a mail link; copied instead — paste it into the mail.');
          return;
        }
        const a = document.createElement('a');
        a.href = href;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('Handed to your mail program');
      }
    } catch {
      toast('Could not do that.');
    }
  }

  return (
    <div class="view">
      <header class="top">
        <button class="btn btn-quiet" onClick={onBack} aria-label="Back" title="Back">
          ←
        </button>
        <div class="brand">
          <span>Site check</span>
        </div>
      </header>

      <p class="hint">
        Reads a site the way any visitor could, and looks for the visible signs of a break-in: hidden
        off-screen spam, spam wording, scripts from odd places, machine-made account names, a login that
        leaves the site. It asks for that one site, reads four public addresses there, and sends nothing anywhere.
      </p>

      <div class="add-row">
        <input
          class="sc-host"
          type="text"
          value={text}
          placeholder="example.org"
          spellcheck={false}
          onInput={(e) => {
            setTouched(true);
            setText((e.target as HTMLInputElement).value);
          }}
          aria-label="The site to check"
        />
        <button class="btn btn-primary" onClick={() => void run()} disabled={busy}>
          {busy ? 'Checking…' : 'Check this site'}
        </button>
      </div>
      {error && <p class="error">{error}</p>}

      {report && (
        <>
          <div class={`sc-verdict ${report.overall}`} role="status">
            {verdictLine(report)}
          </div>

          {report.checks.map((c) => (
            <div class="card sc-check" key={c.id}>
              <div class="sc-check-head">
                <b>{c.title}</b>
                <span class={`sc-chip ${c.level}`}>{LEVEL_WORD[c.level]}</span>
              </div>
              <ul class="sc-findings">
                {c.findings.map((f, i) => (
                  <li key={i} class={f.level}>
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {(report.overall === 'bad' || report.overall === 'review') && (
            <button class="btn btn-primary" onClick={() => void walkCleanup()}>
              Walk me through the cleanup
            </button>
          )}

          <div class="sc-also">
            <span>Two checks only you can do:</span>
            <button
              class="link"
              onClick={() =>
                void openHere(
                  `https://www.google.com/search?q=${encodeURIComponent(`site:${report.host} casino OR viagra OR 1xbet`)}`,
                )
              }
            >
              what Google shows for this site
            </button>
            <span>, and on your phone, open the site from a Google search: some infections redirect only there.</span>
          </div>

          <div class="card sc-report">
            <b>Send a report</b>
            <p class="hint">The same findings, written for the reader you pick. Nothing is sent until you choose where.</p>
            <div class="sc-aud">
              {AUDIENCES.map((a) => (
                <button key={a.id} class={aud === a.id ? 'btn btn-primary' : 'btn'} onClick={() => setAud(a.id)}>
                  {a.label}
                </button>
              ))}
            </div>
            {aud && (
              <>
                <textarea class="sc-preview" readOnly value={reportFor(aud, report).text} aria-label="The report" />
                <div class="add-row">
                  <button class="btn" onClick={() => void sendReport('copy')}>
                    Copy
                  </button>
                  <button class="btn" onClick={() => void sendReport('file')}>
                    Save as a file
                  </button>
                  <button class="btn" onClick={() => void sendReport('mail')}>
                    Email it
                  </button>
                </div>
              </>
            )}
          </div>

          <p class="hint">
            Honest limits: this catches the common, visible kinds of compromise. A clean result does not
            prove a clean server; your host can scan the files themselves.
          </p>
        </>
      )}
    </div>
  );
}
