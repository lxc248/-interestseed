/* Demo data for the standalone Cosmic Viewer.
 * Replace this object with a generated graph from the InterestSeed Skill.
 */
window.__INTERESTSEED_GRAPH__ = {
  schemaVersion: 2,
  nodes: [
    {
      id: 'seed-project',
      type: 'project',
      title: '正在做的项目',
      tags: ['兴趣起跑', '项目', '进行中'],
      metadata: { evidence: '来自你的选择：正在做一个东西', confidence: 0.9 }
    },
    {
      id: 'seed-ai',
      type: 'topic',
      title: 'AI 与工具',
      tags: ['兴趣起跑', 'AI', '工具'],
      metadata: { evidence: '最近最容易让你停下来的内容', confidence: 0.86 }
    },
    {
      id: 'seed-create',
      type: 'activity',
      title: '动手创造',
      tags: ['兴趣起跑', '创造', '行动'],
      metadata: { evidence: '什么最容易让你忘记时间：做出一个东西', confidence: 0.9 }
    },
    {
      id: 'seed-map',
      type: 'project',
      title: '项目地图',
      tags: ['兴趣起跑', '项目', '结构'],
      metadata: { evidence: '你希望这张图先长成的样子', confidence: 0.82 }
    },
    {
      id: 'seed-experiment',
      type: 'activity',
      title: '7 天兴趣实验',
      tags: ['兴趣起跑', '下一步', '实验'],
      metadata: { evidence: '从兴趣磁场生成的低风险行动入口', confidence: 0.76, nextStep: true }
    },
    {
      id: 'theme-audience',
      type: 'topic',
      title: '让人愿意开始',
      tags: ['产品', '表达', '心理'],
      metadata: { evidence: '在三个项目里反复出现的问题', confidence: 0.78 }
    },
    {
      id: 'theme-visual',
      type: 'topic',
      title: '视觉叙事',
      tags: ['设计', '影像', '表达'],
      metadata: { evidence: '你反复收藏的视觉结构', confidence: 0.71 }
    },
    {
      id: 'theme-city',
      type: 'topic',
      title: '城市观察',
      tags: ['城市', '空间', '生活'],
      metadata: { evidence: '来自近期的城市与空间内容', confidence: 0.68 }
    },
    {
      id: 'project-notes',
      type: 'project',
      title: '产品札记',
      tags: ['项目', '产品', '写作'],
      metadata: { evidence: '正在积累的产品观察', confidence: 0.74 }
    },
    {
      id: 'doc-field',
      type: 'document',
      title: '田野笔记',
      tags: ['文档', '城市', '观察'],
      metadata: { evidence: '城市观察的原始记录', confidence: 0.65 }
    },
    {
      id: 'doc-shortvideo',
      type: 'video',
      title: '短视频：为什么我们总是重新开始？',
      tags: ['火花', '视频', '心理'],
      metadata: { evidence: '来自一次短视频兴趣火花', confidence: 0.67 }
    },
    {
      id: 'theme-learning',
      type: 'topic',
      title: '学习与认知',
      tags: ['学习', '认知', '方法'],
      metadata: { evidence: '跨项目重复出现的主题', confidence: 0.62 }
    }
  ],
  edges: [
    { id: 'e1', source: 'seed-project', target: 'seed-map', relation: '正在形成', status: 'confirmed', confidence: 0.92 },
    { id: 'e2', source: 'seed-ai', target: 'seed-create', relation: '持续吸引', status: 'confirmed', confidence: 0.78 },
    { id: 'e3', source: 'seed-create', target: 'seed-experiment', relation: '下一步', status: 'confirmed', confidence: 0.81 },
    { id: 'e4', source: 'theme-audience', target: 'seed-project', relation: '可能连接', status: 'confirmed', confidence: 0.7 },
    { id: 'e5', source: 'theme-visual', target: 'theme-audience', relation: '意外连接', status: 'confirmed', confidence: 0.64 },
    { id: 'e6', source: 'theme-city', target: 'doc-field', relation: '证据', status: 'confirmed', confidence: 0.66 },
    { id: 'e7', source: 'project-notes', target: 'theme-audience', relation: '正在探索', status: 'confirmed', confidence: 0.73 },
    { id: 'e8', source: 'doc-shortvideo', target: 'theme-audience', relation: '火花', status: 'confirmed', confidence: 0.67 },
    { id: 'e9', source: 'theme-learning', target: 'seed-experiment', relation: '可能连接', status: 'suggested', confidence: 0.58 },
    { id: 'e10', source: 'theme-visual', target: 'seed-map', relation: '可能连接', status: 'suggested', confidence: 0.55 },
    { id: 'e11', source: 'seed-ai', target: 'project-notes', relation: '共同出现', status: 'confirmed', confidence: 0.69 },
    { id: 'e12', source: 'theme-city', target: 'theme-visual', relation: '意外连接', status: 'suggested', confidence: 0.52 }
  ]
};
