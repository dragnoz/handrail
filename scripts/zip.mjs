// Packs each build into release/handrail-<browser>-<version>.zip, the file a store or a person installs from.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const builds = [
  ['chrome', 'dist'],
  ['firefox', 'dist-firefox'],
];
mkdirSync('release', { recursive: true });

for (const [browser, dir] of builds) {
  if (!existsSync(`${dir}/manifest.json`)) {
    console.error(`${dir}/ is missing. Run "pnpm build" first.`);
    process.exit(1);
  }
  const out = resolve('release', `handrail-${browser}-${pkg.version}.zip`);
  rmSync(out, { force: true });
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path ${dir}\\* -DestinationPath '${out}'"`, {
      stdio: 'inherit',
    });
  } else {
    execSync(`cd ${dir} && zip -qr "${out}" .`, { stdio: 'inherit' });
  }
  console.log(out);
}
