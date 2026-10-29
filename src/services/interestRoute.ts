import type { InterestSeedNode } from '../types/graph';
import { latestObservation } from '../core/observations';
import { pathFromUri } from '../utils/paths';

export interface InterestRouteInput {
  theme: string;
  nodes: readonly InterestSeedNode[];
  connectedIds?: ReadonlySet<string>;
  experiment?: {
    title: string;
    day: number;
    targetDays: number;
    status: string;
  } | null;
  generatedAt?: string;
}

function sourceLink(node: InterestSeedNode): string {
  if (node.sourceUri) {
    if (/^https?:\/\//i.test(node.sourceUri)) return `[${node.title}](${node.sourceUri})`;
    const path = pathFromUri(node.sourceUri).replace(/\.md$/i, '');
    if (path) return `[[${path}|${node.title}]]`;
  }
  return node.title;
}

function latestEvidence(node: InterestSeedNode): string {
  const latest = latestObservation(node.metadata);
  return latest ? latest.evidence : '';
}

function renderNode(node: InterestSeedNode): string {
  const evidence = latestEvidence(node);
  return `- ${sourceLink(node)}${evidence ? ` — ${evidence}` : ''}`;
}

export function renderInterestRoute(input: InterestRouteInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const experimenting = input.nodes.filter((node) => node.metadata?.nextStep === true);
  const connected = input.nodes.filter(
    (node) =>
      node.metadata?.nextStep !== true &&
      (node.metadata?.taskState === 'connected' || input.connectedIds?.has(node.id) === true),
  );
  const captured = input.nodes.filter(
    (node) => !experimenting.includes(node) && !connected.includes(node),
  );
  const lines: string[] = [
    `# 兴趣路线 · ${input.theme}`,
    '',
    `> 由 InterestSeed 生成于 ${generatedAt.slice(0, 10)}。这是一份只读快照，不会自动修改你的笔记。`,
    '',
  ];
  if (input.experiment) {
    lines.push(
      '## 正在验证',
      '',
      `- **${input.experiment.title}** · Day ${input.experiment.day} / ${input.experiment.targetDays}`,
      `- 状态：${input.experiment.status === 'complete' ? '已完成' : '进行中'}`,
      '',
    );
  }
  if (experimenting.length > 0) {
    lines.push('## 验证中的线索', '', ...experimenting.map(renderNode), '');
  }
  if (connected.length > 0) {
    lines.push('## 已连接的线索', '', ...connected.map(renderNode), '');
  }
  if (captured.length > 0) {
    lines.push('## 等待判断', '', ...captured.map(renderNode), '');
  }
  const observed = input.nodes
    .map((node) => ({ node, observation: latestObservation(node.metadata) }))
    .filter((entry) => entry.observation);
  if (observed.length > 0) {
    lines.push('## 最近观察', '');
    for (const entry of observed.slice(0, 8)) {
      const observation = entry.observation;
      if (!observation) continue;
      lines.push(`- ${entry.node.title} — ${observation.evidence}（${observation.at.slice(0, 10)}）`);
    }
    lines.push('');
  }
  lines.push('## 下一步', '', '- 回到图谱，选择一条线索，只做一件真实的小事。', '');
  return lines.join('\n');
}
