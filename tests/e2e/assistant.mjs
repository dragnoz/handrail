// A small assistant for the tests and the screenshots: the contract in docs/assistant.md over node:http.
// Everything it receives is kept in memory so a test can look at it. It also answers /site/* with a
// plain page, the place a guide's steps "happen".
import { createServer } from 'node:http';

/**
 * @param {{ key?: string, name?: string, home?: boolean }} opts
 */
export async function startAssistant(opts = {}) {
  const key = opts.key ?? '';
  const state = {
    asks: [],
    notes: [],
    guides: [],
    notices: [],
    texts: {},
    authHeaders: [],
  };
  let base = '';
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', base || 'http://127.0.0.1');
    if (url.pathname.startsWith('/site/')) {
      return end(res, 200, `<!doctype html><title>Site ${url.pathname}</title><h1>Site</h1><p>${url.pathname}</p>`, 'text/html');
    }
    if (url.pathname === '/home') {
      return end(res, 200, '<!doctype html><title>Assistant home</title><h1>Assistant home</h1>', 'text/html');
    }
    state.authHeaders.push(req.headers.authorization ?? '');
    if (key && req.headers.authorization !== `Bearer ${key}`) return end(res, 401, '{"error":"key"}', 'application/json');
    if (url.pathname === '/handrail.json') {
      const card = {
        handrail: 1,
        name: opts.name ?? 'Test assistant',
        guides: 'guides.json',
        ask: 'ask',
        notes: 'notes',
        notices: 'notices.json',
      };
      if (opts.home) card.home = `${base}/home`;
      return json(res, card);
    }
    if (url.pathname === '/guides.json') return json(res, state.guides);
    if (url.pathname === '/notices.json') return json(res, state.notices);
    if (url.pathname.startsWith('/guides/')) {
      const text = state.texts[url.pathname.slice('/guides/'.length)];
      if (text == null) return end(res, 404, 'no');
      return end(res, 200, text, 'text/markdown; charset=utf-8');
    }
    if (req.method === 'POST' && url.pathname === '/ask') {
      state.asks.push(await body(req));
      return json(res, { message: 'Working on it.' });
    }
    if (req.method === 'POST' && url.pathname === '/notes') {
      state.notes.push(await body(req));
      return json(res, { message: 'Got it.' });
    }
    return end(res, 404, 'no');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  return {
    ...state,
    url: base,
    card: `${base}/handrail.json`,
    // keep-alive connections from the browser would hold close() open: drop them
    close: () =>
      new Promise((r) => {
        server.close(() => r());
        server.closeAllConnections();
      }),
  };
}

/** A guide whose steps happen on the assistant's own /site pages. */
export function siteGuide(base, id = 'site-guide', title = 'Site guide') {
  return [
    '---',
    `title: ${title}`,
    `id: ${id}`,
    'by: Test assistant',
    'for: Dragnoz',
    '---',
    'From the assistant.',
    '',
    '## 1. Start',
    '    copy: echo start',
    '## 2. On the keys page',
    `    url: ${base}/site/keys`,
    'Press the button.',
    '## 3. Finish',
    '',
  ].join('\n');
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function json(res, obj) {
  end(res, 200, JSON.stringify(obj), 'application/json');
}

function end(res, status, text, type = 'text/plain') {
  res.writeHead(status, { 'content-type': type });
  res.end(text);
}
