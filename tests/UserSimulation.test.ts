import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyDiscoveryFeedback,
  undoDiscoveryFeedback,
} from '../src/discovery/feedback';
import { buildExploration } from '../src/discovery/exploration';
import { buildLocalExplorationInsights } from '../src/discovery/insights';
import { buildDiscoveryOverview } from '../src/discovery/overview';
import { emptyDiscoveryFile } from '../src/discovery/types';
import type {
  Discovery,
  DiscoveryFeedbackAction,
} from '../src/discovery/types';
import { emptyGraph } from '../src/types/graph';
import type { InterestSeedGraph } from '../src/types/graph';

const NOW = '2026-10-28T12:00:00.000Z';

interface Persona {
  id: string;
  name: string;
  themes: string[];
  projects: string[];
  startHour: number;
  endHour: number;
  weekendBoost: number;
  feedbackBias: number;
  noteDays: number;
  notesPerDay: number;
  /** Prototype-pollution probe for one adversarial user. */
  adversarial?: boolean;
}

const PERSONAS: Persona[] = [
  { id: 'u01', name: '早鸟研究者', themes: ['研究', 'AI', '生产力'], projects: ['论文', '实验室'], startHour: 6, endHour: 10, weekendBoost: 1.3, feedbackBias: 0.56, noteDays: 26, notesPerDay: 4 },
  { id: 'u02', name: '夜猫开发者', themes: ['Web 开发', 'AI', '开源'], projects: ['产品', '工具库'], startHour: 22, endHour: 27, weekendBoost: 0.8, feedbackBias: 0.45, noteDays: 24, notesPerDay: 5 },
  { id: 'u03', name: '通勤阅读者', themes: ['阅读', '写作', '心理学'], projects: ['读书', '随笔'], startHour: 7, endHour: 9, weekendBoost: 1.6, feedbackBias: 0.62, noteDays: 28, notesPerDay: 3 },
  { id: 'u04', name: '周末园艺者', themes: ['园艺', '设计', '可持续'], projects: ['花园', '生活'], startHour: 9, endHour: 12, weekendBoost: 2.2, feedbackBias: 0.50, noteDays: 10, notesPerDay: 4 },
  { id: 'u05', name: '教师', themes: ['教育', '历史', '生产力'], projects: ['课程', '备课'], startHour: 18, endHour: 21, weekendBoost: 1.0, feedbackBias: 0.58, noteDays: 25, notesPerDay: 3 },
  { id: 'u06', name: '设计师', themes: ['产品设计', '用户体验', '艺术'], projects: ['品牌', '作品集'], startHour: 10, endHour: 13, weekendBoost: 1.1, feedbackBias: 0.52, noteDays: 22, notesPerDay: 4 },
  { id: 'u07', name: '医生', themes: ['医学', '健康', '研究'], projects: ['临床', '学习'], startHour: 20, endHour: 22, weekendBoost: 0.6, feedbackBias: 0.64, noteDays: 20, notesPerDay: 2 },
  { id: 'u08', name: '学生', themes: ['学习', '数学', '笔记方法'], projects: ['课程', '考试'], startHour: 16, endHour: 19, weekendBoost: 1.4, feedbackBias: 0.40, noteDays: 27, notesPerDay: 5 },
  { id: 'u09', name: '父母', themes: ['育儿', '烹饪', '家庭'], projects: ['家庭', '生活'], startHour: 7, endHour: 8, weekendBoost: 1.8, feedbackBias: 0.60, noteDays: 18, notesPerDay: 2 },
  { id: 'u10', name: '摄影师', themes: ['摄影', '旅行', '艺术'], projects: ['拍摄', '旅程'], startHour: 15, endHour: 18, weekendBoost: 2.0, feedbackBias: 0.48, noteDays: 15, notesPerDay: 3 },
  { id: 'u11', name: '音乐人', themes: ['音乐', '音频', '创造力'], projects: ['创作', '练习'], startHour: 21, endHour: 24, weekendBoost: 1.2, feedbackBias: 0.44, noteDays: 20, notesPerDay: 3 },
  { id: 'u12', name: '写作者', themes: ['写作', '阅读', '出版'], projects: ['长文', '选题'], startHour: 6, endHour: 9, weekendBoost: 1.2, feedbackBias: 0.66, noteDays: 29, notesPerDay: 3 },
  { id: 'u13', name: '数据分析师', themes: ['数据', 'AI', '可视化'], projects: ['分析', '报表'], startHour: 9, endHour: 12, weekendBoost: 0.7, feedbackBias: 0.54, noteDays: 23, notesPerDay: 4 },
  { id: 'u14', name: '硬件工程师', themes: ['工程', '电子', '制造'], projects: ['原型', '设备'], startHour: 19, endHour: 22, weekendBoost: 1.0, feedbackBias: 0.47, noteDays: 21, notesPerDay: 3 },
  { id: 'u15', name: '厨师', themes: ['烹饪', '营养', '文化'], projects: ['菜单', '厨房'], startHour: 14, endHour: 17, weekendBoost: 1.7, feedbackBias: 0.61, noteDays: 17, notesPerDay: 3 },
  { id: 'u16', name: '旅行者', themes: ['旅行', '语言', '摄影'], projects: ['行程', '见闻'], startHour: 8, endHour: 11, weekendBoost: 2.4, feedbackBias: 0.42, noteDays: 12, notesPerDay: 4 },
  { id: 'u17', name: '跑者', themes: ['跑步', '健康', '习惯'], projects: ['训练', '身体'], startHour: 6, endHour: 7, weekendBoost: 1.5, feedbackBias: 0.70, noteDays: 24, notesPerDay: 2 },
  { id: 'u18', name: '游戏玩家', themes: ['游戏', '设计', '社区'], projects: ['体验', '公会'], startHour: 20, endHour: 24, weekendBoost: 1.9, feedbackBias: 0.35, noteDays: 16, notesPerDay: 4 },
  { id: 'u19', name: '志愿者', themes: ['志愿', '社区', '教育'], projects: ['活动', '公益'], startHour: 17, endHour: 19, weekendBoost: 2.3, feedbackBias: 0.57, noteDays: 14, notesPerDay: 2 },
  { id: 'u20', name: '创业者', themes: ['创业', '产品', '金融', '__proto__'], projects: ['公司', '市场'], startHour: 8, endHour: 12, weekendBoost: 1.3, feedbackBias: 0.51, noteDays: 25, notesPerDay: 4, adversarial: true },
];

const ACTIONS: DiscoveryFeedbackAction[] = [
  'accepted',
  'accepted',
  'accepted',
  'rejected',
  'corrected',
  'low-value',
  'needs-verification',
];

function rngFor(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function dayIso(offsetDays: number, hour: number): string {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  date.setUTCHours(Math.max(0, Math.min(23, hour)), 0, 0, 0);
  return date.toISOString();
}

function makeDiscovery(
  persona: Persona,
  index: number,
  random: () => number,
  dayOffset: number,
  hour: number,
): Discovery {
  const theme = persona.themes[Math.floor(random() * persona.themes.length)] ?? persona.themes[0]!;
  const secondTheme = random() > 0.7
    ? persona.themes[Math.floor(random() * persona.themes.length)]
    : undefined;
  const project = persona.projects[Math.floor(random() * persona.projects.length)] ?? persona.projects[0]!;
  const secondProject = random() > 0.78
    ? persona.projects[Math.floor(random() * persona.projects.length)]
    : undefined;
  const at = dayIso(dayOffset, hour);
  const subjects = [theme, ...(secondTheme && secondTheme !== theme ? [secondTheme] : [])];
  const projects = [project, ...(secondProject && secondProject !== project ? [secondProject] : [])];
  const id = `${persona.id}-d${String(index).padStart(3, '0')}`;
  return {
    id,
    kind: 'cross-project-topic',
    title: `${persona.name} · ${theme} 候选 ${index + 1}`,
    description: `${persona.name} 在 ${project} 中反复出现的 ${theme} 线索。`,
    nodeIds: [`${persona.id}-n${project}`, `${persona.id}-n-${theme}`],
    projectKeys: projects,
    subjectKeys: subjects,
    evidence: [
      {
        kind: 'shared-tag',
        nodeId: `${persona.id}-n${project}`,
        sourceUri: `vault:${persona.id}/${project}.md`,
        text: `共享主题 ${theme}`,
      },
    ],
    ruleVersion: 'cross-project-topic-v1',
    strength: random() > 0.8 ? 'strong' : random() > 0.4 ? 'moderate' : 'weak',
    dedupeKey: id,
    status: 'active',
    feedbackStatus: 'none',
    createdAt: at,
    updatedAt: at,
  };
}

function makeGraph(persona: Persona): InterestSeedGraph {
  const graph = emptyGraph(NOW);
  graph.nodes = persona.projects.map((project, index) => ({
    id: `${persona.id}-n${project}`,
    type: 'document',
    title: project,
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    metadata: { path: `${persona.name}/${project}.md`, index },
  }));
  graph.edges = persona.projects.slice(1).map((project, index) => ({
    id: `${persona.id}-e${index + 1}`,
    source: `${persona.id}-n${persona.projects[0]}`,
    target: `${persona.id}-n${project}`,
    relation: 'related-to',
    origin: 'user',
    status: 'confirmed',
    confidence: 1,
    evidence: [],
    createdAt: NOW,
    updatedAt: NOW,
  }));
  return graph;
}

interface SimulationResult {
  persona: Persona;
  file: ReturnType<typeof emptyDiscoveryFile>;
  graph: InterestSeedGraph;
  feedbackActions: number;
  undoActions: number;
}

function simulate(persona: Persona, seed: number): SimulationResult {
  const random = rngFor(seed);
  const file = emptyDiscoveryFile(NOW);
  const discoveries: Discovery[] = [];
  let index = 0;
  for (let dayOffset = 29; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date(NOW);
    date.setUTCDate(date.getUTCDate() - dayOffset);
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const activeDay = dayOffset < persona.noteDays || random() < 0.18;
    if (!activeDay) continue;
    const boost = isWeekend ? persona.weekendBoost : 1;
    const notes = Math.max(1, Math.round(persona.notesPerDay * boost * (0.65 + random() * 0.5)));
    for (let note = 0; note < notes; note += 1) {
      const span = Math.max(1, persona.endHour - persona.startHour);
      const hour = Math.floor(persona.startHour + random() * span) % 24;
      discoveries.push(makeDiscovery(persona, index, random, dayOffset, hour));
      index += 1;
    }
  }
  file.discoveries = discoveries;
  const graph = makeGraph(persona);

  let feedbackActions = 0;
  let undoActions = 0;
  for (const discovery of file.discoveries) {
    if (random() > 0.58 + (persona.feedbackBias - 0.5) * 0.25) continue;
    const action = ACTIONS[Math.floor(random() * ACTIONS.length)] ?? 'accepted';
    const at = dayIso(Math.floor(random() * 12), Math.floor(persona.startHour + random() * 3));
    const before = file.discoveries.find((item) => item.id === discovery.id)!;
    const updated = applyDiscoveryFeedback(file, discovery.id, action, at, {
      title: before.title,
      description: `${persona.name} 修正后的描述`,
      createdAt: at,
    });
    if (updated !== file) {
      file.discoveries = updated.discoveries;
      file.updatedAt = updated.updatedAt;
      feedbackActions += 1;
    }
    if (random() < 0.06) {
      const undone = undoDiscoveryFeedback(file, discovery.id, at);
      if (undone !== file) {
        file.discoveries = undone.discoveries;
        file.updatedAt = undone.updatedAt;
        undoActions += 1;
      }
    }
  }

  // A few discoveries are applied to the graph; the rest stay intentionally
  // unapplied so the simulation covers both sides of the state machine.
  let applied = 0;
  file.discoveries = file.discoveries.map((discovery) => {
    if (discovery.feedbackStatus !== 'accepted' || random() > 0.35 || applied >= 3) {
      return discovery;
    }
    applied += 1;
    const edge = graph.edges[applied - 1];
    return {
      ...discovery,
      application: {
        state: 'applied',
        edgeId: edge?.id ?? `${persona.id}-missing-edge`,
        appliedAt: NOW,
      },
    };
  });
  return { persona, file, graph, feedbackActions, undoActions };
}

describe('20-user daily-life simulation', () => {
  it('runs twenty routines without corrupting feedback, themes or exploration', () => {
    const started = performance.now();
    const results = PERSONAS.map((persona, index) => simulate(persona, 0x51eed + index * 97));
    const elapsed = performance.now() - started;

    let feedbackEvents = 0;
    let undoEvents = 0;
    for (const result of results) {
      const snapshot = JSON.stringify(result.file);
      const overview = buildDiscoveryOverview(result.file, result.graph, NOW);
      const exploration = buildExploration(result.file, NOW);
      const insights = buildLocalExplorationInsights(exploration, overview);

      expect(overview.total).toBe(result.file.discoveries.length);
      expect(overview.active + overview.dismissed + overview.superseded).toBe(overview.total);
      expect(Object.values(overview.feedback).reduce((sum, count) => sum + count, 0)).toBe(overview.total);
      expect(Object.values(overview.application).reduce((sum, count) => sum + count, 0)).toBe(overview.total);
      expect(overview.activity).toHaveLength(7);
      expect(exploration.totals.discoveries).toBe(result.file.discoveries.length);
      expect(exploration.totals.active).toBe(overview.active);
      expect(exploration.matrix.themes.every((theme) => Number.isFinite(theme.signal))).toBe(true);
      expect(exploration.matrix.themes.every((theme) => theme.signal >= 0 && theme.signal <= 1)).toBe(true);
      expect(exploration.matrix.themes.every((theme) => theme.acceptanceRate >= 0 && theme.acceptanceRate <= 1)).toBe(true);
      expect(insights.length).toBeLessThanOrEqual(4);
      expect(insights.every((insight) => insight.themes.length > 0)).toBe(true);
      expect(JSON.stringify(result.file)).toBe(snapshot);
      feedbackEvents += result.feedbackActions;
      undoEvents += result.undoActions;
    }

    const totalDiscoveries = results.reduce((sum, result) => sum + result.file.discoveries.length, 0);
    expect(results).toHaveLength(20);
    expect(totalDiscoveries).toBeGreaterThan(500);
    expect(feedbackEvents).toBeGreaterThan(200);
    expect(undoEvents).toBeGreaterThan(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(elapsed).toBeLessThan(2500);

    const empty = emptyDiscoveryFile(NOW);
    const emptyGraphData = emptyGraph(NOW);
    const emptyOverview = buildDiscoveryOverview(empty, emptyGraphData, NOW);
    const emptyExploration = buildExploration(empty, NOW);
    expect(emptyOverview.total).toBe(0);
    expect(emptyOverview.activity).toHaveLength(7);
    expect(emptyOverview.activity.every((day) => day.count === 0)).toBe(true);
    expect(emptyExploration.totals.discoveries).toBe(0);
    expect(emptyExploration.matrix.themes).toHaveLength(0);
    expect(buildLocalExplorationInsights(emptyExploration, emptyOverview)).toEqual([]);

    const summary = results.map((result) => {
      const overview = buildDiscoveryOverview(result.file, result.graph, NOW);
      const exploration = buildExploration(result.file, NOW);
      return {
        user: result.persona.name,
        discoveries: result.file.discoveries.length,
        accepted: overview.feedback.accepted,
        rejected: overview.feedback.rejected,
        lowValue: overview.feedback['low-value'],
        themes: exploration.totals.themes,
        crossProjectThemes: exploration.totals.crossProjectThemes,
        feedback: result.feedbackActions,
        undo: result.undoActions,
      };
    });
    console.warn('[InterestSeed Simulation]', JSON.stringify({
      users: results.length,
      totalDiscoveries,
      feedbackEvents,
      undoEvents,
      elapsedMs: Math.round(elapsed),
      summary,
    }, null, 2));
    writeFileSync(
      join(tmpdir(), 'interestseed-simulation-summary.json'),
      JSON.stringify({ users: results.length, totalDiscoveries, feedbackEvents, undoEvents, elapsedMs: Math.round(elapsed), summary }, null, 2),
      'utf8',
    );
  });
});
