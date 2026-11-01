// The build, plus permission for the test origins. Chrome shows a prompt for an optional host permission,
// which a headless test cannot press; a build that already holds the origin gets no prompt. 127.0.0.1 is
// the test servers; example.org is the site the site check test answers itself. Only the test copy carries
// them; the real build asks, as the README says.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Copies dist/ to dist-test/ with the test origin granted. Returns the folder. */
export function distForTests() {
  const src = resolve('dist');
  const out = resolve('dist-test');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(src, out, { recursive: true });
  const manifestPath = resolve(out, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = ['http://127.0.0.1/*', 'https://example.org/*'];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return out;
}
