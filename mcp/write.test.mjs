/* global process, URL */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('./server.mjs', import.meta.url));

function makeVault({ envelope = true, experiments = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'interestseed-mcp-write-'));
  const graphPath = join(dir, 'state.json');
  const graph = {
    nodes: [
      { id: 'a', type: 'topic', title: '摄影', tags: [], createdAt: '', updatedAt: '', metadata: {} },
    ],
    edges: [],
  };
  const payload = envelope
    ? { schemaVersion: 2, updatedAt: '2026-01-01T00:00:00.000Z', graph }
    : graph;
  writeFileSync(graphPath, JSON.stringify(payload, null, 2));
  if (experiments) {
    writeFileSync(join(dir, 'experiments.json'), JSON.stringify(experiments, null, 2));
  }
  return { dir, graphPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function runServer(input, { graphPath, write = true, minimal = false } = {}) {
  const result = execFileSync(
    process.execPath,
    [server, '--graph', graphPath, ...(write ? ['--write'] : []), ...(minimal ? ['--minimal'] : [])],
    { input: input.join('\n'), encoding: 'utf8', windowsHide: true },
  );
  return result
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const call = (id, name, args = {}) =>
  JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

test('write tools are absent unless --write is passed', () => {
  const vault = makeVault();
  try {
    const lines = runServer([JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })], {
      graphPath: vault.graphPath,
      write: false,
    });
    const names = lines[0].result.tools.map((tool) => tool.name);
    assert.equal(names.length, 5);
    assert.ok(!names.includes('interestseed_capture_interest'));
  } finally {
    vault.cleanup();
  }
});

test('write tools appear with --write', () => {
  const vault = makeVault();
  try {
    const lines = runServer([JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })], {
      graphPath: vault.graphPath,
    });
    const names = lines[0].result.tools.map((tool) => tool.name);
    assert.equal(names.length, 7);
    assert.ok(names.includes('interestseed_capture_interest'));
    assert.ok(names.includes('interestseed_start_experiment'));
  } finally {
    vault.cleanup();
  }
});

test('minimal mode never exposes write tools', () => {
  const vault = makeVault();
  try {
    const lines = runServer([JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })], {
      graphPath: vault.graphPath,
      minimal: true,
    });
    assert.equal(lines[0].result.tools.length, 2);
  } finally {
    vault.cleanup();
  }
});

test('calling a write tool without --write is refused', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_capture_interest', { title: '陶艺' })], {
      graphPath: vault.graphPath,
      write: false,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /写入未开启/);
  } finally {
    vault.cleanup();
  }
});

test('capture creates a node and keeps the envelope', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_capture_interest', { title: '陶艺', tags: ['手作'] })], {
      graphPath: vault.graphPath,
    });
    const payload = JSON.parse(lines[0].result.content[0].text);
    assert.equal(payload.created, true);
    assert.equal(payload.node.title, '陶艺');
    assert.equal(payload.node.type, 'topic');

    const onDisk = JSON.parse(readFileSync(vault.graphPath, 'utf8'));
    assert.equal(onDisk.schemaVersion, 2, 'envelope must survive the write');
    assert.ok(onDisk.graph.nodes.some((node) => node.title === '陶艺'));
    assert.ok(Array.isArray(onDisk.graph.edges));
  } finally {
    vault.cleanup();
  }
});

test('capture is idempotent for the same title', () => {
  const vault = makeVault();
  try {
    const lines = runServer(
      [
        call(1, 'interestseed_capture_interest', { title: '陶艺' }),
        call(2, 'interestseed_capture_interest', { title: '  陶艺  ' }),
      ],
      { graphPath: vault.graphPath },
    );
    const first = JSON.parse(lines[0].result.content[0].text);
    const second = JSON.parse(lines[1].result.content[0].text);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.node.id, first.node.id);
    const onDisk = JSON.parse(readFileSync(vault.graphPath, 'utf8'));
    assert.equal(onDisk.graph.nodes.filter((node) => node.title === '陶艺').length, 1);
  } finally {
    vault.cleanup();
  }
});

test('capture derives the node type from the URL', () => {
  const vault = makeVault();
  try {
    const lines = runServer(
      [call(1, 'interestseed_capture_interest', { title: '一个视频', url: 'https://www.douyin.com/video/123' })],
      { graphPath: vault.graphPath },
    );
    const payload = JSON.parse(lines[0].result.content[0].text);
    assert.equal(payload.node.type, 'video');
    const onDisk = JSON.parse(readFileSync(vault.graphPath, 'utf8'));
    const stored = onDisk.graph.nodes.find((node) => node.title === '一个视频');
    assert.equal(stored.metadata.sourceUrl, 'https://www.douyin.com/video/123');
    assert.equal(stored.metadata.capturedVia, 'mcp');
  } finally {
    vault.cleanup();
  }
});

test('capture rejects an empty title', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_capture_interest', { title: '   ' })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /title/);
  } finally {
    vault.cleanup();
  }
});

test('capture leaves a rollback copy next to the graph', () => {
  const vault = makeVault();
  try {
    runServer([call(1, 'interestseed_capture_interest', { title: '陶艺' })], { graphPath: vault.graphPath });
    assert.ok(existsSync(`${vault.graphPath}.bak`));
    const backup = JSON.parse(readFileSync(`${vault.graphPath}.bak`, 'utf8'));
    assert.ok(!backup.graph.nodes.some((node) => node.title === '陶艺'), 'backup holds the pre-write state');
  } finally {
    vault.cleanup();
  }
});

test('start_experiment writes a compatible experiments file', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_start_experiment', { interest: '摄影' })], {
      graphPath: vault.graphPath,
    });
    const experiment = JSON.parse(lines[0].result.content[0].text);
    assert.equal(experiment.nodeId, 'a');
    assert.equal(experiment.state.status, 'active');
    assert.equal(experiment.state.targetDays, 3);
    assert.equal(experiment.state.logs.length, 0);

    const file = JSON.parse(readFileSync(join(vault.dir, 'experiments.json'), 'utf8'));
    assert.equal(file.schemaVersion, 1);
    assert.equal(file.experiments.length, 1);
    assert.equal(file.experiments[0].id, experiment.id);
  } finally {
    vault.cleanup();
  }
});

test('start_experiment accepts a custom hypothesis and day count', () => {
  const vault = makeVault();
  try {
    const lines = runServer(
      [
        call(1, 'interestseed_start_experiment', {
          interest: '摄影',
          hypothesis: '连续一周每天拍一张',
          days: 7,
        }),
      ],
      { graphPath: vault.graphPath },
    );
    const experiment = JSON.parse(lines[0].result.content[0].text);
    assert.equal(experiment.state.targetDays, 7);
    assert.equal(experiment.state.hypothesis, '连续一周每天拍一张');
  } finally {
    vault.cleanup();
  }
});

test('start_experiment refuses an unknown interest', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_start_experiment', { interest: '不存在' })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /找不到兴趣/);
  } finally {
    vault.cleanup();
  }
});

test('start_experiment keeps the one-active-experiment rule', () => {
  const vault = makeVault({
    experiments: {
      schemaVersion: 1,
      experiments: [
        { id: 'exp_existing', nodeId: 'a', state: { title: '摄影', status: 'active', targetDays: 3, logs: [] } },
      ],
    },
  });
  try {
    const lines = runServer([call(1, 'interestseed_start_experiment', { interest: '摄影' })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /exp_existing/);
  } finally {
    vault.cleanup();
  }
});

test('start_experiment explains why the plugin layout is not writable', () => {
  const vault = makeVault({ envelope: false });
  try {
    const lines = runServer([call(1, 'interestseed_start_experiment', { interest: '摄影' })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /插件图谱/);
  } finally {
    vault.cleanup();
  }
});
