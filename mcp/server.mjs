#!/usr/bin/env node
/* global process */
/**
 * InterestSeed read-only MCP server.
 *
 * This server never writes to the vault. It only exposes a local graph snapshot
 * to an MCP client (Claude Desktop, Cursor, DSH, etc.).
 *
 * Usage:
 *   node mcp/server.mjs --graph "<vault>/.obsidian/plugins/interestseed/graphs/default.json"
 *   INTERESTSEED_GRAPH=... node mcp/server.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROTOCOL_VERSION = '2024-11-05';
const args = process.argv.slice(2);
const graphArgIndex = args.indexOf('--graph');
const graphPath = resolve(
  process.env.INTERESTSEED_GRAPH ||
    (graphArgIndex >= 0 ? args[graphArgIndex + 1] : '') ||
    resolve(process.cwd(), '.obsidian/plugins/interestseed/graphs/default.json'),
);

function readGraph() {
  const raw = readFileSync(graphPath, 'utf8');
  const graph = JSON.parse(raw);
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('图谱文件缺少 nodes / edges');
  }
  return graph;
}

function degreeMap(graph) {
  const degrees = new Map();
  for (const node of graph.nodes) degrees.set(node.id, 0);
  for (const edge of graph.edges) {
    if (edge.status === 'rejected') continue;
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

function taskState(node, degree) {
  const state = ['captured', 'judged', 'connected', 'experimenting', 'reviewed'].includes(
    node.metadata?.taskState,
  )
    ? node.metadata.taskState
    : null;
  if (state === 'experimenting' || state === 'reviewed') return state;
  if (node.metadata?.nextStep === true) return 'experimenting';
  if (degree > 0) return 'connected';
  return state ?? 'captured';
}

function publicNode(node, degree) {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    tags: node.tags ?? [],
    degree,
    taskState: taskState(node, degree),
    source: node.metadata?.contextSource,
    sourceRef: node.metadata?.contextSourceRef,
    summary: typeof node.metadata?.summary === 'string' ? node.metadata.summary : undefined,
    spark: node.metadata?.spark === true || undefined,
  };
}

function summarize(graph) {
  const degrees = degreeMap(graph);
  const nodes = graph.nodes.map((node) => publicNode(node, degrees.get(node.id) ?? 0));
  const orphans = nodes.filter((node) => node.degree === 0 && !isExperimentNode(node.id, graph));
  return {
    nodes: nodes.length,
    edges: graph.edges.filter((edge) => edge.status !== 'rejected').length,
    orphans: orphans.length,
    themes: [...new Set(nodes.flatMap((node) => node.tags))].slice(0, 12),
  };
}

function isExperimentNode(id, graph) {
  const node = graph.nodes.find((candidate) => candidate.id === id);
  return node?.metadata?.nextStep === true;
}

function getExperiment(graph) {
  const node = graph.nodes.find((candidate) => candidate.metadata?.nextStep === true);
  if (!node) return null;
  const raw = node.metadata?.experimentState;
  const logs = Array.isArray(raw?.logs) ? raw.logs : [];
  const targetDays = Number(raw?.targetDays) || 7;
  return {
    title: node.title,
    status: raw?.status === 'complete' ? 'complete' : 'active',
    targetDays,
    logs: logs.map((log) => ({
      day: log.day,
      date: log.date,
      interest: log.interest,
      energy: log.energy,
      evidence: log.evidence,
      next: log.next,
    })),
    canRecordToday: raw?.status !== 'complete' && logs.length < targetDays,
  };
}

function nextStep(graph) {
  const degrees = degreeMap(graph);
  const sparks = graph.nodes.filter(
    (node) => node.metadata?.spark === true && (degrees.get(node.id) ?? 0) === 0,
  );
  const isolated = graph.nodes.filter(
    (node) =>
      (degrees.get(node.id) ?? 0) === 0 && node.metadata?.nextStep !== true,
  );
  const experiment = getExperiment(graph);
  if (sparks.length > 0) {
    return {
      action: 'process_spark',
      title: `还有 ${sparks.length} 个火花待判断`,
      target: { id: sparks[0].id, title: sparks[0].title },
      detail: '先判断它和哪个兴趣有关；不确定就只是路过。',
    };
  }
  if (experiment?.canRecordToday) {
    return {
      action: 'record_experiment',
      title: `记录 Day ${experiment.logs.length + 1} / ${experiment.targetDays}`,
      target: { title: experiment.title },
      detail: '写一件真实发生的事，不写“今天学了 AI”。',
    };
  }
  if (isolated.length > 0) {
    return {
      action: 'connect_node',
      title: `给「${isolated[0].title}」补一条连接`,
      target: { id: isolated[0].id, title: isolated[0].title },
      detail: '孤立节点只是还没有进入你的兴趣结构。',
    };
  }
  return {
    action: 'capture_spark',
    title: '再留下一个真实好奇',
    detail: '刷到一条内容，不需要整理全部，只留下让你停下来的那一条。',
  };
}

function search(graph, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return graph.nodes
    .filter(
      (node) =>
        node.id.toLowerCase().includes(q) ||
        node.title.toLowerCase().includes(q) ||
        (node.tags ?? []).some((tag) => String(tag).toLowerCase().includes(q)),
    )
    .slice(0, 20)
    .map((node) => publicNode(node, degreeMap(graph).get(node.id) ?? 0));
}

const tools = [
  {
    name: 'interestseed_get_graph',
    description: '读取本地 InterestSeed 图谱摘要；只读，不修改 Vault。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '最多返回节点数，默认 50' },
        theme: { type: 'string', description: '按标签筛选，例如 美妆、运动、游戏' },
      },
    },
  },
  {
    name: 'interestseed_next_step',
    description: '返回当前唯一最值得做的下一步，不自动执行。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'interestseed_search_interest',
    description: '搜索标题、标签或节点 ID。',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'interestseed_get_experiment',
    description: '读取当前 3/7 天兴趣实验状态和日志。',
    inputSchema: { type: 'object', properties: {} },
  },
];

function toolResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  };
}

function callTool(name, input) {
  const graph = readGraph();
  if (name === 'interestseed_get_graph') {
    const degrees = degreeMap(graph);
    const limit = Math.min(100, Math.max(1, Number(input?.limit) || 50));
    const theme = typeof input?.theme === 'string' ? input.theme.toLowerCase() : '';
    const nodes = graph.nodes
      .filter(
        (node) =>
          !theme || (node.tags ?? []).some((tag) => String(tag).toLowerCase().includes(theme)),
      )
      .slice(0, limit)
      .map((node) => publicNode(node, degrees.get(node.id) ?? 0));
    return toolResult({
      summary: summarize(graph),
      nodes,
      edges: graph.edges
        .filter((edge) => edge.status !== 'rejected')
        .slice(0, limit * 2)
        .map((edge) => ({
          source: edge.source,
          target: edge.target,
          relation: edge.relation,
          status: edge.status,
          confidence: edge.confidence,
        })),
    });
  }
  if (name === 'interestseed_next_step') return toolResult(nextStep(graph));
  if (name === 'interestseed_search_interest') {
    return toolResult(search(graph, input?.query));
  }
  if (name === 'interestseed_get_experiment') return toolResult(getExperiment(graph));
  throw new Error(`未知工具：${name}`);
}

function response(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function error(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function handle(message) {
  const { id, method, params } = message;
  if (method === 'initialize') {
    return response(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'interestseed', version: '2.2.0' },
    });
  }
  if (method === 'notifications/initialized') return null;
  if (method === 'ping') return response(id, {});
  if (method === 'tools/list') return response(id, { tools });
  if (method === 'tools/call') {
    try {
      return response(id, callTool(params?.name, params?.arguments ?? {}));
    } catch (cause) {
      return response(id, {
        content: [
          {
            type: 'text',
            text: `InterestSeed MCP 错误：${cause instanceof Error ? cause.message : String(cause)}`,
          },
        ],
        isError: true,
      });
    }
  }
  if (id !== undefined) return error(id, -32601, `Method not found: ${method}`);
  return null;
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const result = handle(JSON.parse(line));
      if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (cause) {
      process.stdout.write(
        `${JSON.stringify(error(null, -32700, cause instanceof Error ? cause.message : 'parse error'))}\n`,
      );
    }
  }
});
process.stdin.on('end', () => process.exit(0));
