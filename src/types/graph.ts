/**
 * InterestSeed 领域模型 v2。
 *
 * 这一层不依赖 Obsidian API：core / storage 可以在任何 JavaScript 运行时中
 * 测试。所有时间戳都是 ISO 8601 字符串，方便直接序列化与跨设备同步。
 *
 * 与 v1 的区别：
 * - 节点使用 `type`（项目 / 文档 / 主题 / 图片 / 音频 / 视频 / 活动）而不是兴趣成熟度；
 * - 关系来源收敛为 user / rule / ai，并引入 confirmed / suggested / rejected 状态；
 * - 图结构使用数组，便于 JSON 存储与外部工具消费；
 * - 视口（缩放 / 平移）随图谱一起持久化。
 */

export const GRAPH_SCHEMA_VERSION = 2;

export type NodeType =
  | "project"
  | "document"
  | "topic"
  | "image"
  | "audio"
  | "video"
  | "activity";

export type RelationOrigin =
  | "user"
  | "rule"
  | "ai";

export type RelationStatus =
  | "confirmed"
  | "suggested"
  | "rejected";

export interface InterestSeedNode {
  id: string;
  type: NodeType;
  title: string;
  sourceUri?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface InterestSeedEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  origin: RelationOrigin;
  status: RelationStatus;
  confidence?: number;
  evidence?: string[];
  /** 规则/AI 关系被用户改名后置为 true；用于重扫保护，旧数据可缺省。 */
  userRenamed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GraphViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface InterestSeedGraph {
  schemaVersion: number;
  updatedAt: string;
  nodes: InterestSeedNode[];
  edges: InterestSeedEdge[];
  viewport?: GraphViewport;
}

export interface InterestSeedSettings {
  autoBuildOnOpen: boolean;
  includeFolders: string[];
  excludeFolders: string[];
  includeTags: string[];
  enableRuleSuggestions: boolean;
  enableAI: boolean;
  aiProvider: string;
  aiBaseUrl: string;
  aiModel: string;
  aiConsentGranted: boolean;
  agentMode: 'qwen' | 'dsh';
  enableDshAgent: boolean;
  dshCommand: string;
  dshProfile: string;
  dshModel: string;
}

export const NODE_TYPES: readonly NodeType[] = [
  "project",
  "document",
  "topic",
  "image",
  "audio",
  "video",
  "activity",
];

export const RELATION_ORIGINS: readonly RelationOrigin[] = ["user", "rule", "ai"];

export const RELATION_STATUSES: readonly RelationStatus[] = [
  "confirmed",
  "suggested",
  "rejected",
];

export function isNodeType(value: unknown): value is NodeType {
  return typeof value === "string" && (NODE_TYPES as readonly string[]).includes(value);
}

export function isRelationOrigin(value: unknown): value is RelationOrigin {
  return (
    typeof value === "string" && (RELATION_ORIGINS as readonly string[]).includes(value)
  );
}

export function isRelationStatus(value: unknown): value is RelationStatus {
  return (
    typeof value === "string" && (RELATION_STATUSES as readonly string[]).includes(value)
  );
}

export function emptyGraph(now: string): InterestSeedGraph {
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    updatedAt: now,
    nodes: [],
    edges: [],
  };
}
