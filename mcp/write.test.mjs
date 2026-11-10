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
    assert.equal(names.length, 10);
    assert.ok(names.includes('interestseed_capture_interest'));
    assert.ok(names.includes('interestseed_start_experiment'));
    assert.ok(names.includes('interestseed_log_experiment'));
    assert.ok(names.includes('interestseed_undo_last_capture'));
    assert.ok(names.includes('interestseed_undo_last_log'));
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
function withActiveExperiment() {
  const vault = makeVault({
    experiments: {
      schemaVersion: 1,
      experiments: [
        {
          id: 'exp_active',
          nodeId: 'a',
          state: {
            title: '摄影',
            hypothesis: '每天拍一张',
            metric: '每天记录一次',
            startedAt: '2026-01-01T00:00:00.000Z',
            targetDays: 3,
            status: 'active',
            logs: [],
          },
        },
      ],
    },
  });
  return vault;
}

test('log_experiment appends the first day', () => {
  const vault = withActiveExperiment();
  try {
    const lines = runServer(
      [call(1, 'interestseed_log_experiment', { evidence: '今天拍了楼下的树' })],
      { graphPath: vault.graphPath },
    );
    const payload = JSON.parse(lines[0].result.content[0].text);
    assert.equal(payload.id, 'exp_active');
    assert.equal(payload.status, 'active');
    assert.equal(payload.day, 2);
    assert.equal(payload.remaining, 2);
    assert.equal(payload.logs.length, 1);
    assert.equal(payload.logs[0].day, 1);
    assert.equal(payload.logs[0].evidence, '今天拍了楼下的树');
    assert.equal(payload.logs[0].interest, 3);
    assert.equal(payload.logs[0].energy, 3);
    assert.match(payload.logs[0].date, /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    vault.cleanup();
  }
});

test('log_experiment clamps scores and keeps the next step', () => {
  const vault = withActiveExperiment();
  try {
    const lines = runServer(
      [
        call(1, 'interestseed_log_experiment', {
          evidence: '今天拍了三张',
          interest: 9,
          energy: 0,
          next: '明天换一个主题',
        }),
      ],
      { graphPath: vault.graphPath },
    );
    const log = JSON.parse(lines[0].result.content[0].text).logs[0];
    assert.equal(log.interest, 5);
    assert.equal(log.energy, 1);
    assert.equal(log.next, '明天换一个主题');
  } finally {
    vault.cleanup();
  }
});

test('log_experiment rejects evidence that is too short', () => {
  const vault = withActiveExperiment();
  try {
    const lines = runServer([call(1, 'interestseed_log_experiment', { evidence: '嗯' })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /至少 4 个字/);
  } finally {
    vault.cleanup();
  }
});

test('log_experiment refuses a second entry on the same day', () => {
  const vault = withActiveExperiment();
  try {
    const lines = runServer(
      [
        call(1, 'interestseed_log_experiment', { evidence: '今天拍了楼下的树' }),
        call(2, 'interestseed_log_experiment', { evidence: '再记一次看看' }),
      ],
      { graphPath: vault.graphPath },
    );
    assert.equal(lines[1].result.isError, true);
    assert.match(lines[1].result.content[0].text, /今天已经记录过了/);
  } finally {
    vault.cleanup();
  }
});

test('log_experiment refuses an unknown experiment id', () => {
  const vault = withActiveExperiment();
  try {
    const lines = runServer(
      [call(1, 'interestseed_log_experiment', { experiment: 'exp_nope', evidence: '随便写点什么' })],
      { graphPath: vault.graphPath },
    );
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /找不到实验/);
  } finally {
    vault.cleanup();
  }
});

test('log_experiment explains when nothing is running', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_log_experiment', { evidence: '随便写点什么' })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /没有进行中的实验/);
  } finally {
    vault.cleanup();
  }
});

test('log_experiment completes the experiment on the last day', () => {
  const vault = makeVault({
    experiments: {
      schemaVersion: 1,
      experiments: [
        {
          id: 'exp_last',
          nodeId: 'a',
          state: {
            title: '摄影',
            hypothesis: '每天拍一张',
            metric: '每天记录一次',
            startedAt: '2026-01-01T00:00:00.000Z',
            targetDays: 3,
            status: 'active',
            logs: [
              { day: 1, date: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', interest: 3, energy: 3, evidence: '第一天' },
              { day: 2, date: '2026-01-02', recordedAt: '2026-01-02T00:00:00.000Z', interest: 3, energy: 3, evidence: '第二天' },
            ],
          },
        },
      ],
    },
  });
  try {
    const lines = runServer(
      [call(1, 'interestseed_log_experiment', { evidence: '第三天拍完了' })],
      { graphPath: vault.graphPath },
    );
    const payload = JSON.parse(lines[0].result.content[0].text);
    assert.equal(payload.status, 'complete');
    assert.equal(payload.remaining, 0);
    assert.equal(payload.logs.length, 3);
  } finally {
    vault.cleanup();
  }
});

test('log_experiment refuses to extend a finished experiment', () => {
  const vault = makeVault({
    experiments: {
      schemaVersion: 1,
      experiments: [
        {
          id: 'exp_done',
          nodeId: 'a',
          state: {
            title: '摄影',
            hypothesis: '每天拍一张',
            metric: '每天记录一次',
            startedAt: '2026-01-01T00:00:00.000Z',
            targetDays: 3,
            status: 'complete',
            logs: [
              { day: 1, date: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', interest: 3, energy: 3, evidence: '第一天' },
              { day: 2, date: '2026-01-02', recordedAt: '2026-01-02T00:00:00.000Z', interest: 3, energy: 3, evidence: '第二天' },
              { day: 3, date: '2026-01-03', recordedAt: '2026-01-03T00:00:00.000Z', interest: 3, energy: 3, evidence: '第三天' },
            ],
          },
        },
      ],
    },
  });
  try {
    const lines = runServer(
      [call(1, 'interestseed_log_experiment', { experiment: 'exp_done', evidence: '再记一天' })],
      { graphPath: vault.graphPath },
    );
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /3 天试跑已经完成/);
  } finally {
    vault.cleanup();
  }
});
test('undo removes the last MCP capture', () => {
  const vault = makeVault();
  try {
    const lines = runServer(
      [
        call(1, 'interestseed_capture_interest', { title: '陶艺' }),
        call(2, 'interestseed_capture_interest', { title: '木工' }),
        call(3, 'interestseed_undo_last_capture', {}),
      ],
      { graphPath: vault.graphPath },
    );
    const removed = JSON.parse(lines[2].result.content[0].text);
    assert.equal(removed.removed.title, '木工');
    const onDisk = JSON.parse(readFileSync(vault.graphPath, 'utf8'));
    const titles = onDisk.graph.nodes.map((node) => node.title);
    assert.ok(titles.includes('陶艺'));
    assert.ok(!titles.includes('木工'));
  } finally {
    vault.cleanup();
  }
});

test('undo accepts an explicit node id', () => {
  const vault = makeVault();
  try {
    const lines = runServer(
      [
        call(1, 'interestseed_capture_interest', { title: '陶艺' }),
        call(2, 'interestseed_capture_interest', { title: '木工' }),
      ],
      { graphPath: vault.graphPath },
    );
    const first = JSON.parse(lines[0].result.content[0].text);
    const lines2 = runServer([call(3, 'interestseed_undo_last_capture', { id: first.node.id })], {
      graphPath: vault.graphPath,
    });
    assert.equal(JSON.parse(lines2[0].result.content[0].text).removed.title, '陶艺');
    const onDisk = JSON.parse(readFileSync(vault.graphPath, 'utf8'));
    const titles = onDisk.graph.nodes.map((node) => node.title);
    assert.ok(titles.includes('木工'));
    assert.ok(!titles.includes('陶艺'));
  } finally {
    vault.cleanup();
  }
});

test('undo refuses a node that still has edges', () => {
  const vault = makeVault();
  try {
    const captured = JSON.parse(
      runServer([call(1, 'interestseed_capture_interest', { title: '陶艺' })], {
        graphPath: vault.graphPath,
      })[0].result.content[0].text,
    );
    const onDisk = JSON.parse(readFileSync(vault.graphPath, 'utf8'));
    onDisk.graph.edges.push({
      id: 'e9',
      source: captured.node.id,
      target: 'a',
      relation: '相关',
      origin: 'user',
      status: 'confirmed',
      createdAt: '',
      updatedAt: '',
    });
    writeFileSync(vault.graphPath, JSON.stringify(onDisk, null, 2));

    const lines = runServer([call(2, 'interestseed_undo_last_capture', { id: captured.node.id })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /还有 1 条连接/);
  } finally {
    vault.cleanup();
  }
});

test('undo refuses a node that carries an experiment', () => {
  const vault = makeVault();
  try {
    const captured = JSON.parse(
      runServer([call(1, 'interestseed_capture_interest', { title: '陶艺' })], {
        graphPath: vault.graphPath,
      })[0].result.content[0].text,
    );
    runServer([call(2, 'interestseed_start_experiment', { interest: '陶艺' })], {
      graphPath: vault.graphPath,
    });
    const lines = runServer([call(3, 'interestseed_undo_last_capture', { id: captured.node.id })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /实验/);
  } finally {
    vault.cleanup();
  }
});

test('undo refuses nodes that MCP did not create', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_undo_last_capture', { id: 'a' })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /只能撤销通过 MCP 创建的节点/);
  } finally {
    vault.cleanup();
  }
});

test('undo explains when there is nothing to undo', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_undo_last_capture', {})], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /没有可撤销的 MCP 节点/);
  } finally {
    vault.cleanup();
  }
});
test('undo_last_log removes the newest entry', () => {
  const vault = withActiveExperiment();
  try {
    const lines = runServer(
      [
        call(1, 'interestseed_log_experiment', { evidence: '今天拍了楼下的树' }),
        call(2, 'interestseed_undo_last_log', {}),
      ],
      { graphPath: vault.graphPath },
    );
    const payload = JSON.parse(lines[1].result.content[0].text);
    assert.equal(payload.removed.evidence, '今天拍了楼下的树');
    assert.equal(payload.logs.length, 0);
    assert.equal(payload.status, 'active');
    assert.equal(payload.remaining, 3);

    const file = JSON.parse(readFileSync(join(vault.dir, 'experiments.json'), 'utf8'));
    assert.equal(file.experiments[0].state.logs.length, 0);
  } finally {
    vault.cleanup();
  }
});

test('undo_last_log keeps the earlier entries', () => {
  const vault = makeVault({
    experiments: {
      schemaVersion: 1,
      experiments: [
        {
          id: 'exp_two',
          nodeId: 'a',
          state: {
            title: '摄影',
            hypothesis: '每天拍一张',
            metric: '每天记录一次',
            startedAt: '2026-01-01T00:00:00.000Z',
            targetDays: 3,
            status: 'active',
            logs: [
              { day: 1, date: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', interest: 3, energy: 3, evidence: '第一天' },
              { day: 2, date: '2026-01-02', recordedAt: '2026-01-02T00:00:00.000Z', interest: 4, energy: 5, evidence: '第二天' },
            ],
          },
        },
      ],
    },
  });
  try {
    const lines = runServer([call(1, 'interestseed_undo_last_log', { experiment: 'exp_two' })], {
      graphPath: vault.graphPath,
    });
    const payload = JSON.parse(lines[0].result.content[0].text);
    assert.equal(payload.removed.evidence, '第二天');
    assert.equal(payload.logs.length, 1);
    assert.equal(payload.logs[0].evidence, '第一天');
  } finally {
    vault.cleanup();
  }
});

test('undo_last_log reopens a completed experiment', () => {
  const vault = makeVault({
    experiments: {
      schemaVersion: 1,
      experiments: [
        {
          id: 'exp_done2',
          nodeId: 'a',
          state: {
            title: '摄影',
            hypothesis: '每天拍一张',
            metric: '每天记录一次',
            startedAt: '2026-01-01T00:00:00.000Z',
            targetDays: 3,
            status: 'complete',
            logs: [
              { day: 1, date: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', interest: 3, energy: 3, evidence: '第一天' },
              { day: 2, date: '2026-01-02', recordedAt: '2026-01-02T00:00:00.000Z', interest: 3, energy: 3, evidence: '第二天' },
              { day: 3, date: '2026-01-03', recordedAt: '2026-01-03T00:00:00.000Z', interest: 3, energy: 3, evidence: '第三天' },
            ],
          },
        },
      ],
    },
  });
  try {
    const lines = runServer([call(1, 'interestseed_undo_last_log', { experiment: 'exp_done2' })], {
      graphPath: vault.graphPath,
    });
    const payload = JSON.parse(lines[0].result.content[0].text);
    assert.equal(payload.status, 'active');
    assert.equal(payload.remaining, 1);
    assert.equal(payload.logs.length, 2);
  } finally {
    vault.cleanup();
  }
});

test('undo_last_log refuses an experiment without logs', () => {
  const vault = withActiveExperiment();
  try {
    const lines = runServer([call(1, 'interestseed_undo_last_log', {})], { graphPath: vault.graphPath });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /还没有日志/);
  } finally {
    vault.cleanup();
  }
});

test('undo_last_log refuses an unknown experiment id', () => {
  const vault = withActiveExperiment();
  try {
    const lines = runServer([call(1, 'interestseed_undo_last_log', { experiment: 'exp_nope' })], {
      graphPath: vault.graphPath,
    });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /找不到实验/);
  } finally {
    vault.cleanup();
  }
});

test('undo_last_log explains when nothing is running', () => {
  const vault = makeVault();
  try {
    const lines = runServer([call(1, 'interestseed_undo_last_log', {})], { graphPath: vault.graphPath });
    assert.equal(lines[0].result.isError, true);
    assert.match(lines[0].result.content[0].text, /没有进行中的实验/);
  } finally {
    vault.cleanup();
  }
});
