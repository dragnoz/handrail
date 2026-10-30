// Packs dist/ into release/handrail-chrome-<version>.zip, the file a store or a person installs from.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!existsSync('dist/manifest.json')) {
  console.error('dist/ is missing. Run "pnpm build" first.');
  process.exit(1);
}
mkdirSync('release', { recursive: true });
const out = resolve('release', `handrail-chrome-${pkg.version}.zip`);
rmSync(out, { force: true });

if (process.platform === 'win32') {
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path dist\\* -DestinationPath '${out}'"`, { stdio: 'inherit' });
} else {
  execSync(`cd dist && zip -qr "${out}" .`, { stdio: 'inherit' });
}
console.log(out);
