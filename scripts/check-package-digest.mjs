import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const version = JSON.parse(readFileSync(resolve(root, 'standalone/package.json'), 'utf8')).version;
const checksumPath = resolve(root, `release/interestseed-standalone-v${version}.sha256`);
const checksum = readFileSync(checksumPath, 'utf8');
const packageDigest = checksum.match(/[a-f0-9]{64}/)?.[0];
const pageDigest = readFileSync(resolve(root, 'site/download/index.html'), 'utf8').match(/[a-f0-9]{64}/)?.[0];
const indexDigest = readFileSync(resolve(root, 'docs/releases/README.md'), 'utf8').match(/[a-f0-9]{64}/)?.[0];

const errors = [];
if (!packageDigest) errors.push(`${checksumPath}: no digest`);
if (!pageDigest) errors.push('site/download/index.html: no digest');
if (!indexDigest) errors.push('docs/releases/README.md: no digest');
if (packageDigest && pageDigest && packageDigest !== pageDigest) {
  errors.push(`package digest ${packageDigest} != page digest ${pageDigest}`);
}
if (packageDigest && indexDigest && packageDigest !== indexDigest) {
  errors.push(`package digest ${packageDigest} != release index digest ${indexDigest}`);
}
if (errors.length) {
  console.error('Package/page digest check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Package/page digest check passed: ${packageDigest}.`);
