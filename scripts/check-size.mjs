import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MAX_TRACKED_BYTES = 40 * 1024 * 1024;
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

let total = 0;
const largest = [];
for (const path of files) {
  try {
    const size = statSync(join(root, path)).size;
    total += size;
    largest.push({ path, size });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

largest.sort((a, b) => b.size - a.size);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
if (total > MAX_TRACKED_BYTES) {
  console.error(`Tracked tree ${mb(total)} exceeds the ${mb(MAX_TRACKED_BYTES)} budget.`);
  for (const entry of largest.slice(0, 10)) console.error(`  ${mb(entry.size)}  ${entry.path}`);
  process.exit(1);
}
console.log(`Tracked tree check passed: ${mb(total)} / ${mb(MAX_TRACKED_BYTES)}.`);
