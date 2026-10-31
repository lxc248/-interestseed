import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { slugifyFileName } from '../../src/utils/paths';

export interface CaptureInput {
  text: string;
  url?: string;
  title?: string;
}

export interface CaptureResult {
  path: string;
  title: string;
}

const INBOX = 'InterestSeed/Inbox';

export async function captureToVault(
  vaultPath: string,
  input: CaptureInput,
): Promise<CaptureResult> {
  const text = input.text.trim();
  if (!text) throw new Error('Nothing to capture.');
  const title = (input.title?.trim() || firstLine(text) || '未命名收藏').slice(0, 120);
  const date = new Date().toISOString().slice(0, 10);
  const name = `${date}-${slugifyFileName(title).slice(0, 60) || 'capture'}.md`;
  const dir = join(vaultPath, INBOX);
  await mkdir(dir, { recursive: true });
  const path = join(dir, name);
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    'type: document',
    'tags: [inbox]',
    ...(input.url ? [`source: ${JSON.stringify(input.url)}`] : []),
    `capturedAt: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
    text,
    '',
  ].join('\n');
  await writeFile(path, frontmatter, 'utf8');
  return { path: `${INBOX}/${name}`, title };
}

function firstLine(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?.slice(0, 120) ?? '';
}
