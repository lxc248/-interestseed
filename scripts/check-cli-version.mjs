import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const expected = JSON.parse(readFileSync(join(root, 'standalone', 'package.json'), 'utf8')).version;
const cli = join(root, 'standalone', 'dist', 'cli.js');
for (const args of [['version'], ['--version']]) {
  const actual = execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' }).trim();
  if (actual !== expected) {
    console.error(`CLI ${args.join(' ')} returned ${actual}, expected ${expected}.`);
    process.exit(1);
  }
}
console.log(`CLI version check passed: ${expected}.`);
