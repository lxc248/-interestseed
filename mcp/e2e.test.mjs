/* global process, URL, setTimeout, clearTimeout, fetch */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cross-tool integration over the HTTP transport.
 *
 * The unit suites cover each tool in isolation; this one proves they compose:
 * a single server process, nine tools, one vault, and the files still valid at
 * the end. It is the only place where envelope preservation, backups and the
 * one-active-experiment rule are exercised together.
 */

const serverPath = fileURLToPath(new URL('./server.mjs', import.meta.url));
const TOKEN = 'e2e-token-abcdef';

const dir = mkdtempSync(join(tmpdir(), 'interestseed-mcp-e2e-'));
const graphPath = join(dir, 'state.json');
writeFileSync(
  graphPath,
  JSON.stringify(
    {
      schemaVersion: 2,
      updatedAt: '2026-01-01T00:00:00.000Z',
      graph: {
        nodes: [
          { id: 'seed1', type: 'topic', title: '写作', tags: [], createdAt: '', updatedAt: '', metadata: {} },
        ],
        edges: [],
      },
    },
    null,
    2,
  ),
);

const child = spawn(
  process.execPath,
  [serverPath, '--http', '0', '--write', '--graph', graphPath, '--token', TOKEN],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);

let baseUrl = '';
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('server never listened')), 10000);
  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    const line = stdout.split('\n').find((entry) => entry.trim().startsWith('{'));
    if (!line) return;
    clearTimeout(timer);
    baseUrl = JSON.parse(line).url;
    resolve();
  });
  child.on('error', reject);
});

test.after(() => {
  child.kill();
  rmSync(dir, { recursive: true, force: true });
});

let rpcId = 0;
async function rpc(method, params) {
  rpcId += 1;
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId, method, params }),
  });
  return res.json();
}

async function tool(name, args = {}) {
  const body = await rpc('tools/call', { name, arguments: args });
  const text = body.result?.content?.[0]?.text ?? '';
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { isError: body.result?.isError === true, payload };
}

test('every write tool composes in one session', async () => {
  const init = await rpc('initialize', {});
  assert.equal(init.result.protocolVersion, '2026-07-28');

  const list = await rpc('tools/list', {});
  assert.equal(list.result.tools.length, 11);

  const capture = await tool('interestseed_capture_interest', {
    title: '陶艺',
    url: 'https://www.douyin.com/video/1',
  });
  assert.equal(capture.payload.created, true);
  assert.equal(capture.payload.node.type, 'video');

  const again = await tool('interestseed_capture_interest', { title: '陶艺' });
  assert.equal(again.payload.created, false, 'capture must stay idempotent');

  const started = await tool('interestseed_start_experiment', { interest: '陶艺', days: 3 });
  assert.equal(started.payload.state.status, 'active');
  assert.equal(started.payload.state.targetDays, 3);

  const secondStart = await tool('interestseed_start_experiment', { interest: '写作' });
  assert.equal(secondStart.isError, true, 'only one experiment may be active');

  const logged = await tool('interestseed_log_experiment', { evidence: '今天捏了一个杯子' });
  assert.equal(logged.payload.logs.length, 1);
  assert.equal(logged.payload.remaining, 2);

  const dupLog = await tool('interestseed_log_experiment', { evidence: '再来一条' });
  assert.equal(dupLog.isError, true, 'one log per local day');

  const undone = await tool('interestseed_undo_last_log', {});
  assert.equal(undone.payload.logs.length, 0);
  assert.equal(undone.payload.status, 'active');

  const csv = 'title,url\n手冲咖啡,https://www.bilibili.com/video/BV1aa\n构图基础,https://www.xiaohongshu.com/explore/65ab';
  const dry = await tool('interestseed_import_favorites', { text: csv, dryRun: true });
  assert.equal(dry.payload.created, 2);
  assert.equal(dry.payload.dryRun, true);

  const imported = await tool('interestseed_import_favorites', { text: csv });
  assert.equal(imported.payload.created, 2);
  assert.equal(imported.payload.format, 'csv');

  const reimport = await tool('interestseed_import_favorites', { text: csv });
  assert.equal(reimport.payload.created, 0);
  assert.equal(reimport.payload.skipped, 2);

  const removed = await tool('interestseed_undo_last_capture', {});
  assert.equal(removed.payload.removed.title, '构图基础');

  const refused = await tool('interestseed_undo_last_capture', { id: 'seed1' });
  assert.equal(refused.isError, true, 'nodes MCP did not create are off limits');

  const resource = await rpc('resources/read', { uri: 'interestseed://graph' });
  assert.equal(typeof resource.result.contents[0].text, 'string');
});

test('the vault stays consistent after mixed writes', () => {
  const onDisk = JSON.parse(readFileSync(graphPath, 'utf8'));
  assert.equal(onDisk.schemaVersion, 2, 'envelope preserved across nine tool calls');
  assert.deepEqual(
    onDisk.graph.nodes.map((node) => node.title).sort(),
    ['写作', '手冲咖啡', '陶艺'].sort(),
  );
  assert.ok(existsSync(`${graphPath}.bak`), 'graph backup written');

  const experiments = JSON.parse(readFileSync(join(dir, 'experiments.json'), 'utf8'));
  assert.equal(experiments.schemaVersion, 1);
  assert.equal(experiments.experiments.length, 1);
  assert.equal(experiments.experiments[0].state.logs.length, 0, 'the undone log is not persisted');
  assert.ok(existsSync(join(dir, 'experiments.json.bak')), 'experiments backup written');
});
