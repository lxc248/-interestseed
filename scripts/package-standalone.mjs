import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const standalone = join(root, 'standalone');
const version = JSON.parse(readFileSync(join(standalone, 'package.json'), 'utf8')).version;
const name = `interestseed-standalone-v${version}`;
const out = join(root, 'release');
const stage = join(out, name);

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(standalone, 'dist', 'cli.js'), join(stage, 'cli.js'));
cpSync(join(standalone, 'web'), join(stage, 'web'), { recursive: true });
cpSync(join(standalone, 'skill'), join(stage, 'skill'), { recursive: true });
mkdirSync(join(stage, 'mcp'), { recursive: true });
cpSync(join(root, 'mcp', 'server.mjs'), join(stage, 'mcp', 'server.mjs'));
cpSync(join(standalone, 'PACKAGED_README.md'), join(stage, 'README.md'));
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
};
walk(stage);
files.sort((a, b) =>
  relative(stage, a).split(sep).join('/').localeCompare(relative(stage, b).split(sep).join('/')),
);

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const DOS_TIME = 0;
const DOS_DATE = 0x0021;
const localParts = [];
const centralParts = [];
let offset = 0;
for (const file of files) {
  const archiveName = `${name}/${relative(stage, file).split(sep).join('/')}`;
  const source = readFileSync(file);
  const compressed = deflateRawSync(source, { level: 9 });
  const nameBytes = Buffer.from(archiveName, 'utf8');
  const crc = crc32(source);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(source.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);
  localParts.push(local, nameBytes, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0x0314, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(source.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, nameBytes);

  offset += local.length + nameBytes.length + compressed.length;
}

const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);

const zip = Buffer.concat([...localParts, ...centralParts, end]);
const zipPath = join(out, `${name}.zip`);
writeFileSync(zipPath, zip);
const hash = createHash('sha256').update(zip).digest('hex');
writeFileSync(join(out, `${name}.sha256`), `${hash}  ${name}.zip\n`, 'ascii');
console.log(zipPath);
console.log(hash);
