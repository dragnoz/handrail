// Packs each build into release/handrail-<browser>-<version>.zip, the file a store or a person installs from.
// The zip is written here, not by a system tool: Windows' Compress-Archive stores paths with
// backslashes, and Firefox then finds manifest.json but none of the files in folders.
import { deflateRawSync, crc32 } from 'node:zlib';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

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
  const files = walk(dir)
    .map((abs) => ({ abs, name: relative(dir, abs).split(sep).join('/') }))
    // manifest.json first, then the rest in a stable order
    .sort((a, b) => (a.name === 'manifest.json' ? -1 : b.name === 'manifest.json' ? 1 : a.name.localeCompare(b.name)));
  const out = resolve('release', `handrail-${browser}-${pkg.version}.zip`);
  writeFileSync(out, zip(files));
  console.log(out);
}

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) found.push(...walk(abs));
    else found.push(abs);
  }
  return found;
}

/** A plain zip: deflate, UTF-8 names with forward slashes, one fixed timestamp so builds are repeatable. */
function zip(files) {
  const { time, date } = dosTime(new Date(2026, 0, 1));
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { abs, name } of files) {
    const data = readFileSync(abs);
    const packed = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    central.writeUInt16LE(20, 6); // needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // extra, comment, disk, internal and external attributes: all zero
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}
