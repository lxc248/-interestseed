import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const version = JSON.parse(await readFile(resolve(root, 'standalone/package.json'), 'utf8')).version;

const checks = [
  ['README.md', `latest-${version}`],
  ['README.md', `interestseed-standalone-v${version}.zip`],
  ['README.en.md', `latest-${version}`],
  ['README.en.md', `interestseed-standalone-v${version}.zip`],
  ['standalone/PACKAGED_README.md', `# InterestSeed Standalone ${version}`],
  ['mcp/server.mjs', `version: '${version}'`],
  ['site/index.html', `InterestSeed ${version}`],
  ['site/download/index.html', `InterestSeed Standalone ${version}`],
  ['site/download/index.html', `interestseed-standalone-v${version}.zip`],
  ['docs/releases/README.md', `InterestSeed Standalone ${version}`],
  ['docs/releases/README.md', `interestseed-standalone-v${version}.zip`],
];

const errors = [];
for (const [file, needle] of checks) {
  const text = await readFile(resolve(root, file), 'utf8');
  if (!text.includes(needle)) errors.push(`${file}: missing \"${needle}\"`);
}
if (!existsSync(resolve(root, `RELEASE_NOTES_STANDALONE_${version}.md`))) {
  errors.push(`missing RELEASE_NOTES_STANDALONE_${version}.md`);
}

if (errors.length > 0) {
  console.error(`Version check failed for ${version}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Version check passed: all release references point at ${version}.`);
}
