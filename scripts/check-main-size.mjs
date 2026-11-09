import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const file = resolve(root, 'src/main.ts');
const lines = readFileSync(file, 'utf8').split(/\r?\n/).length;
const limit = Number(process.env.MAIN_LINE_LIMIT ?? 1700);
if (lines > limit) {
  console.error(`src/main.ts is ${lines} lines; keep it under ${limit}. Extract more helpers.`);
  process.exit(1);
}
console.log(`src/main.ts is ${lines} lines (limit ${limit}).`);
