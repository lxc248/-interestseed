/**
 * InterestSeed Seed Sprint
 *
 * 从 0 到 1 的兴趣星图起跑器。
 *
 * 设计原则：
 * - 用户只需要做选择，不需要写长文本；
 * - 先给“候选”，再让用户确认；
 * - 每个节点/关系都带证据与置信度；
 * - 生成结果只是草案，写入图谱必须经过用户确认。
 */

import type { NodeType } from '../types/graph';

export type SeedSprintRoundId = 'mode' | 'flow' | 'magnet' | 'shape';

export interface SeedSprintOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: 'coral' | 'blue' | 'violet' | 'green' | 'amber';
  seedTitle: string;
  seedType: NodeType;
  tags: string[];
}

export interface SeedSprintRound {
  id: SeedSprintRoundId;
  eyebrow: string;
  question: string;
  hint: string;
  options: SeedSprintOption[];
}

export interface SeedSprintSelection {
  mode?: string;
  flow?: string;
  magnet?: string;
  shape?: string;
}

export interface SeedSprintNodeProposal {
  id: string;
  title: string;
  type: NodeType;
  tags: string[];
  evidence: string;
  confidence: number;
  nextStep?: boolean;
}

export interface SeedSprintEdgeProposal {
  id: string;
  source: string;
  target: string;
  relation: string;
  evidence: string;
  confidence: number;
  surprise?: boolean;
}

export interface SeedSprintExperiment {
  title: string;
  hypothesis: string;
  metric: string;
  prompt: string;
  days: number;
  steps: string[];
}

export interface SeedSprintDraft {
  nodes: SeedSprintNodeProposal[];
  edges: SeedSprintEdgeProposal[];
  mystery: {
    title: string;
    reason: string;
  };
  experiment: SeedSprintExperiment;
}

export const SEED_SPRINT_ROUNDS: readonly SeedSprintRound[] = [
  {
    id: 'mode',
    eyebrow: '01 / 现在的你',
    question: '现在的你，更接近哪种状态？',
    hint: '没有标准答案。选最近的那个，图谱会从这里开始长。',
    options: [
      {
        id: 'making',
        title: '正在做一个东西',
        subtitle: '项目、作品、产品都算',
        icon: 'hammer',
        tone: 'coral',
        seedTitle: '正在做的项目',
        seedType: 'project',
        tags: ['项目', '进行中'],
      },
      {
        id: 'exploring',
        title: '在几个兴趣间摇摆',
        subtitle: '想找到一条能走下去的线',
        icon: 'compass',
        tone: 'blue',
        seedTitle: '正在探索的方向',
        seedType: 'topic',
        tags: ['探索', '方向'],
      },
      {
        id: 'researching',
        title: '正在研究一个问题',
        subtitle: '越挖越深，但还没形成结构',
        icon: 'search',
        tone: 'violet',
        seedTitle: '研究中的问题',
        seedType: 'topic',
        tags: ['研究', '问题'],
      },
      {
        id: 'starting',
        title: '想开始，但还没动手',
        subtitle: '先给好奇心一个入口',
        icon: 'sprout',
        tone: 'green',
        seedTitle: '想开始的兴趣',
        seedType: 'topic',
        tags: ['起点', '好奇'],
      },
    ],
  },
  {
    id: 'flow',
    eyebrow: '02 / 你的心流',
    question: '什么最容易让你忘记时间？',
    hint: '不是“擅长什么”，而是做什么时你最像自己。',
    options: [
      {
        id: 'build',
        title: '做出一个东西',
        subtitle: '代码、文字、模型、作品',
        icon: 'blocks',
        tone: 'coral',
        seedTitle: '动手创造',
        seedType: 'activity',
        tags: ['创造', '行动'],
      },
      {
        id: 'understand',
        title: '把一个东西搞懂',
        subtitle: '拆开、推理、找到底层规律',
        icon: 'brain',
        tone: 'violet',
        seedTitle: '深度理解',
        seedType: 'topic',
        tags: ['研究', '理解'],
      },
      {
        id: 'express',
        title: '记录、表达、分享',
        subtitle: '把模糊的东西说清楚',
        icon: 'pen-line',
        tone: 'blue',
        seedTitle: '表达与叙事',
        seedType: 'topic',
        tags: ['表达', '叙事'],
      },
      {
        id: 'connect',
        title: '和人讨论、碰撞',
        subtitle: '在对话里把想法逼出来',
        icon: 'messages-square',
        tone: 'green',
        seedTitle: '讨论与连接',
        seedType: 'activity',
        tags: ['对话', '连接'],
      },
    ],
  },
  {
    id: 'magnet',
    eyebrow: '03 / 你的磁场',
    question: '最近什么内容最容易让你停下来？',
    hint: '短视频、文章、播客、展览——任何让你停顿的东西。',
    options: [
      {
        id: 'ai',
        title: 'AI、工具、效率',
        subtitle: '新工具、新工作方式、自动化',
        icon: 'sparkles',
        tone: 'violet',
        seedTitle: 'AI 与工具',
        seedType: 'topic',
        tags: ['AI', '工具'],
      },
      {
        id: 'city',
        title: '城市、空间、旅行',
        subtitle: '地方、建筑、人在空间里的生活',
        icon: 'map',
        tone: 'blue',
        seedTitle: '城市与空间',
        seedType: 'topic',
        tags: ['城市', '空间'],
      },
      {
        id: 'visual',
        title: '影像、设计、审美',
        subtitle: '画面、风格、叙事和视觉表达',
        icon: 'camera',
        tone: 'coral',
        seedTitle: '影像与叙事',
        seedType: 'topic',
        tags: ['影像', '设计'],
      },
      {
        id: 'body',
        title: '身体、运动、健康',
        subtitle: '精力、习惯、身体感知',
        icon: 'activity',
        tone: 'green',
        seedTitle: '身体与运动',
        seedType: 'topic',
        tags: ['身体', '运动'],
      },
      {
        id: 'business',
        title: '产品、商业、增长',
        subtitle: '用户、市场、从想法到价值',
        icon: 'trending-up',
        tone: 'amber',
        seedTitle: '产品与商业',
        seedType: 'topic',
        tags: ['产品', '商业'],
      },
      {
        id: 'learning',
        title: '教育、学习、认知',
        subtitle: '人如何理解、记住、变得更好',
        icon: 'graduation-cap',
        tone: 'blue',
        seedTitle: '学习与认知',
        seedType: 'topic',
        tags: ['学习', '认知'],
      },
    ],
  },
  {
    id: 'shape',
    eyebrow: '04 / 你想长出什么',
    question: '你希望这张图先长成什么？',
    hint: '先选一个方向，后面可以随时改。',
    options: [
      {
        id: 'project-map',
        title: '一张项目地图',
        subtitle: '把手上的事和可能的连接放在一起',
        icon: 'network',
        tone: 'coral',
        seedTitle: '项目地图',
        seedType: 'project',
        tags: ['项目', '结构'],
      },
      {
        id: 'path',
        title: '一条探索路径',
        subtitle: '从好奇出发，找到下一步',
        icon: 'route',
        tone: 'blue',
        seedTitle: '探索路径',
        seedType: 'topic',
        tags: ['探索', '路径'],
      },
      {
        id: 'portfolio',
        title: '一个作品集',
        subtitle: '让兴趣逐渐变成可展示的东西',
        icon: 'folder-heart',
        tone: 'violet',
        seedTitle: '作品集',
        seedType: 'project',
        tags: ['作品', '表达'],
      },
      {
        id: 'life',
        title: '一个生活实验',
        subtitle: '把兴趣带进真实生活里',
        icon: 'flask-conical',
        tone: 'green',
        seedTitle: '生活实验',
        seedType: 'activity',
        tags: ['生活', '实验'],
      },
    ],
  },
] as const;

function getOption(roundId: SeedSprintRoundId, optionId: string | undefined) {
  if (!optionId) return undefined;
  return SEED_SPRINT_ROUNDS.find((round) => round.id === roundId)?.options.find(
    (option) => option.id === optionId,
  );
}

function proposalId(option: { id: string }): string {
  return `seed:${option.id}`;
}

function edgeId(source: string, target: string, relation: string): string {
  return `edge:${source}:${target}:${relation}`;
}

/**
 * 纯函数：同样的选择永远得到同样的草案。
 * 这是 onboarding 可测试、可回放的基础。
 */
export function buildSeedSprintDraft(selection: SeedSprintSelection): SeedSprintDraft {
  const mode = getOption('mode', selection.mode);
  const flow = getOption('flow', selection.flow);
  const magnet = getOption('magnet', selection.magnet);
  const shape = getOption('shape', selection.shape);
  const selected = [mode, flow, magnet, shape].filter(
    (option): option is SeedSprintOption => Boolean(option),
  );

  const nodes: SeedSprintNodeProposal[] = selected.map((option) => ({
    id: proposalId(option),
    title: option.seedTitle,
    type: option.seedType,
    tags: [...option.tags, '兴趣起跑'],
    evidence: `来自你的选择：${option.title}`,
    confidence: 0.9,
  }));

  const selectedIds = new Set(nodes.map((node) => node.id));
  const edges: SeedSprintEdgeProposal[] = [];
  const addEdge = (
    source: SeedSprintOption | SeedSprintNodeProposal | undefined,
    target: SeedSprintOption | SeedSprintNodeProposal | undefined,
    relation: string,
    evidence: string,
    confidence: number,
    surprise = false,
  ) => {
    if (!source || !target) return;
    const sourceId = proposalId(source);
    const targetId = proposalId(target);
    if (!selectedIds.has(sourceId) || !selectedIds.has(targetId) || sourceId === targetId) {
      return;
    }
    if (edges.some((edge) => edge.source === sourceId && edge.target === targetId)) return;
    edges.push({
      id: edgeId(sourceId, targetId, relation),
      source: sourceId,
      target: targetId,
      relation,
      evidence,
      confidence,
      surprise,
    });
  };

  addEdge(
    mode,
    shape,
    '正在形成',
    '你把“现在的状态”和“想长成的样子”放在了一起；这张图先从这里长出方向。',
    0.92,
  );
  addEdge(
    flow,
    shape,
    '适合通过',
    `你的心流来自「${flow?.title ?? '行动'}」，它会决定这张图更像项目、路径还是作品。`,
    0.84,
  );
  addEdge(
    magnet,
    mode,
    '持续吸引',
    `「${magnet?.title ?? '这个主题'}」在你的注意力里反复出现，先把它放到当前状态旁边。`,
    0.78,
  );
  addEdge(
    magnet,
    flow,
    '意外连接',
    `一个吸引你的主题，和一个让你进入心流的动作之间，可能藏着一条你还没走过的桥。`,
    0.64,
    true,
  );

  const experiment: SeedSprintExperiment = {
    title: '7 天兴趣实验',
    hypothesis: `接下来的 7 天，我愿意用真实行动验证「${magnet?.seedTitle ?? '这个兴趣'}」是否值得继续投入。`,
    metric: '每天记录一次兴趣强度、精力值和一个具体证据；连续 7 条才算完成。',
    prompt: `用 7 天，把「${magnet?.seedTitle ?? '你的兴趣'}」从好奇变成一个可观察的小实验。`,
    days: 7,
    steps: [
      '观察：记录一次让你停下来的内容。',
      '拆解：写出它吸引你的一个具体原因。',
      '连接：把它和你已有的一个项目或主题连起来。',
      '动手：做一个 30 分钟的小尝试。',
      '反馈：写下“我更喜欢 / 更不喜欢什么”。',
      '表达：用一句话解释这个兴趣。',
      '回看：决定继续、转向，还是暂时放下。',
    ],
  };
  const experimentNode: SeedSprintNodeProposal = {
    id: 'seed:next-step',
    title: experiment.title,
    type: 'activity',
    tags: ['兴趣实验', '下一步'],
    evidence: '从你的兴趣磁场生成的可执行下一步，不是自动任务；你可以随时修改或删除。',
    confidence: 0.76,
    nextStep: true,
  };
  nodes.push(experimentNode);
  selectedIds.add(experimentNode.id);
  if (magnet) {
    addEdge(
      magnet,
      experimentNode,
      '下一步',
      '先给最容易被你注意到的主题一个低风险的行动入口。',
      0.81,
    );
  }
  if (mode) {
    addEdge(
      mode,
      experimentNode,
      '下一步',
      '从当前状态出发，比从“完美计划”出发更容易开始。',
      0.74,
    );
  }

  return {
    nodes,
    edges,
    mystery: {
      title: '未解锁的方向',
      reason: '完成一次兴趣实验后，系统会从你的反馈里解锁一条新的相邻路径。',
    },
    experiment: {
      ...experiment,
      prompt: `${experiment.prompt} 实验节点会自动进入图谱，但只作为建议，不会替你确认。`,
    },
  };
}

export function selectionIsComplete(selection: SeedSprintSelection): boolean {
  return Boolean(selection.mode && selection.flow && selection.magnet && selection.shape);
}
