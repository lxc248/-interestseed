# InterestSeed

把 vault 里的**项目、文档、主题、图片、音频、视频与活动**整理成一张可确认、可追溯的兴趣图谱。

![InterestSeed 兴趣图谱](assets/screenshot-1.png)

## 安装

### 手动安装（推荐，当前版本）

1. 下载 `release/interestseed-0.1.0.zip`；
2. 解压到你的 Vault：

```text
<Vault>/.obsidian/plugins/interestseed/
```

3. 确认目录中包含：

```text
main.js
manifest.json
styles.css
```

4. 打开 Obsidian → 设置 → 第三方插件 → 启用 `InterestSeed`；
5. 打开 `兴趣图谱` 视图。

### 开发安装

```bash
npm install
npm run build
```

把 `dist/main.js`、`dist/styles.css` 和根目录 `manifest.json` 复制到插件目录。

> 社区插件市场提交仍在准备中；当前请使用上面的手动安装方式。

InterestSeed 是一个 Obsidian 插件：它通过 Vault API 与 MetadataCache 扫描 Markdown 笔记，按 frontmatter 判定节点类型，解析双链、共享标签与用户定义主题生成候选关系。扫描产出的关系（包括双链）默认都是「建议」，只有你确认后才变成正式关系；已拒绝的关系会被记住，不会反复打扰。所有编辑都可以撤销，图谱与视口一起持久化。

```
Markdown 笔记 ──► 节点（project / document / topic / image / audio / video / activity）
  ├── 双链 ──────────► references（user / suggested）
  ├── 共享标签 ──────► related-to（rule / suggested）
  └── 匹配用户主题 ──► about（rule / suggested）
                        │
                        ▼
             洞察：主题簇 / 桥接节点 / 待确认建议 / 孤立节点
```

## 功能

- **Markdown 建图**：通过 `Vault.getMarkdownFiles()` 与 `MetadataCache` 扫描笔记（支持包含 / 排除文件夹），根据 frontmatter 的 `type`、`project` / `activity` 标记判定节点类型；媒体节点可按需从当前文件手动创建。
- **可追溯的关系**：每条边都有 `origin`（user / rule / ai）、`status`（confirmed / suggested / rejected）、`confidence` 与 `evidence`，画布上用实线 / 虚线 / 点线区分。
- **确认与拒绝**：详情面板一键确认或拒绝建议；拒绝会保留为抑制记录，后续推断不再重复建议这对节点。
- **关系名称编辑**：详情面板可修改关系名称；关系 ID、来源和状态保持不变，修改可撤销。规则/AI 关系被用户改名后会记录保护标记，重新扫描保留用户名称并提示冲突。
- **可交互画布**：零运行时依赖的 Canvas 力导向图，支持拖拽、平移、滚轮缩放、悬停高亮、选中高亮邻居。
- **图谱洞察**：主题簇、桥接节点、待确认建议、孤立节点与类型覆盖提示。主题簇 / 桥接 / 孤立只使用 `confirmed` 关系；`suggested` 单独统计为待确认建议，`rejected` 保留但不参与核心知识结构。
- **视口记忆**：缩放 / 平移随图谱保存，重新打开保持上次视角。
- **JSON 导出**：顶部操作栏或命令面板可导出当前图谱 JSON，便于备份、审查和迁移；导出不写入 Vault，不发网络请求。
- **最小发现**：根据跨目录共享标签和已确认关系，生成有证据的“共同主题”发现；支持接受、拒绝、修正、低价值、待验证反馈和软撤销；接受后可经独立确认界面显式应用到图谱，发现独立保存。
- **本地聚合审计（原型）**：只接受注入的发现数据，输出 sample/feedback/application/evidence/theme 等聚合计数；不读取 Vault 正文，不保存单条样本，不写反馈或图谱。范围声明只表示调用方声明，不等于真实用户授权；active 超过 50 或纳入的 dismissed 超过 20 时拒绝审计，不静默截断。
- **审计只读投影**：提供 `readExact` 只读接口与最小字段投影；不读取 `.bak`、不生成损坏备份，不把标题、路径、URI、节点/关系 ID、标签原文或 evidence 文本传入聚合层。
- **审计运行时绑定（后端）**：当前插件生成受控 Vault binding 和必填完整性快照；队列待写、失败、关闭、blocked、issues、一致性未知时默认拒绝审计；尚无审计 UI 或报告保存。
- **审计交互闭环**：命令面板提供“生成发现聚合审计”，选择顶层项目与更新时间范围后确认；只读主数据生成内存聚合预览；关闭不保存；保存报告是独立用户操作，默认不覆盖同名文件。
- **启动写入去重**：发现刷新在内容未变化时不重复入队；图谱持久化只在 dirty 状态保存，避免插件重载/卸载的空写。
- **审计运行时复核**：审计读取前后重新采集 blocked/issues/队列状态；伪造快照不能绕过当前运行时不安全状态；报告保存前再次检查任务代次。
- **最终验收**：4C 最终真实环境验收为受限通过；正常 GUI、保存与 stale save 已验证，异常路径见 `4C最终审计与真实环境验收报告.md`。
- **容错与迁移**：损坏数据自动备份并降级为空图谱；内置 v0 / v1 → v2 迁移链。
- **AI 接口（v1 禁用）**：只提供 `ModelProvider` 接口与禁用实现，不配置 API Key、不发起网络请求；未来启用前会先展示发送字段与服务商并征得明确授权。
- **阶段 6 AI 准入结论**：规则发现基线可复现，但缺少真实用户样本与获准模型边界，暂不接入真实模型；多入口扩展无明确复用收益，Obsidian 插件仍为唯一正式入口。

## 目录结构

```
interestseed/
├── manifest.json            # Obsidian 插件清单
├── package.json
├── tsconfig.json
├── vite.config.ts           # 构建为 dist/main.js（CJS，external obsidian）
├── vitest.config.ts
├── eslint.config.js         # ESLint 10 flat config
├── .gitignore
├── README.md
├── src/
│   ├── main.ts              # 插件入口：生命周期、设置、装配（不承载业务逻辑）
│   ├── types/
│   │   └── graph.ts         # 领域模型（NodeType / RelationOrigin / InterestSeedGraph…）
│   ├── core/
│   │   ├── GraphStore.ts    # GraphStore 接口 + InterestSeedGraphStore 实现
│   │   ├── GraphSession.ts  # 可撤销的写操作门面（所有修改经此记录）
│   │   ├── GraphBuilder.ts  # GraphBuilder 接口 + InterestSeedGraphBuilder（节点/链接/规则）
│   │   ├── RelationEngine.ts# 候选关系接口 + 链接 / 标签 / 主题规则
│   │   ├── InsightEngine.ts # 主题簇、桥接节点、洞察
│   │   └── UndoManager.ts   # UndoManager 接口 + UndoHistory（命令栈 / 重做扩展）
│   ├── adapters/
│   │   ├── ObsidianVaultAdapter.ts  # Vault API + MetadataCache：扫描 Markdown → 节点
│   │   └── vaultScan.ts             # 范围过滤、标签归一化、节点构造（纯函数）
│   ├── storage/
│   │   ├── PluginDataStorage.ts     # 插件目录存储：原子写入、备份、旧文件迁移
│   │   ├── GraphRepository.ts       # GraphRepository 接口 + 校验 / 备份 / 迁移保护
│   │   └── MigrationManager.ts      # 版本迁移链（0 → 1 → 2）
│   ├── plugin/
│   │   ├── GraphController.ts       # 建图 / 编辑 / AI / 视口 / 存储操作
│   │   ├── PersistenceService.ts    # 保存调度、失败状态、迁移保护
│   │   └── commands.ts              # 命令注册（与插件实现解耦）
│   ├── ui/
│   │   ├── InterestSeedView.ts      # ItemView 组装与视口持久化
│   │   ├── GraphCanvas.ts           # Canvas 力导向图
│   │   ├── DetailPanel.ts           # 节点详情 / 建议收件箱 / 洞察
│   │   ├── suggestionList.ts        # 全图待确认关系的纯数据筛选
│   │   ├── FilterBar.ts             # 搜索与筛选
│   │   ├── NodeCreateModal.ts       # 新建节点弹窗
│   │   ├── RelationCreateModal.ts   # 选择目标节点 + 关系名称
│   │   ├── RelationEditModal.ts     # 修改关系名称（ID 保持不变）
│   │   ├── ScanConfirmModal.ts      # 扫描范围 / 预计读取数量确认
│   │   └── EmptyState.ts            # 空状态引导
│   ├── services/
│   │   └── ModelProvider.ts         # 模型接口 + 禁用实现（v1 不联网）
│   ├── settings/
│   │   └── SettingsTab.ts           # 设置页、默认值与归一化
│   ├── utils/
│   │   ├── ids.ts           # 稳定 id（路径哈希 / 关系哈希）
│   │   ├── paths.ts         # vault 路径与 sourceUri 工具
│   │   ├── exportGraph.ts   # 图谱 JSON 序列化、文件名与本地下载
│   │   └── validation.ts    # 数据清洗、结构校验与图谱校验
│   └── styles.css
└── tests/
    ├── GraphStore.test.ts
    ├── GraphSession.test.ts
    ├── GraphBuilder.test.ts
    ├── VaultScan.test.ts
    ├── RelationEngine.test.ts
    ├── GraphRepository.test.ts
    ├── GraphValidation.test.ts
    ├── InsightEngine.test.ts
    ├── SuggestionInbox.test.ts
    ├── FilterBar.test.ts
    ├── GraphCanvas.test.ts
    ├── ModelProvider.test.ts
    └── UndoManager.test.ts
```

## 数据模型

`src/types/graph.ts` 是唯一的事实来源：

```ts
export type NodeType =
  | "project" | "document" | "topic" | "image" | "audio" | "video" | "activity";

export type RelationOrigin = "user" | "rule" | "ai";
export type RelationStatus = "confirmed" | "suggested" | "rejected";

export interface InterestSeedNode {
  id: string;                 // 来自文件时由 uri 哈希派生，重建不变
  type: NodeType;
  title: string;
  sourceUri?: string;         // vault:笔记/深度工作.md
  tags: string[];
  createdAt: string;          // ISO 8601
  updatedAt: string;
  metadata: Record<string, unknown>; // path / extension / summary / mtime / size…
}

export interface InterestSeedEdge {
  id: string;
  source: string;
  target: string;
  relation: string;           // references / related-to / about / 自定义
  origin: RelationOrigin;
  status: RelationStatus;
  confidence?: number;        // 0–1
  evidence?: string[];        // 「共享标签 #focus」
  userRenamed?: boolean;      // 规则/AI 关系被用户改名后的重扫保护标记
  createdAt: string;
  updatedAt: string;
}

export interface InterestSeedGraph {
  schemaVersion: number;      // 当前为 2
  updatedAt: string;
  nodes: InterestSeedNode[];
  edges: InterestSeedEdge[];
  viewport?: GraphViewport;
}
```

关系语义：

- 同一 `(source, target, relation)` 只有一条边；重复写入会合并 `evidence`，取更大的 `confidence`。
- 状态合并遵循 `confirmed > rejected > suggested`；来源合并遵循 `user > ai > rule`。
- `rejected` 由 `GraphBuilder` 保留为抑制记录，不进入共享标签候选，因此不会被重新生成；删除该边即可重新允许建议。

## GraphStore 接口

`src/core/GraphStore.ts` 先定义接口，再由 `InterestSeedGraphStore` 实现；UI 与控制器依赖接口，写操作统一经过 `GraphSession` 记录撤销。

```ts
export interface GraphStore {
  getGraph(): InterestSeedGraph;
  getNode(id: string): InterestSeedNode | undefined;
  addNode(node: InterestSeedNode): void;
  updateNode(id: string, patch: Partial<InterestSeedNode>): void;
  removeNode(id: string): void;
  addEdge(edge: InterestSeedEdge): void;
  updateEdge(id: string, patch: Partial<InterestSeedEdge>): void;
  removeEdge(id: string): void;
  validate(): string[];
}
```

验收对应关系：

| 要求 | 实现 |
| --- | --- |
| 不允许重复节点 ID | `addNode` 检查 id，抛 `GraphStoreError('duplicate-node')`；同一 `sourceUri` 抛 `duplicate-source`。 |
| 不允许重复关系 ID | `addEdge` 检查显式 id，冲突抛 `duplicate-edge`；`(source,target,relation)` 相同则合并而不是新增。 |
| 关系不能指向不存在的节点 | `addEdge` 校验两端，抛 `missing-node`；`GraphRepository.save` 前再做一次全图校验。 |
| 删除节点同步处理关系 | `removeNode` 遍历邻接索引删除所有关联边；撤销时 `GraphSession` 先恢复节点，再按原值恢复这些边。 |
| 非法数据明确报错 | 所有失败路径抛带 code 的 `GraphStoreError`；`validate()` 返回结构错误列表；读取时 `validateGraph` 报告 issues。 |
| 修改可被撤销记录 | 插件的所有写操作都走 `GraphSession`：addNode / updateNode / removeNode / addEdge / updateEdge / removeEdge 分别记录对应的 apply / revert；`replace` 用于可撤销的整体操作。 |

## 节点类型判定

扫描阶段（`scanMarkdown`）只处理 Markdown，类型来自 MetadataCache：

1. frontmatter `type`（必须是合法 `NodeType`）；
2. frontmatter `project: true` / `activity: true`；
3. 默认 `document`。

手动“从当前文件创建节点”时才会用扩展名补判：`png/jpg/jpeg/gif/webp/svg/bmp` → `image`，`mp3/wav/m4a/ogg/flac` → `audio`，`mp4/mov/webm/mkv/avi` → `video`。

`includeTags` 非空时，只纳入带这些标签之一的 Markdown 笔记。

## 资料读取（ObsidianVaultAdapter）

```ts
export interface VaultScanOptions {
  includeFolders: string[];
  excludeFolders: string[];
  includeTags: string[];
  maxFiles?: number;
}

export interface VaultScanResult {
  nodes: InterestSeedNode[];
  warnings: string[];
  scannedCount: number;
}

export interface ObsidianVaultAdapter {
  scanMarkdown(options: VaultScanOptions): Promise<VaultScanResult>;
  openSource(sourceUri: string): Promise<void>;
}
```

| 要求 | 实现 |
| --- | --- |
| 只用 Vault / MetadataCache API | `vault.getMarkdownFiles()`、`metadataCache.getFileCache()`、`vault.cachedRead()`、`workspace.getLeaf().openFile()`；不拼接绝对路径，不直接用 fs。 |
| 默认只扫描 Markdown | 只遍历 `getMarkdownFiles()`；媒体文件不会被自动扫描。 |
| 排除目录 / 只选项目目录 | `shouldScanPath`：先按 `excludeFolders` 排除，再按 `includeFolders` 白名单（为空表示整个 vault）。 |
| 不扫描 vault 之外 | 所有文件都来自 `TFile` 列表，路径为 vault 相对路径。 |
| 扫描时不修改源笔记 | 只调用 `cachedRead` / MetadataCache，没有任何写操作。 |
| 失败不中断整体扫描 | 每个文件单独 try/catch，错误写入 `warnings`；正文读取失败仍保留该节点。 |

## 图谱构建（GraphBuilder）

```ts
export interface GraphBuildOptions {
  includeFolders: string[];
  includeTags: string[];
  includeOutgoingLinks: boolean;
}

export interface GraphBuilder {
  build(nodes: InterestSeedNode[], options: GraphBuildOptions): InterestSeedGraph;
}
```

`InterestSeedGraphBuilder` 实现该接口，并以“当前图谱”作为基线（构造时传入 getter）：

| 规则 | 实现 |
| --- | --- |
| 稳定来源生成节点 | 有 `sourceUri` 的节点强制使用 `nodeIdForUri(sourceUri)`；重复来源只保留一个并记录 warning。 |
| 解析 Obsidian 内部链接 | 读取 `metadata.links`（来自 MetadataCache），按路径 / 文件名 / 标题解析为 `references`，evidence 记录来源笔记与链接目标。 |
| 关联可追溯 | `references` 记录「笔记《A》中存在链接：[[B]]」；规则边记录共享标签或用户主题匹配；手动边由用户创建。 |
| 不因同目录断言相关 | 构建过程没有任何目录分组逻辑；只有链接、共享标签、用户主题匹配会产生边。 |
| 重复扫描复用 | 以当前图谱为基线：节点复用 `createdAt/updatedAt`（内容未变时连 `updatedAt` 也不变），边按 `(source,target,relation)` 复用 id 与时间戳。 |
| 不删除用户数据 | 无 `sourceUri` 的手动节点始终保留；`confirmed` / `rejected` / `ai` 关系原样保留，包括用户确认过的双链与规则关系。 |

## 候选关系（RelationEngine）

```ts
export interface RelationCandidate {
  edge: InterestSeedEdge;
  reasons: string[];
}

export interface RelationEngine {
  suggest(nodes: InterestSeedNode[]): RelationCandidate[];
}
```

`InterestSeedRelationEngine` 只实现有明确证据的三条规则：

| 规则 | relation | 证据（reasons / evidence） |
| --- | --- | --- |
| 笔记之间存在显式 Obsidian 链接（单向或双向） | `references` | 「笔记《A》中存在链接：[[B]]」 |
| 两篇笔记共享标签 | `related-to` | 「两个笔记具有相同标签：focus」 |
| 笔记匹配用户定义的主题节点 | `about` | 「匹配用户定义主题《Focus》：共享标签 #focus」 |

共享标签候选首版采用工程安全边界：单标签覆盖超过 **500** 个节点时整体跳过；每个标签最多保留 **50** 个 pair；全部 `related-to` 候选最多 **200** 条。显式链接 `references` 与主题 `about` 不受这些预算限制。参数来自 T2-A 的规模基准，用于资源控制，不代表推荐质量最优。

- 用户定义主题 = `type: topic` 且没有 `sourceUri` 的节点；
- 不实现标题相似度、目录推断或语义猜测；没有标签 / 链接 / 主题匹配时不产生候选；
- 节点对已有显式链接时，不再生成标签候选，避免重复关系；
- 候选边统一为 `suggested`，`edge.evidence` 与 `reasons` 一致；构建器负责复用时间戳、保留用户确认 / 拒绝状态；
## 模型接口（ModelProvider，v1 禁用）

```ts
export interface RelationRequest {
  nodes: Array<{ id: string; title: string; tags: string[] }>;
}

export interface ModelProvider {
  isAvailable(): Promise<boolean>;
  suggestRelations(request: RelationRequest): Promise<unknown>;
  dispose(): void;
}
```

- v1 只提供接口与 `DisabledModelProvider`：`isAvailable()` 恒为 `false`，`suggestRelations()` 抛 `disabled` 错误，不读取 API Key、不联网；
- `buildRelationRequest()` 显式挑选 `id / title / tags`，绝不带 `metadata`、摘要、路径、链接或正文；
- 未来启用时必须先展示将发送的字段清单与服务商，并获得用户明确授权；默认只发送最少必要元数据，不发送整份笔记、完整 Vault 或个人记录。

## 界面与交互

| 区域 | 内容 |
| --- | --- |
| 顶部 | 图谱标题 + vault 名、搜索框、目录 / 标签 / 类型 / 来源 / 状态筛选、最低置信度、重新扫描 |
| 中央 | 可缩放 / 平移 / 点击的 Canvas 知识地图；节点位置可拖动并持久化 |
| 侧栏 | 节点标题、类型、来源路径、标签、摘要、元数据、关系列表与每条关系的依据 |
| 关系建议区 | 建议收件箱列出全部待确认关系，含来源、置信度与证据，可确认 / 拒绝并定位节点；已拒绝关系可在详情中恢复为建议 |
| 底部状态栏 | 扫描状态、节点 / 关系 / 建议数量、保存状态、错误原因 |

### 节点类型

- 颜色只从 Obsidian 主题变量读取（`--color-pink / blue / purple / green / yellow / red / cyan`），自动适配浅色与深色模式；
- 除颜色外，画布用不同形状和单字标记区分类型：项目（方块 / 项）、文档（圆形 / 文）、主题（菱形 / 主）、图片 / 音频 / 视频（三角 / 图音视）、活动（六边形 / 活）；
- 详情面板同时显示类型文字，颜色不是唯一信息来源。

### 必须操作

| 操作 | 行为 |
| --- | --- |
| 点击节点 | 打开详情面板 |
| 双击文档节点 / 「打开来源」 | 在 Obsidian 中打开对应笔记 |
| 拖动节点 | 调整布局，位置写入 `metadata.position` 并随图谱保存 |
| 创建关系 | 详情面板「创建关系」→ 选择目标节点 + 填写关系名称，记录为 user / confirmed |
| 删除关系 | 先确认，再通过 `GraphSession` 删除并写入撤销历史 |
| 搜索 | 输入即计时筛选可见节点 |
| 重新扫描 | 弹窗展示包含 / 排除目录、标签过滤、预计读取数量；保留手动节点与已确认 / 拒绝关系 |
| 关闭再打开 | 恢复图谱、关系、视口与节点位置 |

### 空状态与错误

- 空状态文案：`还没有建立地图。` / `选择一个项目目录，开始构建你的第一张知识地图。`，并明确说明“地图只会读取你授权的资料，不会自动上传文件”；
- 错误同时出现在命令反馈与底部状态栏：底部保留最近一次错误与解决办法，保存失败会提示检查磁盘 / 权限、重试保存或创建备份；
- 扫描、保存、存储暂停等状态都在底部状态栏可见，不会只弹一次提示就消失。

## 开发安装

```bash
npm install
npm run build
```

把 `dist/` 里的 `main.js`、`manifest.json`、`styles.css` 复制到：

```
<你的 vault>/.obsidian/plugins/interestseed/
```

然后在 Obsidian 的「第三方插件」中启用 **InterestSeed**。

运行时数据布局（插件目录内）：

```
<Vault>/
└── .obsidian/
    └── plugins/
        └── interestseed/
            ├── main.js
            ├── manifest.json
            ├── styles.css
            ├── data.json          # 设置 / AI 配置 / 数据版本（saveData 管理）
            └── graphs/
                └── default.json   # 图谱：nodes / edges / viewport
```

## 使用

- 左侧 ribbon 的幼苗图标，或命令「打开兴趣图谱」；
- 命令面板：
  - 从仓库重建兴趣图谱
  - 新建节点 / 从当前文件创建节点
  - 刷新规则建议
  - 导出兴趣图谱 JSON
  - AI 关系建议（未启用）
  - 撤销 / 重做图谱操作
  - 重试保存图谱 / 创建图谱备份 / 备份旧数据并重置图谱存储
  - 清空兴趣图谱
- 在 frontmatter 中写 `type: project`（或 `type: topic` 等）即可指定类型；
- 点击节点查看详情，在关系列表里用 ✓ / ✕ 确认或拒绝建议；
- 点击关系行旁的 ✎ 可修改关系名称；关系 ID 保持不变，修改进入撤销历史；
- 点击顶部下载图标或运行「导出兴趣图谱 JSON」，将当前图谱下载为 `interestseed-graph-YYYYMMDD-HHmmss.json`；导出文件是原始图谱结构，不包含额外包装字段；
- 画布的缩放与平移会自动保存。

## 设置

| 设置 | 说明 |
| --- | --- |
| `autoBuildOnOpen` | 打开插件时若图谱为空则自动构建 |
| `includeFolders` | 只扫描这些文件夹，留空表示整个 vault |
| `excludeFolders` | 排除这些文件夹，优先级高于包含 |
| `includeTags` | 只纳入带这些标签之一的 Markdown 笔记 |
| `enableRuleSuggestions` | 是否生成共享标签 / 用户主题建议 |
| `enableAI` / `aiProvider` / `aiConsentGranted` | 保留在设置模型中供未来启用；v1 不提供配置入口，也不会生效 |

数据目录中的 `data.json` 只保存设置与数据版本，不包含任何 AI 凭据。

## 存储与迁移

- **`data.json`**：由 Obsidian 的 `saveData()` 写入插件目录，内容为 `{ schemaVersion, settings, lastRebuiltAt }`；设置模型本身仍来自 `InterestSeedSettings`。
- **`graphs/default.json`**：由 `GraphRepository` 写入，结构为 `schemaVersion / updatedAt / nodes / edges / viewport`；`graphs/` 目录在首次保存时自动创建。仓库的存储 key 是常量 `GRAPH_FILE`，将来要支持多图谱只需换 key（如 `work.json`）。
- 写入使用 `default.json.tmp` → `default.json` 的安全替换，旧版本保留为 `default.json.bak`；读取时按 `default.json` → `.bak` → 旧 `graph.json` 的顺序回退。
- 损坏的图谱会备份为 `graphs/default.json.corrupt-<时间戳>`（冒号已替换为 `-`，兼容 Windows），然后降级为空图谱。
- 旧版本放在插件根目录的 `graph.json` 会在启动时自动 `rename` 到 `graphs/default.json`；若目标已存在则保留旧文件不动，若重命名失败则回退为“复制 + 删除”，仍失败时读取逻辑会兜底读取旧文件，避免数据显示为空。
- 图谱数据自动迁移：
  - v0（数组 `nodes/links`）→ v1；
  - v1（兴趣成熟度模型：`kind/status/weight`）→ v2：`kind note/concept/seed` 映射为 `document/topic/topic`，`manual/wikilink → user`、`tag/similarity → rule`，`weight → confidence`，数字时间戳转 ISO，`tag/similarity` 关系变为 `suggested`。

## 保存与恢复（GraphRepository）

```ts
export interface GraphRepository {
  load(): Promise<InterestSeedGraph>;
  save(graph: InterestSeedGraph): Promise<void>;
  validate(graph: InterestSeedGraph): string[];
  createBackup(): Promise<void>;
}
```

`VaultGraphRepository` 实现该接口；诊断信息通过 `loadDetailed()` / `lastLoadResult` 提供给插件，接口本身保持精简。

| 场景 | 行为 |
| --- | --- |
| 保存失败 | `save` 抛 `GraphRepositoryError`（`invalid-graph` / `serialize-failed` / `blocked`），`PersistenceService` 提示用户：修改仍在内存中，先检查磁盘空间与插件目录权限，再执行「重试保存图谱」；仍失败则执行「创建图谱备份」并查看控制台。 |
| 备份失败 | `createBackup()` 读取失败、无文件或写盘失败都会抛 `backup-failed`，不会静默当作成功；UI 明确提示下一步。 |
| 首次写入 | 文件不存在时直接创建 `graphs/default.json` 与父目录；有首次写入测试。 |
| 损坏恢复 | 解析失败先写 `default.json.corrupt-<时间戳>`；若备份写入失败则进入 blocked，拒绝覆盖原文件。 |
| 迁移恢复 | 迁移前自动备份旧版本；迁移抛错时原文件保持不变并 blocked；只有显式「备份旧数据并重置」才会先备份再解除保护。 |

对应测试：首次写入、`validate()`、`load()` 直接返回图谱、显式备份成功 / 无文件 / 写失败、保存失败保留原文件、损坏与迁移场景下备份失败进入 blocked。

## 开发

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest run（39 个测试文件，419 个用例）
npm run lint        # eslint .
npm run build       # vite build → dist/
npm run dev         # vite build --watch
npm run verify      # 依次执行以上四步
```

核心层（`types` / `core` / `storage` / `utils`）不 import `obsidian`，可以在纯 Node 环境中测试；`adapters`、`ui`、`settings` 负责与 Obsidian 交互。

## 持久化安全

| 要求 | 实现 |
| --- | --- |
| 首次保存前校验结构 | `GraphRepository.save` 先调用 `validateGraphStructure`：节点 id 唯一、类型合法、时间 ISO、关系端点存在、`rule/ai` 必须有 evidence、viewport 数值合法；失败直接抛 `GraphRepositoryError('invalid-graph')`，不触碰文件。 |
| 写入前序列化并校验 JSON | 先 `JSON.stringify`，再 `JSON.parse` round-trip 验证 `nodes / edges` 结构；循环引用或非法序列化抛 `serialize-failed`，旧文件保持不变。 |
| 保存失败保留内存并提示 | `saveGraphNow` 不回滚 store；失败时设置“未保存”状态、状态栏显示 `⚠ 未保存`，并节流提示用户；命令「重试保存图谱」可手动重试。 |
| 临时文件 + 安全替换 | `PluginDataStorage.write`：写 `default.json.tmp` → 读回校验 → 旧文件改名为 `.bak` → `.tmp` 重命名为正式文件；任一步失败都会清理临时文件并尝试还原 `.bak`，读取时依次尝试正式文件、`.bak`、旧 `graph.json`。 |
| 迁移保留旧数据、失败不清空原文件 | 迁移前自动写 `default.json.backup-v<旧版本>-<时间戳>`；迁移抛错时**不修改原文件**，仓库进入 blocked 状态，所有保存被拒绝；只有用户执行「备份旧数据并重置图谱存储」才会先写 `default.json.migration-failed-<时间戳>` 再解除保护。 |
| 布局与关系持久化 | 节点、关系、`viewport` 一起写入 `graphs/default.json`；画布平移 / 缩放去抖保存，关闭视图与卸载插件时再存一次。 |

## 撤销（UndoManager）

```ts
export interface UndoManager {
  execute(label: string, apply: () => void, revert: () => void): void;
  undo(): boolean;
  canUndo(): boolean;
  clear(): void;
}
```

`UndoHistory` 实现该接口（额外提供 redo / 标签 / 订阅），`GraphSession` 负责把编辑动作翻译成 apply / revert：

| 编辑 | 撤销行为 |
| --- | --- |
| 新增节点 | 删除该节点 |
| 删除节点 | 恢复节点及其关联关系 |
| 修改节点信息 | 恢复标题 / 类型 / 标签 / 元数据 |
| 新增关系 | 删除该关系 |
| 删除关系 | 按原值恢复 |
| 修改关系（含确认 / 拒绝候选） | 恢复原状态与字段 |

- 每次 `undo()` 只回退最近一次用户编辑，不读写原始笔记文件；
- 重新扫描 / 刷新建议通过 `GraphSession.apply()` 更新图谱：**不写入撤销历史、不清空历史**，构建器同时保留手动节点与手动 / 已确认关系；
- 「清空图谱」属于用户操作，记录为可撤销的整体替换；
- 测试覆盖：节点增删改、关系增删改、确认/拒绝撤销、重新扫描后历史仍在且 undo 回退的是用户编辑。

## 设计约束

| 约束 | 实现方式 |
| --- | --- |
| 1. id 稳定 | 文件节点 id = `hash64(uri.toLowerCase())`（64 位，降低碰撞）；`InterestSeedGraphBuilder` 用 `sourceUri` 派生 id 并复用已有节点；`GraphStore.addNode` 拒绝重复 `sourceUri`；边 id = `hash64(source + target + relation)`，确认 / 拒绝不改变 id。 |
| 2. 节点与文件分离 | 节点只存 `sourceUri` 与索引元数据（path / extension / size / mtime / summary ≤ 240 字），不存正文；原文始终以文件为准。 |
| 3. 关系标注来源 | `RelationOrigin = user / rule / ai`，`GraphStore` 校验取值；双链标 `user`（用户写在笔记里），共享标签 / 主题匹配标 `rule`，AI 建议标 `ai`。 |
| 4. 自动关系默认 suggested | 扫描生成的双链、规则建议都是 `suggested`；只有用户点击 ✓ 才写 `confirmed`，手动创建的关系直接 `confirmed`。 |
| 5. 拒绝不复发 | `rejected` 边保留并参与“已连接”判断；`infer` 只清理 `rule + suggested`；重建时 `InterestSeedGraphBuilder` 原样保留 rejected，因此同一条建议不会自动重生。 |
| 6. evidence 解释原因 | 规则：`两个笔记具有相同标签：无人机`、`匹配用户定义主题《Focus》：共享标签 #focus`；双链：`笔记《A》中存在链接：[[B]]`。`GraphStore.addEdge` 对 `rule` / `ai` 边强制要求非空 evidence，校验器也会对缺失 evidence 的关系报告问题。 |
| 7. ISO 8601 | 节点、边、图谱、洞察、文件 mtime 全部用 `toISOString()`；迁移把数字时间戳转 ISO；备份文件名把 `:` 换成 `-` 以兼容 Windows。 |
| 8. 版本与迁移 | `schemaVersion` 当前为 2；`MigrationManager` 支持 v0 → v1 → v2，拒绝高于插件支持的版本，并在 `GraphRepository.load` 中自动执行。 |

## 已知限制

- frontmatter 只解析常见子集（标量、行内数组、块数组），不支持嵌套 YAML；
- 候选规则只覆盖显式链接、共享标签与用户主题；语义相关需要手动连边或未来的 AI 提示；
- 最小发现只支持“跨目录共享标签 + 已确认关系证据”，不包含语义相似或正文分析；顶层目录只是推定分组；“应用到图谱”必须由用户在接受后通过独立确认界面选择源、目标、方向和关系名。
- 规则建议关系被用户改名后，重扫通过 `userRenamed` 标记与原候选 ID 识别并保留用户名称；若规则候选仍出现，会提示“已保留你的名称”，不会覆盖或新增重复关系；改回原始规则名后保护标记清除；
- 大图（> 1200 节点）的斥力使用网格近似，布局质量略低于精确计算；
- v1 未启用 AI：接口与禁用状态已就绪，启用前必须先做字段披露与明确授权；

## License

MIT

## AI 后端与 Agent Skills

Obsidian 核心没有公开的原生生成式 AI API。InterestSeed 支持两种可选后端：

- **本地 OpenAI-compatible**：Ollama、LM Studio 或自建网关；
- **Claudian 插件 API（实验）**：复用已安装 Claudian 的 Claude/Codex/OpenCode 会话，不需要把模型密钥写进本插件。

AI 默认关闭，必须同时启用 AI 并确认数据边界；只发送匿名化主题/项目别名、聚合计数和活动数据，不发送正文、路径或原始证据。

开发与验证可使用 [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) 中的 `obsidian-cli` skill（reload、dev:errors、dev:screenshot、DOM/CSS 检查）。仓库研究记录见：

```text
GITHUB_SKILLS_RESEARCH.md
```
## DSH Agent 工作台

InterestSeed 现在有一个独立的 Agent 视图（命令：`打开 InterestSeed Agent（DSH）`），通过 DSH 的 ACP profile 启动嵌入式 Agent：

```text
InterestSeed UI
→ dsh --profile acp
→ ACP v1
→ DSH 的模型、工具、沙箱、权限
```

它支持：

- 流式助手消息；
- DSH 工具调用状态；
- DSH 权限请求卡片；
- 停止与新建会话；
- 会话中直接读取当前 Vault。

设置：`DSH Agent 工作台（桌面）` → 启用 → 填写 DSH 命令（当前机器示例：`D:\dsh\resources\runtime\cli\bin\dsh.cmd`）→ profile 默认 `acp`，模型默认 `deepseek-account/deepseek-flash`（使用 DSH 自己的凭据，不复制到插件）。

DSH 自己负责模型与凭据；InterestSeed 不保存 DSH/模型密钥。没有配置 DSH 模型时，ACP 会话会返回明确的 provider/key 错误，本地图谱与探索不会受影响。
### Obsidian CLI

设置 → `DSH Agent 工作台` → `安装 / 启用 Obsidian CLI` 会调用 Obsidian 官方的 CLI 注册流程；终端重启后可使用：

```bash
obsidian plugin:reload id=interestseed
obsidian dev:errors
obsidian dev:screenshot path=screenshot.png
```
## 主页面视觉入口

InterestSeed 主页面现在有统一的工作台头部与可视化入口：

```text
Agent       让 DSH 读取、整理并推进下一步
兴趣探索    主题、项目矩阵与趋势
发现        建议、反馈与应用
总览        整体结构与节奏
```

下方快捷条保留扫描、节点、建议、收件、撤销/重做、适应、导出等高频动作；空状态也提供「打开 Agent / 问 Agent」入口。
## 一键部署

```bash
npm run deploy
```

`scripts/deploy.ps1` 会先跑 `verify`，失败就中止，不会把未通过测试的构建复制到 Vault；通过后同步 `main.js`、`styles.css`、`manifest.json` 并重建 release zip。