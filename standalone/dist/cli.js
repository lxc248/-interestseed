#!/usr/bin/env node
import { existsSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
//#region src/utils/text.ts
/** 确定性字典序比较，避免依赖 locale。 */
function compareText(left, right) {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}
//#endregion
//#region src/services/ModelProvider.ts
var ModelProviderError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "ModelProviderError";
	}
};
var DEEPSEEK_V4_PRO_CONFIG = {
	displayName: "Local model",
	model: "cn:deepseek-v4-pro",
	baseUrl: "http://localhost:7863/v1",
	protocol: "openai-chat-completions"
};
function localModelConfig(model, baseUrl) {
	return {
		...DEEPSEEK_V4_PRO_CONFIG,
		model: model?.trim() || "cn:deepseek-v4.1-flash",
		baseUrl: baseUrl?.trim() || DEEPSEEK_V4_PRO_CONFIG.baseUrl
	};
}
var AI_ENABLEMENT_NOTICE = "AI 关系建议当前不可用。请在设置中检查模型服务、启用状态与明确授权；只会发送节点 id、标题、标签，不会发送笔记正文、完整 Vault 或个人记录。";
/**
* 第一版只有禁用实现：不读取 API Key、不发起网络请求。
*/
var DisabledModelProvider = class {
	reason;
	constructor(reason = AI_ENABLEMENT_NOTICE) {
		this.reason = reason;
	}
	async isAvailable() {
		return false;
	}
	async suggestRelations(_request) {
		throw new ModelProviderError("disabled", this.reason);
	}
	dispose() {}
};
/**
* 从现有本地环境读取密钥；不写入设置、不记录、不输出。
* 本地服务如果不需要认证，可以没有该变量。
*/
function resolveLocalApiKey() {
	const value = (globalThis.process?.env)?.INTERESTSEED_AI_API_KEY;
	return value && value.trim() ? value.trim() : void 0;
}
/**
* OpenAI 兼容 Chat Completions 适配器。
*
* 只在用户明确启用并授权后创建。没有自动重试、没有模型切换；
* 网络/HTTP/响应异常直接抛错，由调用方回退到本地规则发现。
*/
var OpenAICompatibleModelProvider = class {
	config;
	fetchImpl;
	apiKey;
	disposed = false;
	abortControllers = /* @__PURE__ */ new Set();
	constructor(config = DEEPSEEK_V4_PRO_CONFIG, fetchImpl = (input, init) => fetch(input, init), apiKey = resolveLocalApiKey()) {
		this.config = config;
		this.fetchImpl = fetchImpl;
		this.apiKey = apiKey;
	}
	async isAvailable() {
		return !this.disposed && typeof this.fetchImpl === "function";
	}
	async suggestRelations(request) {
		if (this.disposed) throw new ModelProviderError("disabled", "AI 服务已释放");
		const safeRequest = sanitizeRelationRequest(request);
		const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
		const headers = { "Content-Type": "application/json" };
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
		const maxSuggestions = safeRequest.maxSuggestions ?? 5;
		let response;
		try {
			response = await this.fetchImpl(url, {
				method: "POST",
				headers,
				body: JSON.stringify({
					model: this.config.model,
					messages: [{
						role: "system",
						content: `You are a careful interest cartographer. Suggest at most ${maxSuggestions} connections that are non-obvious but defensible from shared tags or complementary titles. Avoid every pair listed in existingEdges. Prefer one bridge, orphan, or cross-project link over many weak links. If focusNodeId is set, every suggestion must include that node. No self-loops, no duplicate pairs. Return exactly one JSON object. No prose, no Markdown, no code fences. Shape: {"suggestions":[{"source":"<node id>","target":"<node id>","relation":"<short relation>","reason":"<one concrete sentence citing a shared tag or title>","confidence":0.0}]}. confidence must be between 0 and 1. reason must be at most 120 characters. Use only node ids supplied by the user. Return {"suggestions":[]} if nothing is supported. Do not invent evidence or facts.`
					}, {
						role: "user",
						content: "Input JSON:\n" + JSON.stringify(safeRequest) + "\nReturn only the JSON object described in the system message."
					}],
					temperature: 0,
					stream: false,
					response_format: { type: "json_object" }
				})
			});
		} catch {
			throw new ModelProviderError("network", "AI 本地服务不可用");
		}
		if (!response.ok) throw new ModelProviderError("http", `AI 服务返回 HTTP ${response.status}`);
		let payload;
		try {
			payload = await response.json();
		} catch {
			throw new ModelProviderError("invalid-response", "AI 服务返回非 JSON");
		}
		const content = extractContent(payload);
		if (content === null) throw new ModelProviderError("invalid-response", "AI 服务返回结构无效");
		return parseSuggestionPayload(content, new Set(safeRequest.nodes.map((node) => node.id)), safeRequest.nodes);
	}
	async explore(request) {
		if (this.disposed) throw new ModelProviderError("disabled", "AI 服务已释放");
		const safeRequest = sanitizeExplorationRequest(request);
		const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
		const headers = { "Content-Type": "application/json" };
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
		const controller = new AbortController();
		let timedOut = false;
		this.abortControllers.add(controller);
		const timeout = globalThis.setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, 3e4);
		try {
			const response = await this.fetchImpl(url, {
				method: "POST",
				headers,
				signal: controller.signal,
				body: JSON.stringify({
					model: this.config.model,
					messages: [{
						role: "system",
						content: "Return exactly one JSON object. No prose, no Markdown, no code fences. Shape: {\"summary\":\"<short Chinese summary>\",\"confidence\":0.0,\"reasoning\":[\"<observation>\",\"<inference>\",\"<action>\"],\"opportunities\":[{\"title\":\"<short title>\",\"why\":\"<why supported by aggregate counts>\",\"nextStep\":\"<concrete next action>\",\"themes\":[\"<theme alias>\"],\"evidence\":[\"<count or spread from input>\"],\"confidence\":0.0}]}. Use only aggregate themes, projects and counts supplied by the user. Every opportunity must cite at least one numeric observation from the input in evidence. Do not invent facts, note content, sources or causes. If evidence is insufficient, return a cautious summary, confidence below 0.5, and 0-2 opportunities."
					}, {
						role: "user",
						content: "Analyze this aggregated interest data. Return exactly one JSON object with the required shape:\n" + JSON.stringify(safeRequest)
					}],
					temperature: .2,
					stream: false,
					response_format: { type: "json_object" }
				})
			});
			if (!response.ok) throw new ModelProviderError("http", `AI 服务返回 HTTP ${response.status}`);
			let payload;
			try {
				payload = await response.json();
			} catch {
				throw new ModelProviderError("invalid-response", "AI 服务返回非 JSON");
			}
			const content = extractContent(payload);
			if (content === null) throw new ModelProviderError("invalid-response", "AI 服务返回结构无效");
			return parseExplorationInsight(content, new Set(safeRequest.themes.map((theme) => theme.key)));
		} catch (error) {
			if (error instanceof ModelProviderError) throw error;
			if (timedOut) throw new ModelProviderError("timeout", "AI 请求超时，请稍后重试");
			if (controller.signal.aborted) throw new ModelProviderError("aborted", "AI 请求已取消");
			throw new ModelProviderError("network", "AI 本地服务不可达");
		} finally {
			globalThis.clearTimeout(timeout);
			this.abortControllers.delete(controller);
		}
	}
	dispose() {
		this.disposed = true;
		for (const controller of this.abortControllers) controller.abort();
		this.abortControllers.clear();
	}
};
function extractContent(payload) {
	if (typeof payload !== "object" || payload === null) return null;
	const choices = payload.choices;
	if (!Array.isArray(choices) || choices.length === 0) return null;
	const first = choices[0];
	if (typeof first !== "object" || first === null) return null;
	const message = first.message;
	if (typeof message !== "object" || message === null) return null;
	const content = message.content;
	return typeof content === "string" && content.trim() ? content : null;
}
function parseSuggestionPayload(content, allowedNodeIds, nodes = []) {
	let text = content.trim();
	const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
	if (fence) text = fence[1].trim();
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new ModelProviderError("invalid-response", "AI 返回内容不是 JSON");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new ModelProviderError("invalid-response", "AI 返回内容不是 JSON 对象");
	const suggestions = parsed.suggestions;
	if (!Array.isArray(suggestions)) throw new ModelProviderError("invalid-response", "AI 返回缺少 suggestions 数组");
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const normalized = [];
	for (const item of suggestions) {
		if (typeof item !== "object" || item === null) continue;
		const record = item;
		const source = readStringField(record, [
			"source",
			"sourceId",
			"from",
			"fromId"
		]);
		const target = readStringField(record, [
			"target",
			"targetId",
			"to",
			"toId"
		]);
		if (!source || !target) continue;
		if (source === target) continue;
		if (!allowedNodeIds.has(source) || !allowedNodeIds.has(target)) continue;
		const relation = readStringField(record, [
			"relation",
			"label",
			"type",
			"name"
		]) ?? deriveRelation(source, target, byId);
		const reason = readStringField(record, [
			"reason",
			"why",
			"explanation"
		]);
		const confidence = readNumberField(record, ["confidence", "score"]);
		normalized.push({
			source,
			target,
			relation: relation.slice(0, 120),
			...reason ? { reason: reason.slice(0, 160) } : {},
			...confidence === null ? {} : { confidence: Math.max(0, Math.min(1, confidence)) }
		});
	}
	const seenPairs = /* @__PURE__ */ new Set();
	const deduped = [];
	for (const item of normalized) {
		const pair = [item.source, item.target].sort().join("\0");
		if (seenPairs.has(pair)) continue;
		seenPairs.add(pair);
		deduped.push(item);
		if (deduped.length >= 8) break;
	}
	return { suggestions: deduped };
}
function readStringField(record, keys) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}
function readNumberField(record, keys) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
	}
	return null;
}
function deriveRelation(source, target, byId) {
	const sourceTags = new Set((byId.get(source)?.tags ?? []).map((tag) => tag.toLowerCase()));
	const shared = (byId.get(target)?.tags ?? []).find((tag) => sourceTags.has(tag.toLowerCase()));
	return shared ? `共享 ${shared}` : "相关";
}
/**
* 构造最小但有用的请求：
* - 有焦点节点时，优先发送共享标签的候选；
* - 无焦点时，优先发送孤立 / 低度数节点，避免只围绕中心节点打转；
* - 只发送已有关系的 id 对，帮助模型避开重复建议。
*/
function buildRelationRequest(nodes, options = {}) {
	const maxNodes = Math.max(8, Math.min(48, options.maxNodes ?? 32));
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const focus = options.focusNodeId ? byId.get(options.focusNodeId) : void 0;
	const degree = /* @__PURE__ */ new Map();
	for (const edge of options.existingEdges ?? []) {
		degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
		degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
	}
	let selected;
	if (focus) {
		const focusTags = new Set(focus.tags.map((tag) => tag.toLowerCase()));
		selected = [focus, ...nodes.filter((node) => node.id !== focus.id).sort((left, right) => {
			const leftShared = left.tags.filter((tag) => focusTags.has(tag.toLowerCase())).length;
			return right.tags.filter((tag) => focusTags.has(tag.toLowerCase())).length - leftShared || (degree.get(left.id) ?? 0) - (degree.get(right.id) ?? 0) || compareText(left.title, right.title);
		})];
	} else selected = [...nodes].sort((left, right) => (degree.get(left.id) ?? 0) - (degree.get(right.id) ?? 0) || right.tags.length - left.tags.length || compareText(left.title, right.title));
	selected = selected.slice(0, maxNodes);
	const selectedIds = new Set(selected.map((node) => node.id));
	const seenPairs = /* @__PURE__ */ new Set();
	const existingEdges = [];
	for (const edge of options.existingEdges ?? []) {
		if (!selectedIds.has(edge.source) || !selectedIds.has(edge.target)) continue;
		const pair = [edge.source, edge.target].sort().join("\0");
		if (seenPairs.has(pair)) continue;
		seenPairs.add(pair);
		existingEdges.push({
			source: edge.source,
			target: edge.target
		});
		if (existingEdges.length >= 160) break;
	}
	return {
		...focus ? { focusNodeId: focus.id } : {},
		nodes: selected.map((node) => ({
			id: node.id,
			title: node.title,
			tags: [...node.tags]
		})),
		...existingEdges.length > 0 ? { existingEdges } : {},
		maxSuggestions: Math.max(1, Math.min(8, options.maxSuggestions ?? 5))
	};
}
/** 运行时白名单重建，避免调用方通过额外属性绕过 DTO 字段约束。 */
function sanitizeRelationRequest(input) {
	if (!input || !Array.isArray(input.nodes)) throw new ModelProviderError("invalid-request", "AI 请求无效");
	const nodes = input.nodes.map((node) => {
		if (typeof node !== "object" || node === null || typeof node.id !== "string" || typeof node.title !== "string" || !Array.isArray(node.tags) || !node.tags.every((tag) => typeof tag === "string")) throw new ModelProviderError("invalid-request", "AI 请求节点字段无效");
		return {
			id: node.id,
			title: node.title,
			tags: [...node.tags]
		};
	});
	const nodeIds = new Set(nodes.map((node) => node.id));
	const focusNodeId = typeof input.focusNodeId === "string" && nodeIds.has(input.focusNodeId) ? input.focusNodeId : void 0;
	const seenPairs = /* @__PURE__ */ new Set();
	const existingEdges = [];
	for (const edge of Array.isArray(input.existingEdges) ? input.existingEdges : []) {
		if (typeof edge?.source !== "string" || typeof edge?.target !== "string" || !nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) continue;
		const pair = [edge.source, edge.target].sort().join("\0");
		if (seenPairs.has(pair)) continue;
		seenPairs.add(pair);
		existingEdges.push({
			source: edge.source,
			target: edge.target
		});
		if (existingEdges.length >= 160) break;
	}
	const rawMax = typeof input.maxSuggestions === "number" && Number.isFinite(input.maxSuggestions) ? Math.floor(input.maxSuggestions) : 5;
	const maxSuggestions = Math.max(1, Math.min(8, rawMax));
	return {
		...focusNodeId ? { focusNodeId } : {},
		nodes,
		...existingEdges.length > 0 ? { existingEdges } : {},
		maxSuggestions
	};
}
function clampNumber(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}
function countNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
function sanitizeExplorationRequest(input) {
	if (!input || !Array.isArray(input.themes) || !Array.isArray(input.projects) || !Array.isArray(input.activity)) throw new ModelProviderError("invalid-request", "AI 探索请求无效");
	return {
		themes: input.themes.slice(0, 20).map((item) => {
			if (typeof item?.key !== "string" || typeof item.active !== "number" || typeof item.total !== "number") throw new ModelProviderError("invalid-request", "AI 主题字段无效");
			return {
				key: item.key.slice(0, 80),
				active: countNumber(item.active),
				total: countNumber(item.total),
				projectCount: countNumber(item.projectCount),
				acceptanceRate: clampNumber(item.acceptanceRate ?? 0),
				signal: clampNumber(item.signal ?? 0)
			};
		}),
		projects: input.projects.filter((item) => typeof item === "string" && Boolean(item.trim())).slice(0, 30).map((item) => item.slice(0, 80)),
		activity: input.activity.slice(-14).map((item) => {
			if (typeof item?.date !== "string" || typeof item.count !== "number") throw new ModelProviderError("invalid-request", "AI 活动字段无效");
			return {
				date: item.date.slice(0, 20),
				count: countNumber(item.count)
			};
		})
	};
}
/** 只接受完整 JSON 或完整代码围栏，避免从解释文本中猜测 JSON。 */
function parseExplorationInsight(content, allowedThemes) {
	let text = content.trim();
	const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
	if (fence) text = fence[1].trim();
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new ModelProviderError("invalid-response", "AI 返回内容不是 JSON");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new ModelProviderError("invalid-response", "AI 返回内容不是对象");
	const summary = parsed.summary;
	const opportunities = parsed.opportunities;
	const summaryText = typeof summary === "string" ? summary.trim() : "";
	if (!summaryText || summaryText.length > 1200) throw new ModelProviderError("invalid-response", "AI 总结缺失或过长");
	if (!Array.isArray(opportunities) || opportunities.length > 8) throw new ModelProviderError("invalid-response", "AI 机会列表无效");
	const reasoningRaw = parsed.reasoning;
	const reasoning = Array.isArray(reasoningRaw) ? reasoningRaw.filter((value) => typeof value === "string").map((value) => value.trim().slice(0, 300)).filter(Boolean).slice(0, 5) : [];
	const confidenceRaw = parsed.confidence;
	const confidence = typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw) : .5;
	return {
		summary: summaryText,
		reasoning,
		confidence,
		opportunities: opportunities.map((item) => {
			if (typeof item !== "object" || item === null) throw new ModelProviderError("invalid-response", "AI 机会项无效");
			const title = item.title;
			const why = item.why;
			const nextStep = item.nextStep;
			const themeList = item.themes;
			if (typeof title !== "string" || typeof why !== "string" || typeof nextStep !== "string" || !title.trim() || !why.trim() || !nextStep.trim() || !Array.isArray(themeList) || !themeList.every((value) => typeof value === "string")) throw new ModelProviderError("invalid-response", "AI 机会字段无效");
			const evidenceRaw = item.evidence;
			const evidence = Array.isArray(evidenceRaw) ? evidenceRaw.filter((value) => typeof value === "string").map((value) => value.trim().slice(0, 200)).filter(Boolean).slice(0, 5) : [];
			const itemConfidenceRaw = item.confidence;
			return {
				title: title.trim().slice(0, 120),
				why: why.trim().slice(0, 500),
				nextStep: nextStep.trim().slice(0, 300),
				themes: themeList.filter((value) => typeof value === "string").map((value) => value.trim()).filter((value) => Boolean(value) && (!allowedThemes || allowedThemes.has(value))).slice(0, 12),
				evidence,
				confidence: typeof itemConfidenceRaw === "number" && Number.isFinite(itemConfidenceRaw) ? clampNumber(itemConfidenceRaw) : confidence
			};
		})
	};
}
/**
* 低层默认禁用；应用设置默认启用并向这里传入 enableAI/consent。
* 只有 enableAI 与 aiConsentGranted 同时为 true 才创建适配器。
*/
function createModelProvider(settings = {
	enableAI: false,
	aiConsentGranted: false
}, requestImpl, apiKey = resolveLocalApiKey()) {
	if (!settings.enableAI || !settings.aiConsentGranted) return new DisabledModelProvider();
	return new OpenAICompatibleModelProvider(localModelConfig(settings.model, settings.baseUrl), requestImpl ?? ((input, init) => fetch(input, init)), apiKey);
}
//#endregion
//#region src/utils/ids.ts
var sequence = 0;
/**
* 生成带前缀的唯一 id。时间戳保证跨会话不重复，自增序号保证同毫秒内不重复。
*/
function createId(prefix = "id") {
	sequence = (sequence + 1) % 16777215;
	const time = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
	return `${prefix}_${time}${sequence.toString(36)}${random}`;
}
/** FNV-1a 32 位哈希，输出 base36。 */
function hashString(input) {
	let hash = 2166136261;
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return hash.toString(36);
}
/**
* 64 位级哈希（两个独立 FNV 变体拼接）。
*
* 节点和关系 id 都依赖它：32 位哈希在几千个节点的规模下碰撞概率约 0.3%，
* 一旦碰撞会导致节点被覆盖或关系 id 冲突，所以这里用两路 32 位结果拼成
* 约 14 位 base36，碰撞概率降到可忽略。
*/
function hash64(input) {
	let left = 2166136261;
	let right = 3266489909;
	for (let index = 0; index < input.length; index += 1) {
		const code = input.charCodeAt(index);
		left = Math.imul(left ^ code, 16777619) >>> 0;
		right = Math.imul(right ^ code + 2654435769, 2246822507) >>> 0;
	}
	return `${left.toString(36).padStart(7, "0")}${right.toString(36).padStart(7, "0")}`;
}
/**
* 来自 vault 文件的节点使用稳定 id：同一个 uri 永远得到同一个 id，
* 因此重复扫描会命中 upsert 而不是创建新节点。
*/
function nodeIdForUri(uri) {
	return `node_${hash64(uri.toLowerCase())}`;
}
/**
* 关系的确定性 id：由 source、target、relation 共同决定。
* 重复推断不会产生重复边；状态变化（suggested → confirmed）不改变 id。
*/
function edgeIdFor(source, target, relation) {
	return `edge_${hash64(`${relation}\u0000${source}\u0000${target}`)}`;
}
var NODE_TYPES = [
	"project",
	"document",
	"topic",
	"image",
	"audio",
	"video",
	"activity"
];
var RELATION_ORIGINS = [
	"user",
	"rule",
	"ai"
];
var RELATION_STATUSES = [
	"confirmed",
	"suggested",
	"rejected"
];
function isNodeType(value) {
	return typeof value === "string" && NODE_TYPES.includes(value);
}
function isRelationOrigin(value) {
	return typeof value === "string" && RELATION_ORIGINS.includes(value);
}
function isRelationStatus(value) {
	return typeof value === "string" && RELATION_STATUSES.includes(value);
}
function emptyGraph(now) {
	return {
		schemaVersion: 2,
		updatedAt: now,
		nodes: [],
		edges: []
	};
}
//#endregion
//#region standalone/src/state.ts
var STATE_DIR = ".interestseed";
var STATE_FILE = "state.json";
var CONFIG_FILE = "config.json";
var DEFAULT_CONFIG = {
	includeFolders: [],
	excludeFolders: [
		".obsidian",
		".trash",
		".interestseed",
		"node_modules"
	],
	includeTags: [],
	model: "cn:deepseek-v4.1-flash",
	baseUrl: "http://localhost:7863/v1",
	keyEnv: "INTERESTSEED_AI_API_KEY",
	enableAI: true,
	aiConsentGranted: true
};
function stateDir(vaultPath) {
	return join(vaultPath, STATE_DIR);
}
function statePath(vaultPath) {
	return join(stateDir(vaultPath), STATE_FILE);
}
function configPath(vaultPath) {
	return join(stateDir(vaultPath), CONFIG_FILE);
}
async function ensureStateDir(vaultPath) {
	await mkdir(stateDir(vaultPath), { recursive: true });
}
async function loadConfig(vaultPath) {
	const path = configPath(vaultPath);
	if (!existsSync(path)) return { ...DEFAULT_CONFIG };
	const raw = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
	const parsed = JSON.parse(raw);
	return {
		...DEFAULT_CONFIG,
		...parsed,
		includeFolders: Array.isArray(parsed.includeFolders) ? parsed.includeFolders : DEFAULT_CONFIG.includeFolders,
		excludeFolders: Array.isArray(parsed.excludeFolders) ? parsed.excludeFolders : DEFAULT_CONFIG.excludeFolders,
		includeTags: Array.isArray(parsed.includeTags) ? parsed.includeTags : DEFAULT_CONFIG.includeTags,
		enableAI: typeof parsed.enableAI === "boolean" ? parsed.enableAI : DEFAULT_CONFIG.enableAI,
		aiConsentGranted: typeof parsed.aiConsentGranted === "boolean" ? parsed.aiConsentGranted : DEFAULT_CONFIG.aiConsentGranted
	};
}
async function saveConfig(vaultPath, config) {
	await ensureStateDir(vaultPath);
	await writeJson(configPath(vaultPath), config);
}
async function loadState(vaultPath) {
	const path = statePath(vaultPath);
	if (!existsSync(path)) return {
		schemaVersion: 1,
		updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		graph: emptyGraph((/* @__PURE__ */ new Date()).toISOString())
	};
	const raw = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
	const parsed = JSON.parse(raw);
	if (!parsed.graph || !Array.isArray(parsed.graph.nodes) || !Array.isArray(parsed.graph.edges)) throw new Error(`Invalid InterestSeed state: ${path}`);
	return {
		schemaVersion: 1,
		updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : (/* @__PURE__ */ new Date()).toISOString(),
		graph: parsed.graph
	};
}
async function saveGraph(vaultPath, graph) {
	await ensureStateDir(vaultPath);
	const state = {
		schemaVersion: 1,
		updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		graph
	};
	await writeJson(statePath(vaultPath), state);
}
var HISTORY_FILE = "history.json";
async function snapshotGraph(vaultPath) {
	const state = await loadState(vaultPath);
	const path = join(stateDir(vaultPath), HISTORY_FILE);
	let history = [];
	if (existsSync(path)) {
		const raw = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) history = parsed;
	}
	history = [...history, state.graph].slice(-30);
	await writeJson(path, history);
}
async function undoGraph(vaultPath) {
	const path = join(stateDir(vaultPath), HISTORY_FILE);
	if (!existsSync(path)) return null;
	const raw = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed) || parsed.length === 0) return null;
	const history = parsed;
	const previous = history.pop();
	await writeJson(path, history);
	await saveGraph(vaultPath, previous);
	return previous;
}
async function writeJson(path, value) {
	const temp = `${path}.tmp`;
	await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	await rename(temp, path);
}
//#endregion
//#region standalone/src/ai.ts
async function resolveApiKey(vaultPath, config) {
	const envValue = process.env[config.keyEnv];
	if (envValue?.trim()) return envValue.trim();
	const local = join(vaultPath, ".interestseed", "key");
	if (existsSync(local)) {
		const value = (await readFile(local, "utf8")).trim();
		if (value) return value;
	}
}
async function suggestRelations(vaultPath, focusNodeId) {
	const config = await loadConfig(vaultPath);
	const state = await loadState(vaultPath);
	const key = await resolveApiKey(vaultPath, config);
	if (!key) throw new Error(`Missing API key. Set ${config.keyEnv} or write .interestseed/key.`);
	if (!config.enableAI) throw new Error("AI 已关闭，请先在设置里启用。");
	if (!config.aiConsentGranted) throw new Error("还没有确认 AI 请求边界，请先在设置里同意。");
	const request = buildRelationRequest(state.graph.nodes, {
		focusNodeId,
		existingEdges: state.graph.edges.map((edge) => ({
			source: edge.source,
			target: edge.target
		})),
		maxSuggestions: 5
	});
	const provider = createModelProvider({
		enableAI: config.enableAI,
		aiConsentGranted: config.aiConsentGranted,
		model: config.model,
		baseUrl: config.baseUrl
	}, void 0, key);
	try {
		return (await provider.suggestRelations(request)).suggestions ?? [];
	} finally {
		provider.dispose();
	}
}
async function connectSuggestion(vaultPath, suggestion) {
	const graph = (await loadState(vaultPath)).graph;
	const source = graph.nodes.find((node) => node.id === suggestion.source);
	const target = graph.nodes.find((node) => node.id === suggestion.target);
	if (!source || !target) return {
		ok: false,
		message: "Source or target node is missing."
	};
	if (source.id === target.id) return {
		ok: false,
		message: "Self-loops are not supported."
	};
	const relation = suggestion.relation.trim();
	if (!relation) return {
		ok: false,
		message: "Relation name is empty."
	};
	if (graph.edges.some((edge) => edge.source === source.id && edge.target === target.id || edge.source === target.id && edge.target === source.id)) return {
		ok: false,
		message: "This pair is already connected."
	};
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const edge = {
		id: edgeIdFor(source.id, target.id, relation),
		source: source.id,
		target: target.id,
		relation,
		origin: "ai",
		status: "confirmed",
		...typeof suggestion.confidence === "number" ? { confidence: suggestion.confidence } : {},
		evidence: suggestion.reason ? [`AI 建议：${suggestion.reason.slice(0, 160)}`, "用户确认"] : ["AI 建议，用户确认"],
		createdAt: now,
		updatedAt: now
	};
	const next = {
		...graph,
		edges: [...graph.edges, edge],
		updatedAt: now
	};
	await snapshotGraph(vaultPath);
	await saveGraph(vaultPath, next);
	return {
		ok: true,
		edge
	};
}
//#endregion
//#region src/utils/paths.ts
/**
* 仓库路径工具。内部统一使用 POSIX 风格、无前导斜杠的相对路径。
*/
var VAULT_URI_SCHEME = "vault:";
function normalizePath(input) {
	const unix = (input ?? "").replace(/\\/g, "/");
	const parts = [];
	for (const part of unix.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			parts.pop();
			continue;
		}
		parts.push(part);
	}
	return parts.join("/");
}
/**
* sourceUri can be a vault path or an external URL. `normalizePath` would
* collapse `https://` into `https:/`, so URLs must be kept intact.
*/
function normalizeSourceUri(input) {
	const value = (input ?? "").trim();
	if (/^https?:\/\//i.test(value)) return value;
	if (/^https?:\//i.test(value)) return value.replace(/^(https?:\/)/i, "$1/");
	if (value.toLowerCase().startsWith("vault:")) return `${VAULT_URI_SCHEME}${normalizePath(value.slice(6))}`;
	return normalizePath(value);
}
function basename(path) {
	const normalized = normalizePath(path);
	const index = normalized.lastIndexOf("/");
	return index === -1 ? normalized : normalized.slice(index + 1);
}
/** 小写扩展名，不带点；没有扩展名时返回空串。 */
function extensionOf(path) {
	const base = basename(path);
	const index = base.lastIndexOf(".");
	return index <= 0 ? "" : base.slice(index + 1).toLowerCase();
}
function stripExtension(path) {
	const extension = extensionOf(path);
	if (!extension) return path;
	return path.slice(0, path.length - extension.length - 1);
}
/** `兴趣/深度工作_笔记.md` → `深度工作 笔记` */
function noteTitleFromPath(path) {
	return stripExtension(basename(path)).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
/** 把 `[[目标#标题|别名]]` 中的目标部分转换成笔记路径（补 .md）。 */
function linkTargetToPath(raw) {
	const trimmed = ((raw.split("|")[0] ?? raw).split("#")[0] ?? "").trim();
	if (!trimmed) return "";
	const normalized = normalizePath(trimmed);
	return /\.md$/i.test(normalized) ? normalized : `${normalized}.md`;
}
/** path 是否位于 folder 中（含 folder 本身）。 */
function isInsideFolder(path, folder) {
	const normalizedPath = normalizePath(path);
	const normalizedFolder = normalizePath(folder);
	if (!normalizedFolder) return true;
	return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}
/** 生成 node.sourceUri：`vault:笔记/深度工作.md`。 */
function vaultUri(path) {
	return `${VAULT_URI_SCHEME}${normalizePath(path)}`;
}
/** 从 sourceUri 还原 vault 路径；兼容直接存路径的旧数据。 */
function pathFromUri(uri) {
	const value = uri.trim();
	if (value.toLowerCase().startsWith("vault:")) return normalizePath(value.slice(6));
	return normalizePath(value);
}
/** 生成安全的文件名：去掉 Windows / Obsidian 不允许的字符。 */
function slugifyFileName(input) {
	return input.normalize("NFKC").trim().replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim() || "未命名节点";
}
//#endregion
//#region standalone/src/capture.ts
var INBOX = "InterestSeed/Inbox";
async function captureToVault(vaultPath, input) {
	const text = input.text.trim();
	if (!text) throw new Error("Nothing to capture.");
	const title = (input.title?.trim() || firstLine(text) || "未命名收藏").slice(0, 120);
	const name = `${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}-${slugifyFileName(title).slice(0, 60) || "capture"}.md`;
	const dir = join(vaultPath, INBOX);
	await mkdir(dir, { recursive: true });
	const path = join(dir, name);
	const frontmatter = [
		"---",
		`title: ${JSON.stringify(title)}`,
		"type: document",
		"tags: [inbox]",
		...input.url ? [`source: ${JSON.stringify(input.url)}`] : [],
		`capturedAt: ${(/* @__PURE__ */ new Date()).toISOString()}`,
		"---",
		"",
		`# ${title}`,
		"",
		text,
		""
	].join("\n");
	await writeFile(path, frontmatter, "utf8");
	return {
		path: `${INBOX}/${name}`,
		title
	};
}
function firstLine(text) {
	return text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0)?.slice(0, 120) ?? "";
}
//#endregion
//#region src/utils/validation.ts
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toFiniteNumber(value, fallback) {
	const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
	return Number.isFinite(numeric) ? numeric : fallback;
}
function clamp01(value, fallback = 0) {
	const numeric = toFiniteNumber(value, fallback);
	if (numeric <= 0) return 0;
	if (numeric >= 1) return 1;
	return numeric;
}
/** 接受 `"a, b"`、`['a', '#b']` 等输入，去重并去掉前导 #。 */
function sanitizeTags(input) {
	const source = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,，;；\s]+/) : [];
	const seen = /* @__PURE__ */ new Set();
	const tags = [];
	for (const entry of source) {
		if (typeof entry !== "string") continue;
		const tag = entry.replace(/^#+/, "").trim();
		if (!tag) continue;
		const key = tag.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		tags.push(tag);
	}
	return tags;
}
function tagKey(tag) {
	return tag.replace(/^#+/, "").trim().toLowerCase();
}
var ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function isIsoTimestamp(value) {
	return typeof value === "string" && ISO_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}
/**
* 严格的结构校验：用于保存前检查，不修正数据，只报告问题。
* 与 validateGraph（读入时的宽松清洗）互补。
*/
function validateGraphStructure(graph) {
	const errors = [];
	if (!isRecord(graph)) return ["图谱根对象不是对象"];
	if (!Number.isInteger(graph.schemaVersion) || graph.schemaVersion < 1) errors.push("schemaVersion 必须是正整数");
	if (!isIsoTimestamp(graph.updatedAt)) errors.push("updatedAt 必须是 ISO 8601 字符串");
	if (!Array.isArray(graph.nodes)) errors.push("nodes 必须是数组");
	if (!Array.isArray(graph.edges)) errors.push("edges 必须是数组");
	if (errors.length > 0) return errors;
	const nodeIds = /* @__PURE__ */ new Set();
	const sourceUris = /* @__PURE__ */ new Set();
	for (const node of graph.nodes) {
		if (!isRecord(node)) {
			errors.push("nodes 中存在非对象项");
			continue;
		}
		if (typeof node.id !== "string" || !node.id.trim()) {
			errors.push("节点缺少 id");
			continue;
		}
		if (nodeIds.has(node.id)) errors.push(`节点 id 重复：${node.id}`);
		nodeIds.add(node.id);
		if (typeof node.sourceUri === "string" && node.sourceUri.trim()) {
			const key = node.sourceUri.toLowerCase();
			if (sourceUris.has(key)) errors.push(`节点 sourceUri 重复：${node.sourceUri}`);
			sourceUris.add(key);
		}
		if (!isNodeType(node.type)) errors.push(`节点 ${node.id} 的 type 无效`);
		if (typeof node.title !== "string" || !node.title.trim()) errors.push(`节点 ${node.id} 缺少 title`);
		if (!Array.isArray(node.tags) || !node.tags.every((tag) => typeof tag === "string")) errors.push(`节点 ${node.id} 的 tags 必须是字符串数组`);
		if (!isRecord(node.metadata)) errors.push(`节点 ${node.id} 的 metadata 必须是对象`);
		if (!isIsoTimestamp(node.createdAt)) errors.push(`节点 ${node.id} 的 createdAt 不是 ISO 时间`);
		if (!isIsoTimestamp(node.updatedAt)) errors.push(`节点 ${node.id} 的 updatedAt 不是 ISO 时间`);
		if (node.sourceUri !== void 0 && typeof node.sourceUri !== "string") errors.push(`节点 ${node.id} 的 sourceUri 必须是字符串`);
	}
	const edgeIds = /* @__PURE__ */ new Set();
	const edgeKeys = /* @__PURE__ */ new Set();
	for (const edge of graph.edges) {
		if (!isRecord(edge)) {
			errors.push("edges 中存在非对象项");
			continue;
		}
		if (typeof edge.id !== "string" || !edge.id.trim()) {
			errors.push("关系缺少 id");
			continue;
		}
		if (edgeIds.has(edge.id)) errors.push(`关系 id 重复：${edge.id}`);
		edgeIds.add(edge.id);
		if (typeof edge.source === "string" && typeof edge.target === "string" && typeof edge.relation === "string") {
			const key = `${edge.source}\u0000${edge.target}\u0000${edge.relation}`;
			if (edgeKeys.has(key)) errors.push(`关系重复：${edge.source} → ${edge.target}（${edge.relation}）`);
			edgeKeys.add(key);
		}
		if (typeof edge.source !== "string" || !nodeIds.has(edge.source)) errors.push(`关系 ${edge.id} 的 source 不存在`);
		if (typeof edge.target !== "string" || !nodeIds.has(edge.target)) errors.push(`关系 ${edge.id} 的 target 不存在`);
		if (edge.source === edge.target) errors.push(`关系 ${edge.id} 是自环`);
		if (typeof edge.relation !== "string" || !edge.relation.trim()) errors.push(`关系 ${edge.id} 缺少 relation`);
		if (!isRelationOrigin(edge.origin)) errors.push(`关系 ${edge.id} 的 origin 无效`);
		if (!isRelationStatus(edge.status)) errors.push(`关系 ${edge.id} 的 status 无效`);
		if (edge.confidence !== void 0 && (typeof edge.confidence !== "number" || edge.confidence < 0 || edge.confidence > 1)) errors.push(`关系 ${edge.id} 的 confidence 必须在 0–1 之间`);
		if (edge.evidence !== void 0 && (!Array.isArray(edge.evidence) || !edge.evidence.every((item) => typeof item === "string" && item.trim()))) errors.push(`关系 ${edge.id} 的 evidence 必须是非空字符串数组`);
		if (edge.userRenamed !== void 0 && typeof edge.userRenamed !== "boolean") errors.push(`关系 ${edge.id} 的 userRenamed 必须是布尔值`);
		if ((edge.origin === "rule" || edge.origin === "ai") && (!Array.isArray(edge.evidence) || edge.evidence.length === 0)) errors.push(`关系 ${edge.id} 来源为 ${edge.origin} 但缺少 evidence`);
		if (!isIsoTimestamp(edge.createdAt)) errors.push(`关系 ${edge.id} 的 createdAt 不是 ISO 时间`);
		if (!isIsoTimestamp(edge.updatedAt)) errors.push(`关系 ${edge.id} 的 updatedAt 不是 ISO 时间`);
	}
	if (graph.viewport !== void 0) {
		const viewport = graph.viewport;
		if (!isRecord(viewport) || typeof viewport.zoom !== "number" || !Number.isFinite(viewport.zoom) || viewport.zoom <= 0 || typeof viewport.panX !== "number" || !Number.isFinite(viewport.panX) || typeof viewport.panY !== "number" || !Number.isFinite(viewport.panY)) errors.push("viewport 必须是合法的 zoom / panX / panY");
	}
	return errors;
}
function emptyDiscoveryApplication() {
	return { state: "none" };
}
function emptyDiscoveryFile(now) {
	return {
		discoverySchemaVersion: 3,
		identityVersion: 2,
		updatedAt: now,
		discoveries: []
	};
}
//#endregion
//#region src/discovery/identity.ts
var KIND_DOMAIN = "cross-project-topic";
/**
* 长度前缀编码，避免 "a|b" 与 "a" + "|b" 之类的歧义拼接。
* 字段顺序由调用方固定，字段自身可以包含分隔符。
*/
function encodeIdentityFields(fields) {
	return `${fields.length}:${fields.map((field) => `${field.length}:${field}`).join("|")}`;
}
function normalizeIdentityKeys(values) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const value of values) {
		const normalized = value.trim().toLowerCase();
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
	}
	return result.sort();
}
function normalizeExactKeys(values) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const value of values) {
		const normalized = value.trim();
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
	}
	return result.sort();
}
function normalizeSubjectKeys(values) {
	return normalizeIdentityKeys(values.map((value) => tagKey(value)));
}
function evidenceProfile(evidence) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const item of evidence) {
		if (!item.nodeId.trim()) continue;
		const key = encodeIdentityFields([item.kind, item.nodeId.trim()]);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(key);
	}
	return result.sort();
}
function dedupeKeyFor(projectKeys, subjectKeys) {
	return hash64(encodeIdentityFields([
		"interestseed/discovery/dedupe/v2",
		KIND_DOMAIN,
		...normalizeIdentityKeys(projectKeys),
		"--subject--",
		...normalizeSubjectKeys(subjectKeys)
	]));
}
function suppressionKeyFor(projectKeys, subjectKeys, evidence, recordId) {
	const profile = evidenceProfile(evidence);
	if (profile.length === 0) {
		if (recordId) return hash64(encodeIdentityFields([
			"interestseed/discovery/suppression/record-scope/v2",
			KIND_DOMAIN,
			recordId
		]));
		return hash64(encodeIdentityFields(["interestseed/discovery/suppression/empty-profile/v2", KIND_DOMAIN]));
	}
	return hash64(encodeIdentityFields([
		"interestseed/discovery/suppression/v2",
		KIND_DOMAIN,
		...normalizeIdentityKeys(projectKeys),
		"--subject--",
		...normalizeSubjectKeys(subjectKeys),
		"--evidence--",
		...profile
	]));
}
/**
* 身份槽：语义主题 + 节点对。
* dedupeKey 负责主题，nodeIds 负责保留独立节点对，避免把独立变体强行合并。
*/
function identitySlotKey(dedupeKey, nodeIds) {
	return hash64(encodeIdentityFields([
		"interestseed/discovery/slot/v2",
		KIND_DOMAIN,
		dedupeKey,
		"--nodes--",
		...normalizeExactKeys(nodeIds)
	]));
}
function discoveryIdFor(dedupeKey, evidence, ruleVersion) {
	return `discovery_${hash64(encodeIdentityFields([
		"interestseed/discovery/id/v2",
		KIND_DOMAIN,
		dedupeKey,
		"--evidence--",
		...normalizeExactKeys(evidence),
		"--rule--",
		ruleVersion
	]))}`;
}
//#endregion
//#region src/discovery/DiscoveryEngine.ts
var DISCOVERY_RULE_VERSION = "cross-project-topic-v1";
var MAX_DISCOVERIES = 20;
function uniqueEvidence(items) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const item of items) {
		const key = `${item.kind}\u0000${item.nodeId}\u0000${item.text}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(item);
	}
	return result;
}
/**
* 最小发现规则：跨目录共同主题。
*
* 只使用现有图谱数据，不读取正文、不调用网络、不修改图谱。
* 每个候选都要求至少两个不同顶层目录分组、共享标签，并且每个节点
* 都有至少一条 confirmed 关系作为额外证据。
*/
var DiscoveryEngine = class {
	now;
	ruleVersion;
	constructor(now = () => (/* @__PURE__ */ new Date()).toISOString(), ruleVersion = DISCOVERY_RULE_VERSION) {
		this.now = now;
		this.ruleVersion = ruleVersion;
	}
	generate(graph, previous) {
		const nodesById = /* @__PURE__ */ new Map();
		for (const node of graph.nodes) nodesById.set(node.id, node);
		const candidates = [];
		const groups = /* @__PURE__ */ new Map();
		for (const node of graph.nodes) {
			if (!node.sourceUri) continue;
			if (node.type === "topic") continue;
			const projectKey = this.projectKeyOf(node);
			if (!projectKey) continue;
			const list = groups.get(projectKey);
			if (list) list.push(node);
			else groups.set(projectKey, [node]);
		}
		const projectKeys = [...groups.keys()].sort(compareText);
		if (projectKeys.length < 2) return this.reconcile(previous, candidates);
		const confirmedByNode = /* @__PURE__ */ new Map();
		for (const edge of graph.edges) {
			if (edge.status !== "confirmed") continue;
			if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue;
			this.pushEdge(confirmedByNode, edge.source, edge);
			this.pushEdge(confirmedByNode, edge.target, edge);
		}
		const directConfirmed = /* @__PURE__ */ new Set();
		for (const edge of graph.edges) {
			if (edge.status !== "confirmed") continue;
			directConfirmed.add(this.pairKey(edge.source, edge.target));
		}
		for (let left = 0; left < projectKeys.length; left += 1) for (let right = left + 1; right < projectKeys.length; right += 1) {
			const projectLeft = projectKeys[left] ?? "";
			const projectRight = projectKeys[right] ?? "";
			const leftGroup = groups.get(projectLeft) ?? [];
			const rightGroup = groups.get(projectRight) ?? [];
			for (const a of leftGroup) for (const b of rightGroup) {
				const discovery = this.consider(a, b, projectLeft, projectRight, confirmedByNode, directConfirmed, nodesById);
				if (discovery) candidates.push(discovery);
			}
		}
		candidates.sort((left, right) => compareText(left.id, right.id));
		return this.reconcile(previous, candidates.slice(0, MAX_DISCOVERIES));
	}
	consider(a, b, projectA, projectB, confirmedByNode, directConfirmed, nodesById) {
		if (directConfirmed.has(this.pairKey(a.id, b.id))) return null;
		const shared = this.sharedTags(a, b);
		if (shared.length === 0) return null;
		const evidenceA = this.confirmedEvidence(a, confirmedByNode, nodesById);
		const evidenceB = this.confirmedEvidence(b, confirmedByNode, nodesById);
		if (evidenceA.length === 0 || evidenceB.length === 0) return null;
		const unique = uniqueEvidence([
			{
				kind: "source",
				nodeId: a.id,
				sourceUri: a.sourceUri,
				text: `来源：${a.sourceUri ?? ""}`
			},
			{
				kind: "source",
				nodeId: b.id,
				sourceUri: b.sourceUri,
				text: `来源：${b.sourceUri ?? ""}`
			},
			{
				kind: "shared-tag",
				nodeId: a.id,
				text: `两个节点共享标签：${shared.map((tag) => `#${tag}`).join("、")}`
			},
			...evidenceA,
			...evidenceB
		]);
		const nodeIds = [a.id, b.id].sort(compareText);
		const subjectKeys = shared;
		const projectKeys = [projectA, projectB].sort(compareText);
		const dedupeKey = dedupeKeyFor(projectKeys, subjectKeys);
		const suppressionKey = suppressionKeyFor(projectKeys, subjectKeys, unique);
		const id = discoveryIdFor(dedupeKey, evidenceProfile(unique), this.ruleVersion);
		const strength = evidenceA.length >= 2 && evidenceB.length >= 2 ? "strong" : "moderate";
		const now = this.now();
		return {
			id,
			kind: "cross-project-topic",
			title: `共同主题：${shared.map((tag) => `#${tag}`).join("、")}`,
			description: `这两份材料来自不同的推定目录，并共享同一主题；它们各自还有已确认关系作为额外证据。`,
			nodeIds,
			projectKeys,
			subjectKeys,
			evidence: unique,
			ruleVersion: this.ruleVersion,
			strength,
			dedupeKey,
			suppressionKey,
			identityVersion: 2,
			status: "active",
			feedbackStatus: "none",
			application: emptyDiscoveryApplication(),
			createdAt: now,
			updatedAt: now
		};
	}
	reconcile(previous, candidates) {
		const slotOf = (item) => identitySlotKey(item.identityVersion === 2 ? item.dedupeKey : dedupeKeyFor(item.projectKeys, item.subjectKeys), item.nodeIds);
		const activeBySlot = /* @__PURE__ */ new Map();
		for (const item of previous.discoveries) {
			if (item.status !== "active" || item.supersededBy) continue;
			const slot = slotOf(item);
			const list = activeBySlot.get(slot);
			if (list) list.push(item);
			else activeBySlot.set(slot, [item]);
		}
		const statusRank = (item) => {
			const app = item.application?.state;
			const appScore = app === "applied" || app === "existing" ? 4 : app === "applying" || app === "recovery-required" ? 3 : app === "failed" || app === "stale" ? 2 : 1;
			const feedbackScore = item.feedbackStatus === "accepted" ? 3 : item.feedbackStatus === "needs-verification" ? 2 : 1;
			return appScore * 10 + feedbackScore;
		};
		const canonicalBySlot = /* @__PURE__ */ new Map();
		for (const [slot, items] of activeBySlot) {
			const sorted = [...items].sort((left, right) => {
				const byStatus = statusRank(right) - statusRank(left);
				if (byStatus !== 0) return byStatus;
				const byCreated = compareText(left.createdAt, right.createdAt);
				return byCreated !== 0 ? byCreated : compareText(left.id, right.id);
			});
			canonicalBySlot.set(slot, sorted[0]);
		}
		const normalized = {
			...previous,
			discoveries: previous.discoveries.map((item) => {
				if (item.status !== "active") return item;
				const canonical = canonicalBySlot.get(slotOf(item));
				if (!canonical || canonical.id === item.id) return item;
				return {
					...item,
					status: "dismissed",
					supersededBy: canonical.id,
					supersededAt: this.now(),
					updatedAt: this.now()
				};
			})
		};
		const byId = /* @__PURE__ */ new Map();
		const bySlot = /* @__PURE__ */ new Map();
		for (const item of normalized.discoveries) {
			byId.set(item.id, item);
			if (item.status !== "active" || item.supersededBy) continue;
			const slot = slotOf(item);
			if (!bySlot.has(slot)) bySlot.set(slot, item);
		}
		const suppressedKeys = new Set(normalized.discoveries.filter((item) => item.status === "dismissed" && item.feedbackStatus === "rejected").map((item) => item.suppressionKey ?? suppressionKeyFor(item.projectKeys, item.subjectKeys, item.evidence, item.id)));
		const merged = candidates.filter((candidate) => byId.has(candidate.id) || !suppressedKeys.has(candidate.suppressionKey ?? "")).map((candidate) => {
			const existing = bySlot.get(slotOf(candidate)) ?? byId.get(candidate.id);
			if (!existing) return candidate;
			return {
				...existing,
				kind: candidate.kind,
				title: candidate.title,
				description: candidate.description,
				nodeIds: candidate.nodeIds,
				projectKeys: candidate.projectKeys,
				subjectKeys: candidate.subjectKeys,
				evidence: candidate.evidence,
				ruleVersion: candidate.ruleVersion,
				strength: candidate.strength,
				dedupeKey: candidate.dedupeKey,
				suppressionKey: candidate.suppressionKey,
				identityVersion: candidate.identityVersion,
				application: existing.application ?? emptyDiscoveryApplication(),
				updatedAt: candidate.updatedAt
			};
		});
		const mergedIds = new Set(merged.map((item) => item.id));
		for (const item of normalized.discoveries) if (!mergedIds.has(item.id)) merged.push(item);
		const ordered = [];
		const mergedById = /* @__PURE__ */ new Map();
		for (const item of merged) if (!mergedById.has(item.id)) mergedById.set(item.id, item);
		for (const item of normalized.discoveries) {
			const current = mergedById.get(item.id);
			if (!current) continue;
			ordered.push(current);
			mergedById.delete(item.id);
		}
		for (const item of merged) {
			const current = mergedById.get(item.id);
			if (!current) continue;
			ordered.push(current);
			mergedById.delete(item.id);
		}
		return {
			discoverySchemaVersion: 3,
			identityVersion: ordered.some((item) => item.identityVersion !== 2) ? 1 : 2,
			updatedAt: this.now(),
			discoveries: ordered
		};
	}
	projectKeyOf(node) {
		const path = node.sourceUri ? pathFromUri(node.sourceUri) : "";
		if (!path) return null;
		return path.split("/").filter(Boolean)[0] ?? null;
	}
	sharedTags(a, b) {
		const left = new Set(a.tags.map((tag) => tagKey(tag)).filter(Boolean));
		const right = new Set(b.tags.map((tag) => tagKey(tag)).filter(Boolean));
		return [...left].filter((tag) => right.has(tag)).sort(compareText);
	}
	confirmedEvidence(node, confirmedByNode, nodesById) {
		return (confirmedByNode.get(node.id) ?? []).slice(0, 3).map((edge) => ({
			kind: "confirmed-edge",
			nodeId: node.id,
			sourceUri: node.sourceUri,
			text: `已确认关系：${this.edgeLabel(edge, node.id, nodesById)}`
		}));
	}
	edgeLabel(edge, nodeId, nodesById) {
		const other = edge.source === nodeId ? edge.target : edge.source;
		return `${nodesById.get(other)?.title ?? other}（${edge.relation}）`;
	}
	pushEdge(map, nodeId, edge) {
		const list = map.get(nodeId);
		if (list) list.push(edge);
		else map.set(nodeId, [edge]);
	}
	pairKey(left, right) {
		return [left, right].sort(compareText).join("\0");
	}
};
//#endregion
//#region src/discovery/ranking.ts
function discoveryPriority(item) {
	if (item.status === "dismissed" || item.feedbackStatus === "rejected" || item.feedbackStatus === "low-value") return 5;
	if (item.application?.state === "applied" || item.application?.state === "existing") return 4;
	if (item.feedbackStatus === "accepted") return 0;
	if (item.feedbackStatus === "corrected" || item.feedbackStatus === "needs-verification") return 1;
	return 2;
}
function strengthRank(item) {
	if (item.strength === "strong") return 0;
	if (item.strength === "moderate") return 1;
	return 2;
}
function compareDiscoveries(left, right) {
	const priority = discoveryPriority(left) - discoveryPriority(right);
	if (priority !== 0) return priority;
	const strength = strengthRank(left) - strengthRank(right);
	if (strength !== 0) return strength;
	if (left.id === right.id) return 0;
	return left.id < right.id ? -1 : 1;
}
function sortDiscoveries(discoveries) {
	return [...discoveries].sort(compareDiscoveries);
}
//#endregion
//#region standalone/src/discoveries.ts
var FILE$2 = "discoveries.json";
function pathFor$1(vaultPath) {
	return join(stateDir(vaultPath), FILE$2);
}
async function loadDiscoveries(vaultPath) {
	const path = pathFor$1(vaultPath);
	if (!existsSync(path)) return emptyDiscoveryFile((/* @__PURE__ */ new Date()).toISOString());
	const raw = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed.discoveries)) throw new Error("Invalid InterestSeed discoveries file");
	return {
		discoverySchemaVersion: parsed.discoverySchemaVersion ?? 3,
		...parsed.identityVersion ? { identityVersion: parsed.identityVersion } : {},
		updatedAt: parsed.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
		discoveries: parsed.discoveries
	};
}
async function saveDiscoveries(vaultPath, file) {
	await ensureStateDir(vaultPath);
	const path = pathFor$1(vaultPath);
	const temp = `${path}.tmp`;
	await writeFile(temp, `${JSON.stringify(file, null, 2)}\n`, "utf8");
	await rename(temp, path);
}
async function refreshDiscoveries(vaultPath) {
	const state = await loadState(vaultPath);
	const previous = await loadDiscoveries(vaultPath);
	const next = new DiscoveryEngine().generate(state.graph, previous);
	await saveDiscoveries(vaultPath, next);
	return sortDiscoveries(next.discoveries.filter((item) => item.status === "active"));
}
async function listDiscoveries(vaultPath) {
	return sortDiscoveries((await loadDiscoveries(vaultPath)).discoveries.filter((item) => item.status === "active"));
}
async function applyDiscovery(vaultPath, id) {
	const file = await loadDiscoveries(vaultPath);
	const discovery = file.discoveries.find((item) => item.id === id);
	if (!discovery) return {
		ok: false,
		message: "Discovery not found."
	};
	const state = await loadState(vaultPath);
	const [sourceId, targetId] = discovery.nodeIds;
	if (!sourceId || !targetId) return {
		ok: false,
		message: "Discovery has no node pair."
	};
	const source = state.graph.nodes.find((node) => node.id === sourceId);
	const target = state.graph.nodes.find((node) => node.id === targetId);
	if (!source || !target) return {
		ok: false,
		message: "Node is missing from the graph."
	};
	const existing = state.graph.edges.find((edge) => edge.source === sourceId && edge.target === targetId || edge.source === targetId && edge.target === sourceId);
	if (existing) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		if (existing.status !== "confirmed") {
			const confirmed = {
				...existing,
				status: "confirmed",
				origin: "rule",
				evidence: [
					...existing.evidence ?? [],
					`发现：${discovery.title}`,
					"用户确认"
				],
				updatedAt: now
			};
			await snapshotGraph(vaultPath);
			await saveGraph(vaultPath, {
				...state.graph,
				edges: state.graph.edges.map((edge) => edge.id === existing.id ? confirmed : edge),
				updatedAt: now
			});
			discovery.feedbackStatus = "accepted";
			discovery.application = {
				state: "applied",
				edgeId: confirmed.id,
				sourceNodeId: sourceId,
				targetNodeId: targetId,
				relation: confirmed.relation,
				appliedAt: now,
				updatedAt: now
			};
			discovery.updatedAt = now;
			await saveDiscoveries(vaultPath, file);
			return {
				ok: true,
				edge: confirmed
			};
		}
		discovery.application = {
			state: "existing",
			edgeId: existing.id,
			sourceNodeId: sourceId,
			targetNodeId: targetId,
			relation: existing.relation,
			updatedAt: now
		};
		discovery.updatedAt = now;
		await saveDiscoveries(vaultPath, file);
		return {
			ok: true,
			edge: existing,
			message: "This pair is already connected."
		};
	}
	const relation = discovery.subjectKeys.length ? `共同主题：${discovery.subjectKeys.map((tag) => `#${tag}`).join("、")}` : "共同主题";
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const edge = {
		id: edgeIdFor(sourceId, targetId, relation),
		source: sourceId,
		target: targetId,
		relation,
		origin: "rule",
		status: "confirmed",
		evidence: [
			`发现：${discovery.title}`,
			...discovery.evidence.slice(0, 3).map((item) => item.text),
			"用户确认"
		],
		createdAt: now,
		updatedAt: now
	};
	const nextGraph = {
		...state.graph,
		edges: [...state.graph.edges, edge],
		updatedAt: now
	};
	await snapshotGraph(vaultPath);
	await saveGraph(vaultPath, nextGraph);
	discovery.feedbackStatus = "accepted";
	discovery.application = {
		state: "applied",
		edgeId: edge.id,
		sourceNodeId: sourceId,
		targetNodeId: targetId,
		relation,
		appliedAt: now,
		updatedAt: now
	};
	discovery.updatedAt = now;
	await saveDiscoveries(vaultPath, file);
	return {
		ok: true,
		edge
	};
}
async function dismissDiscovery(vaultPath, id) {
	const file = await loadDiscoveries(vaultPath);
	const discovery = file.discoveries.find((item) => item.id === id);
	if (!discovery) return {
		ok: false,
		message: "Discovery not found."
	};
	const now = (/* @__PURE__ */ new Date()).toISOString();
	discovery.status = "dismissed";
	discovery.feedbackStatus = "rejected";
	discovery.updatedAt = now;
	discovery.feedbackHistory = [...discovery.feedbackHistory ?? [], {
		id: `feedback_${Date.now()}`,
		action: "rejected",
		at: now,
		previousStatus: "none"
	}];
	await saveDiscoveries(vaultPath, file);
	return { ok: true };
}
function discoveryView(discovery) {
	return {
		id: discovery.id,
		title: discovery.title,
		description: discovery.description,
		nodeIds: discovery.nodeIds,
		projectKeys: discovery.projectKeys,
		subjectKeys: discovery.subjectKeys,
		evidence: discovery.evidence,
		strength: discovery.strength,
		feedbackStatus: discovery.feedbackStatus,
		application: discovery.application ?? { state: "none" },
		updatedAt: discovery.updatedAt
	};
}
//#endregion
//#region src/inbox/ShareInbox.ts
function normalizeKey(text) {
	const url = text.match(/https?:\/\/[^\s]+/i)?.[0];
	if (url) return url.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
	return text.replace(/\s+/g, " ").trim().toLowerCase();
}
/**
* Local-first intake queue. It never writes to the graph by itself:
* the user must still open a candidate and choose keep or pass.
*/
var ShareInbox = class {
	items = [];
	maxItems;
	constructor(maxItems = 200) {
		this.maxItems = maxItems;
	}
	enqueue(text, source = "share", sourceRef = "", now = (/* @__PURE__ */ new Date()).toISOString()) {
		const value = text.trim();
		if (!value) return null;
		const key = normalizeKey(value);
		const duplicate = this.items.find((item) => normalizeKey(item.text) === key && item.status === "pending");
		if (duplicate) return {
			item: duplicate,
			duplicate: true
		};
		const item = {
			id: `inbox_${hashString(key)}`,
			text: value,
			addedAt: now,
			status: "pending",
			source,
			...sourceRef ? { sourceRef } : {}
		};
		this.items = [item, ...this.items].slice(0, this.maxItems);
		return {
			item,
			duplicate: false
		};
	}
	resolve(id, status) {
		const item = this.items.find((candidate) => candidate.id === id);
		if (!item) return null;
		item.status = status;
		return item;
	}
	pending() {
		return this.items.filter((item) => item.status === "pending");
	}
	pendingCount() {
		return this.pending().length;
	}
	all() {
		return this.items;
	}
	serialize() {
		return this.items.map((item) => ({ ...item }));
	}
	load(raw) {
		if (!Array.isArray(raw)) return;
		const seenIds = /* @__PURE__ */ new Set();
		this.items = raw.filter((item) => Boolean(item && typeof item === "object")).map((item) => ({
			id: String(item.id ?? ""),
			text: String(item.text ?? ""),
			addedAt: String(item.addedAt ?? ""),
			status: item.status === "kept" || item.status === "passed" ? item.status : "pending",
			source: item.source === "clipboard" || item.source === "note" ? item.source : "share",
			...item.sourceRef ? { sourceRef: String(item.sourceRef) } : {}
		})).filter((item) => {
			if (!item.id || !item.text || seenIds.has(item.id)) return false;
			seenIds.add(item.id);
			return true;
		}).slice(0, this.maxItems);
	}
};
//#endregion
//#region standalone/src/inbox.ts
var FILE$1 = "inbox.json";
function pathFor(vaultPath) {
	return join(stateDir(vaultPath), FILE$1);
}
async function load(vaultPath) {
	const inbox = new ShareInbox();
	const path = pathFor(vaultPath);
	if (!existsSync(path)) return inbox;
	const raw = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
	const parsed = JSON.parse(raw);
	inbox.load(parsed.items);
	return inbox;
}
async function save(vaultPath, inbox) {
	await ensureStateDir(vaultPath);
	const path = pathFor(vaultPath);
	const temp = `${path}.tmp`;
	await writeFile(temp, `${JSON.stringify({ items: inbox.serialize() }, null, 2)}\n`, "utf8");
	await rename(temp, path);
}
async function listInbox(vaultPath) {
	return [...(await load(vaultPath)).all()];
}
async function enqueueInbox(vaultPath, text, source = "clipboard", sourceRef = "") {
	const inbox = await load(vaultPath);
	const result = inbox.enqueue(text, source, sourceRef);
	if (!result) throw new Error("Nothing to enqueue.");
	await save(vaultPath, inbox);
	return result;
}
async function resolveInbox(vaultPath, id, status) {
	const inbox = await load(vaultPath);
	const item = inbox.all().find((candidate) => candidate.id === id);
	if (!item) throw new Error("Inbox item not found.");
	let captured;
	if (status === "kept") captured = await captureToVault(vaultPath, { text: item.text });
	const resolved = inbox.resolve(id, status);
	if (!resolved) throw new Error("Inbox item not found.");
	await save(vaultPath, inbox);
	return {
		item: resolved,
		...captured ? { captured } : {}
	};
}
function localDate(now) {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function clampTarget(value) {
	const number = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(number)) return 7;
	return Math.min(30, Math.max(1, Math.round(number)));
}
function clampScore(value) {
	const number = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(number)) return 0;
	return Math.min(5, Math.max(1, Math.round(number)));
}
function createExperiment(input) {
	return {
		title: input.title.trim() || "7 天兴趣实验",
		hypothesis: input.hypothesis.trim() || "这个兴趣值得我投入一周的真实注意力。",
		metric: input.metric?.trim() || "每天记录一次兴趣强度（1–5）与一个具体证据。",
		startedAt: input.startedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
		targetDays: clampTarget(input.targetDays),
		status: "active",
		logs: []
	};
}
function experimentDay(state) {
	return Math.min(state.targetDays, state.logs.length + 1);
}
function canRecordToday(state, now = /* @__PURE__ */ new Date()) {
	if (state.status === "complete" || state.logs.length >= state.targetDays) return {
		ok: false,
		reason: state.targetDays === 3 ? "3 天试跑已经完成。" : "7 天实验已经完成。",
		day: state.targetDays
	};
	const today = localDate(now);
	if (state.logs.some((log) => log.date === today)) return {
		ok: false,
		reason: "今天已经记录过了，明天再来。",
		day: experimentDay(state)
	};
	return {
		ok: true,
		day: experimentDay(state)
	};
}
function recordExperimentLog(state, input, now = /* @__PURE__ */ new Date()) {
	const gate = canRecordToday(state, now);
	if (!gate.ok) throw new Error(gate.reason ?? "今天不能记录。");
	const evidence = input.evidence.trim();
	if (evidence.length < 4) throw new Error("写下至少 4 个字的真实观察，才算一条实验记录。");
	const log = {
		day: gate.day,
		date: localDate(now),
		recordedAt: now.toISOString(),
		interest: clampScore(input.interest),
		energy: clampScore(input.energy),
		evidence,
		...input.next?.trim() ? { next: input.next.trim() } : {}
	};
	const logs = [...state.logs, log];
	return {
		...state,
		logs,
		status: logs.length >= state.targetDays ? "complete" : "active"
	};
}
function experimentSummary(state) {
	const days = state.logs.length;
	const average = (key) => days === 0 ? 0 : Math.round(state.logs.reduce((sum, log) => sum + log[key], 0) / days * 10) / 10;
	return {
		averageInterest: average("interest"),
		averageEnergy: average("energy"),
		days,
		complete: days >= state.targetDays
	};
}
//#endregion
//#region standalone/src/experiments.ts
var FILE = "experiments.json";
function filePath(vaultPath) {
	return join(stateDir(vaultPath), FILE);
}
async function loadFile(vaultPath) {
	const path = filePath(vaultPath);
	if (!existsSync(path)) return {
		schemaVersion: 1,
		experiments: []
	};
	const raw = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
	const parsed = JSON.parse(raw);
	return {
		schemaVersion: 1,
		experiments: Array.isArray(parsed.experiments) ? parsed.experiments : []
	};
}
async function saveFile(vaultPath, file) {
	await ensureStateDir(vaultPath);
	const { writeFile, rename } = await import("node:fs/promises");
	const path = filePath(vaultPath);
	const temp = `${path}.tmp`;
	await writeFile(temp, `${JSON.stringify(file, null, 2)}\n`, "utf8");
	await rename(temp, path);
}
async function listExperiments(vaultPath) {
	return (await loadFile(vaultPath)).experiments;
}
async function activeExperiment(vaultPath) {
	return (await listExperiments(vaultPath)).find((item) => item.state.status === "active") ?? null;
}
async function startExperiment(vaultPath, input) {
	const file = await loadFile(vaultPath);
	const title = input.title.trim();
	if (!title) throw new Error("Experiment title is required.");
	const state = createExperiment({
		title,
		hypothesis: input.hypothesis?.trim() || `我愿意连续 ${input.targetDays ?? 3} 天为「${title}」做一次真实行动。`,
		targetDays: input.targetDays ?? 3
	});
	const experiment = {
		id: `exp_${randomUUID().slice(0, 8)}`,
		...input.nodeId ? { nodeId: input.nodeId } : {},
		state
	};
	file.experiments.unshift(experiment);
	await saveFile(vaultPath, file);
	return experiment;
}
async function logExperiment(vaultPath, id, input, now = /* @__PURE__ */ new Date()) {
	const file = await loadFile(vaultPath);
	const index = file.experiments.findIndex((item) => item.id === id);
	if (index < 0) throw new Error("Experiment not found.");
	const current = file.experiments[index];
	const next = recordExperimentLog(current.state, input, now);
	const experiment = {
		...current,
		state: next
	};
	file.experiments[index] = experiment;
	await saveFile(vaultPath, file);
	return experiment;
}
function experimentView(experiment) {
	return {
		id: experiment.id,
		...experiment.nodeId ? { nodeId: experiment.nodeId } : {},
		title: experiment.state.title,
		hypothesis: experiment.state.hypothesis,
		metric: experiment.state.metric,
		status: experiment.state.status,
		day: experimentDay(experiment.state),
		targetDays: experiment.state.targetDays,
		logs: experiment.state.logs,
		summary: experimentSummary(experiment.state)
	};
}
//#endregion
//#region src/core/GraphStore.ts
var GraphStoreError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "GraphStoreError";
	}
};
var ORIGIN_PRIORITY = {
	user: 3,
	ai: 2,
	rule: 1
};
function mergeStatus(left, right) {
	if (left === "confirmed" || right === "confirmed") return "confirmed";
	if (left === "rejected" || right === "rejected") return "rejected";
	return "suggested";
}
function uniqueStrings(values) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const value of values) {
		const trimmed = value.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		result.push(trimmed);
	}
	return result;
}
/**
* 图谱的唯一可变载体。
*
* - 内部用 Map 维护索引，对外序列化为数组（`toJSON()` 按 id 排序，稳定可 diff）；
* - 同一 (source, target, relation) 只会有一条边，重复写入时合并证据与置信度；
* - 状态合并遵循 confirmed > rejected > suggested，来源合并遵循 user > ai > rule；
* - 写入通过事件通知订阅者，UI 与持久化层据此刷新。
*/
var InterestSeedGraphStore = class InterestSeedGraphStore {
	nodes = /* @__PURE__ */ new Map();
	edges = /* @__PURE__ */ new Map();
	edgeIndex = /* @__PURE__ */ new Map();
	adjacency = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Set();
	now;
	schemaVersion;
	updatedAt;
	viewport;
	constructor(graph, options = {}) {
		this.now = options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
		this.schemaVersion = options.schemaVersion ?? 2;
		this.updatedAt = this.now();
		if (graph) this.replace(graph, { silent: true });
	}
	static fromJSON(graph, options = {}) {
		return new InterestSeedGraphStore(graph, options);
	}
	get nodeCount() {
		return this.nodes.size;
	}
	get edgeCount() {
		return this.edges.size;
	}
	get currentViewport() {
		return this.viewport ? { ...this.viewport } : void 0;
	}
	isEmpty() {
		return this.nodes.size === 0 && this.edges.size === 0;
	}
	addNode(input) {
		const node = this.buildNode(input);
		if (this.nodes.has(node.id)) throw new GraphStoreError("duplicate-node", `节点已存在：${node.id}`);
		if (node.sourceUri) {
			const existing = this.findNodeByUri(node.sourceUri);
			if (existing) throw new GraphStoreError("duplicate-source", `同一来源已存在节点：${existing.id}（${node.sourceUri}）`);
		}
		this.nodes.set(node.id, node);
		this.adjacency.set(node.id, /* @__PURE__ */ new Set());
		this.touch();
		this.emit({
			type: "node:added",
			node
		});
		return node;
	}
	/** 先按 id、再按 sourceUri 匹配，匹配到则更新，否则新建。 */
	upsertNode(input) {
		const patch = {
			type: input.type,
			title: input.title,
			sourceUri: input.sourceUri,
			tags: input.tags === void 0 ? void 0 : [...input.tags],
			metadata: input.metadata
		};
		if (input.id) {
			const byId = this.nodes.get(input.id);
			if (byId) return {
				node: this.updateNode(byId.id, patch),
				created: false
			};
		}
		if (input.sourceUri) {
			const key = normalizeSourceUri(input.sourceUri).toLowerCase();
			for (const node of this.nodes.values()) if (node.sourceUri && node.sourceUri.toLowerCase() === key) return {
				node: this.updateNode(node.id, patch),
				created: false
			};
		}
		return {
			node: this.addNode(input),
			created: true
		};
	}
	getNode(id) {
		return this.nodes.get(id);
	}
	requireNode(id) {
		const node = this.nodes.get(id);
		if (!node) throw new GraphStoreError("missing-node", `节点不存在：${id}`);
		return node;
	}
	findNodeByUri(uri) {
		const key = normalizeSourceUri(uri).toLowerCase();
		for (const node of this.nodes.values()) if (node.sourceUri && node.sourceUri.toLowerCase() === key) return node;
	}
	updateNode(id, patch) {
		const current = this.requireNode(id);
		if (patch.id !== void 0 && patch.id !== id) throw new GraphStoreError("invalid-node", "节点 id 不可修改");
		if (patch.createdAt !== void 0 && patch.createdAt !== current.createdAt) throw new GraphStoreError("invalid-node", "节点 createdAt 不可修改");
		if (patch.sourceUri !== void 0 && patch.sourceUri !== "") {
			const existing = this.findNodeByUri(patch.sourceUri);
			if (existing && existing.id !== id) throw new GraphStoreError("duplicate-source", `同一来源已存在节点：${existing.id}（${patch.sourceUri}）`);
		}
		const title = patch.title === void 0 ? current.title : patch.title.trim();
		if (!title) throw new GraphStoreError("invalid-node", "节点标题不能为空");
		const type = patch.type ?? current.type;
		if (!isNodeType(type)) throw new GraphStoreError("invalid-node", `未知的节点类型：${String(type)}`);
		const next = {
			...current,
			title,
			type,
			tags: patch.tags === void 0 ? current.tags : sanitizeTags(patch.tags),
			metadata: patch.metadata === void 0 ? current.metadata : { ...patch.metadata },
			updatedAt: this.now()
		};
		if (patch.sourceUri !== void 0) {
			if (patch.sourceUri === "") delete next.sourceUri;
			else next.sourceUri = normalizeSourceUri(patch.sourceUri);
		}
		this.nodes.set(id, next);
		this.touch();
		this.emit({
			type: "node:updated",
			node: next,
			previous: current
		});
		return next;
	}
	/** 删除节点及其全部关联边，返回被删除的边数。 */
	removeNode(id) {
		if (!this.nodes.get(id)) return 0;
		const incident = [...this.adjacency.get(id) ?? []];
		for (const edgeId of incident) this.removeEdge(edgeId);
		this.nodes.delete(id);
		this.adjacency.delete(id);
		this.touch();
		this.emit({
			type: "node:removed",
			nodeId: id
		});
		return incident.length;
	}
	listNodes() {
		return [...this.nodes.values()].sort((left, right) => compareText(left.title, right.title) || compareText(left.id, right.id));
	}
	nodesByType(type) {
		return this.listNodes().filter((node) => node.type === type);
	}
	addEdge(input) {
		const source = (input.source ?? "").trim();
		const target = (input.target ?? "").trim();
		const relation = (input.relation ?? "").trim();
		if (!source || !target) throw new GraphStoreError("invalid-edge", "关系必须包含 source 与 target");
		if (source === target) throw new GraphStoreError("invalid-edge", "不支持自环关系");
		if (!relation) throw new GraphStoreError("invalid-edge", "关系必须包含 relation");
		if (!this.nodes.has(source)) throw new GraphStoreError("missing-node", `关系起点不存在：${source}`);
		if (!this.nodes.has(target)) throw new GraphStoreError("missing-node", `关系终点不存在：${target}`);
		const origin = input.origin ?? "user";
		if (!isRelationOrigin(origin)) throw new GraphStoreError("invalid-edge", `未知的关系来源：${String(origin)}`);
		const status = input.status ?? "confirmed";
		if (!isRelationStatus(status)) throw new GraphStoreError("invalid-edge", `未知的关系状态：${String(status)}`);
		const requiresEvidence = origin === "rule" || origin === "ai";
		const inputEvidence = uniqueStrings(input.evidence ?? []);
		const key = this.edgeKey(source, target, relation);
		const existingId = this.edgeIndex.get(key);
		if (existingId) {
			const existing = this.edges.get(existingId);
			if (existing) {
				const evidence = uniqueStrings([...existing.evidence ?? [], ...inputEvidence]);
				if (requiresEvidence && evidence.length === 0) throw new GraphStoreError("invalid-edge", `来源为 ${origin} 的关系必须提供 evidence`);
				const merged = {
					...existing,
					origin: ORIGIN_PRIORITY[origin] > ORIGIN_PRIORITY[existing.origin] ? origin : existing.origin,
					status: mergeStatus(existing.status, status),
					updatedAt: input.updatedAt ?? this.now()
				};
				if (input.confidence !== void 0) merged.confidence = Math.max(existing.confidence ?? 0, clamp01(input.confidence));
				if (evidence.length > 0) merged.evidence = evidence;
				this.edges.set(existing.id, merged);
				this.touch();
				this.emit({
					type: "edge:updated",
					edge: merged,
					previous: existing
				});
				return merged;
			}
		}
		if (requiresEvidence && inputEvidence.length === 0) throw new GraphStoreError("invalid-edge", `来源为 ${origin} 的关系必须提供 evidence`);
		let id = (input.id ?? "").trim() || edgeIdFor(source, target, relation);
		if (this.edges.has(id)) {
			const existing = this.edges.get(id);
			if (existing && existing.source === source && existing.target === target && existing.relation === relation) throw new GraphStoreError("duplicate-edge", `关系已存在：${id}`);
			do
				id = createId("edge");
			while (this.edges.has(id));
		}
		const createdAt = input.createdAt ?? this.now();
		const edge = {
			id,
			source,
			target,
			relation,
			origin,
			status,
			createdAt,
			updatedAt: input.updatedAt ?? createdAt
		};
		if (input.confidence !== void 0) edge.confidence = clamp01(input.confidence);
		if (inputEvidence.length > 0) edge.evidence = inputEvidence;
		if (input.userRenamed === true) edge.userRenamed = true;
		this.edges.set(id, edge);
		this.edgeIndex.set(key, id);
		this.adjacency.get(source)?.add(id);
		this.adjacency.get(target)?.add(id);
		this.touch();
		this.emit({
			type: "edge:added",
			edge
		});
		return edge;
	}
	getEdge(id) {
		return this.edges.get(id);
	}
	updateEdge(id, patch) {
		const current = this.edges.get(id);
		if (!current) throw new GraphStoreError("invalid-edge", `关系不存在：${id}`);
		if (patch.id !== void 0 && patch.id !== id) throw new GraphStoreError("invalid-edge", "关系 id 不可修改");
		if (patch.source !== void 0 && patch.source !== current.source) throw new GraphStoreError("invalid-edge", "关系 source 不可修改");
		if (patch.target !== void 0 && patch.target !== current.target) throw new GraphStoreError("invalid-edge", "关系 target 不可修改");
		if (patch.createdAt !== void 0 && patch.createdAt !== current.createdAt) throw new GraphStoreError("invalid-edge", "关系 createdAt 不可修改");
		const relation = patch.relation === void 0 ? current.relation : patch.relation.trim();
		if (!relation) throw new GraphStoreError("invalid-edge", "关系名不能为空");
		if (relation !== current.relation) {
			const existingId = this.edgeIndex.get(this.edgeKey(current.source, current.target, relation));
			if (existingId && existingId !== id) throw new GraphStoreError("duplicate-edge", `已存在相同关系：${current.source} → ${current.target}（${relation}）`);
		}
		const status = patch.status ?? current.status;
		if (!isRelationStatus(status)) throw new GraphStoreError("invalid-edge", `未知的关系状态：${String(status)}`);
		const next = {
			...current,
			relation,
			status,
			updatedAt: this.now()
		};
		if (relation !== current.relation && (current.origin === "rule" || current.origin === "ai")) {
			if (id === edgeIdFor(current.source, current.target, relation)) delete next.userRenamed;
			else next.userRenamed = true;
		}
		if (patch.userRenamed !== void 0) {
			if (patch.userRenamed) next.userRenamed = true;
			else delete next.userRenamed;
		}
		if (patch.confidence !== void 0) next.confidence = clamp01(patch.confidence);
		if (patch.evidence !== void 0) {
			const evidence = uniqueStrings(patch.evidence);
			if (evidence.length === 0 && (current.origin === "rule" || current.origin === "ai")) throw new GraphStoreError("invalid-edge", `来源为 ${current.origin} 的关系必须保留 evidence`);
			if (evidence.length > 0) next.evidence = evidence;
			else delete next.evidence;
		}
		if (relation !== current.relation) {
			this.edgeIndex.delete(this.edgeKey(current.source, current.target, current.relation));
			this.edgeIndex.set(this.edgeKey(next.source, next.target, relation), id);
		}
		this.edges.set(id, next);
		this.touch();
		this.emit({
			type: "edge:updated",
			edge: next,
			previous: current
		});
		return next;
	}
	removeEdge(id) {
		const edge = this.edges.get(id);
		if (!edge) return false;
		this.edges.delete(id);
		this.edgeIndex.delete(this.edgeKey(edge.source, edge.target, edge.relation));
		this.adjacency.get(edge.source)?.delete(id);
		this.adjacency.get(edge.target)?.delete(id);
		this.touch();
		this.emit({
			type: "edge:removed",
			edgeId: id
		});
		return true;
	}
	listEdges() {
		return [...this.edges.values()].sort((left, right) => compareText(left.source, right.source) || compareText(left.target, right.target) || compareText(left.relation, right.relation) || compareText(left.id, right.id));
	}
	findEdge(source, target, relation) {
		const ids = this.adjacency.get(source);
		if (!ids) return void 0;
		for (const id of ids) {
			const edge = this.edges.get(id);
			if (!edge) continue;
			if (relation && edge.relation !== relation) continue;
			if (edge.source === source && edge.target === target) return edge;
		}
	}
	areConnected(left, right) {
		if (left === right) return true;
		const ids = this.adjacency.get(left);
		if (!ids) return false;
		for (const id of ids) {
			const edge = this.edges.get(id);
			if (!edge) continue;
			if (edge.source === right || edge.target === right) return true;
		}
		return false;
	}
	degree(id) {
		return this.adjacency.get(id)?.size ?? 0;
	}
	neighbors(id, query = {}) {
		const ids = this.adjacency.get(id);
		if (!ids) return [];
		const direction = query.direction ?? "both";
		const entries = [];
		for (const edgeId of ids) {
			const edge = this.edges.get(edgeId);
			if (!edge) continue;
			if (query.relations && !query.relations.includes(edge.relation)) continue;
			if (query.origins && !query.origins.includes(edge.origin)) continue;
			if (query.statuses && !query.statuses.includes(edge.status)) continue;
			let otherId;
			if (edge.source === id) {
				if (direction === "incoming") continue;
				otherId = edge.target;
			} else {
				if (direction === "outgoing") continue;
				otherId = edge.source;
			}
			const node = this.nodes.get(otherId);
			if (!node) continue;
			entries.push({
				edge,
				node
			});
		}
		entries.sort((left, right) => compareText(left.node.title, right.node.title) || compareText(left.edge.id, right.edge.id));
		return entries;
	}
	toJSON() {
		const graph = {
			schemaVersion: this.schemaVersion,
			updatedAt: this.updatedAt,
			nodes: [...this.nodes.values()].sort((left, right) => compareText(left.id, right.id)),
			edges: [...this.edges.values()].sort((left, right) => compareText(left.id, right.id))
		};
		if (this.viewport) graph.viewport = { ...this.viewport };
		return graph;
	}
	getGraph() {
		return this.toJSON();
	}
	/** 返回当前图谱的结构错误；空数组表示合法。 */
	validate() {
		return validateGraphStructure(this.toJSON());
	}
	replace(graph, options = {}) {
		this.nodes.clear();
		this.edges.clear();
		this.edgeIndex.clear();
		this.adjacency.clear();
		for (const node of graph.nodes ?? []) {
			if (!node || typeof node.id !== "string" || !node.id) continue;
			if (!isNodeType(node.type)) continue;
			this.nodes.set(node.id, {
				...node,
				...node.sourceUri ? { sourceUri: normalizeSourceUri(node.sourceUri) } : {},
				tags: sanitizeTags(node.tags),
				metadata: { ...node.metadata ?? {} }
			});
			this.adjacency.set(node.id, /* @__PURE__ */ new Set());
		}
		for (const edge of graph.edges ?? []) {
			if (!edge || typeof edge.id !== "string") continue;
			if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) continue;
			if (edge.source === edge.target) continue;
			if (!isRelationOrigin(edge.origin) || !isRelationStatus(edge.status)) continue;
			this.edges.set(edge.id, { ...edge });
			this.edgeIndex.set(this.edgeKey(edge.source, edge.target, edge.relation), edge.id);
			this.adjacency.get(edge.source)?.add(edge.id);
			this.adjacency.get(edge.target)?.add(edge.id);
		}
		this.schemaVersion = graph.schemaVersion ?? this.schemaVersion;
		this.updatedAt = graph.updatedAt ?? this.now();
		this.viewport = graph.viewport ? { ...graph.viewport } : void 0;
		if (!options.silent) this.emit({
			type: "graph:replaced",
			graph: this.toJSON()
		});
	}
	/** 视口变化不参与撤销与刷新，默认静默，只负责持久化。 */
	setViewport(viewport, options = {}) {
		this.viewport = viewport ? { ...viewport } : void 0;
		if (options.silent) return;
		this.emit({
			type: "viewport:changed",
			viewport: this.currentViewport
		});
	}
	clear() {
		if (this.isEmpty() && !this.viewport) return;
		this.nodes.clear();
		this.edges.clear();
		this.edgeIndex.clear();
		this.adjacency.clear();
		this.viewport = void 0;
		this.touch();
		this.emit({
			type: "graph:replaced",
			graph: this.toJSON()
		});
	}
	statsCache = null;
	revision = 0;
	stats() {
		const cacheKey = `${this.updatedAt}:${this.revision}`;
		if (this.statsCache?.key === cacheKey) return this.statsCache.value;
		const nodes = this.nodes.size;
		const edges = this.edges.size;
		let confirmed = 0;
		let suggested = 0;
		let rejected = 0;
		let orphans = 0;
		const confirmedNodes = /* @__PURE__ */ new Set();
		for (const edge of this.edges.values()) if (edge.status === "confirmed") {
			confirmed += 1;
			confirmedNodes.add(edge.source);
			confirmedNodes.add(edge.target);
		} else if (edge.status === "suggested") suggested += 1;
		else rejected += 1;
		const byType = {
			project: 0,
			document: 0,
			topic: 0,
			image: 0,
			audio: 0,
			video: 0,
			activity: 0
		};
		for (const node of this.nodes.values()) byType[node.type] += 1;
		for (const node of this.nodes.values()) if (!confirmedNodes.has(node.id) && !node.metadata?.nextStep) orphans += 1;
		const value = {
			nodes,
			edges,
			confirmed,
			suggested,
			rejected,
			orphans,
			averageDegree: nodes === 0 ? 0 : confirmed * 2 / nodes,
			byType
		};
		this.statsCache = {
			key: cacheKey,
			value
		};
		return value;
	}
	subscribe(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	buildNode(input) {
		const title = (input.title ?? "").trim();
		if (!title) throw new GraphStoreError("invalid-node", "节点标题不能为空");
		const type = input.type ?? "document";
		if (!isNodeType(type)) throw new GraphStoreError("invalid-node", `未知的节点类型：${String(type)}`);
		const id = (input.id ?? "").trim() || createId("node");
		const createdAt = input.createdAt ?? this.now();
		const node = {
			id,
			type,
			title,
			tags: sanitizeTags(input.tags ?? []),
			createdAt,
			updatedAt: input.updatedAt ?? createdAt,
			metadata: { ...input.metadata ?? {} }
		};
		if (input.sourceUri) node.sourceUri = normalizeSourceUri(input.sourceUri);
		return node;
	}
	edgeKey(source, target, relation) {
		return `${source}\u0000${target}\u0000${relation}`;
	}
	touch() {
		this.revision += 1;
		this.updatedAt = this.now();
	}
	emit(event) {
		for (const listener of [...this.listeners]) try {
			listener(event);
		} catch (error) {
			console.error("[InterestSeed] 图谱监听器执行失败", error);
		}
	}
};
//#endregion
//#region src/core/RelationEngine.ts
/** 首版来自 T2-A 实测的工程安全边界，不声称是推荐质量最优值。 */
var DEFAULT_SHARED_TAG_POLICY = {
	maxTagSupport: 500,
	maxPairsPerTag: 50,
	maxTagCandidates: 200
};
function pairKey(left, right) {
	return left <= right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}
function positiveInteger(value, fallback) {
	if (!Number.isFinite(value)) return fallback;
	return Math.max(0, Math.floor(value));
}
function betterPair(left, right) {
	if (left.shared !== right.shared) return left.shared > right.shared;
	if (left.hash !== right.hash) return left.hash < right.hash;
	return left.key < right.key;
}
/** 有界选择器：只保留当前最优的 limit 条，不保存全部 pair。 */
var BoundedPairSelection = class {
	limit;
	items = [];
	seen = /* @__PURE__ */ new Map();
	constructor(limit) {
		this.limit = limit;
	}
	consider(pair) {
		if (this.limit <= 0 || this.seen.has(pair.key)) return;
		if (this.items.length < this.limit) {
			this.insert(pair);
			return;
		}
		const worst = this.items[this.items.length - 1];
		if (!worst || !betterPair(pair, worst)) return;
		this.items.pop();
		this.seen.delete(worst.key);
		this.insert(pair);
	}
	all() {
		return [...this.items];
	}
	insert(pair) {
		let low = 0;
		let high = this.items.length;
		while (low < high) {
			const middle = low + high >> 1;
			const current = this.items[middle];
			if (current && betterPair(current, pair)) low = middle + 1;
			else high = middle;
		}
		this.items.splice(low, 0, pair);
		this.seen.set(pair.key, pair);
	}
};
function sharedTags(left, right, tagSets) {
	const leftTags = tagSets.get(left.id);
	const rightTags = tagSets.get(right.id);
	if (!leftTags || !rightTags) return [];
	const shared = [];
	for (const tag of leftTags) if (rightTags.has(tag)) shared.push(tag);
	return shared.sort(compareText);
}
function sharedTagCount(left, right, tagSets) {
	const leftTags = tagSets.get(left.id);
	const rightTags = tagSets.get(right.id);
	if (!leftTags || !rightTags) return 0;
	let count = 0;
	for (const tag of leftTags) if (rightTags.has(tag)) count += 1;
	return count;
}
/**
* 候选关系引擎（v1）。
*
* 只实现有明确证据的规则：
* 1. 笔记之间存在显式 Obsidian 链接（单向或双向）；
* 2. 两篇笔记共享标签；
* 3. 笔记与用户定义的主题节点（无 sourceUri 的 topic 节点）共享标签。
*
* 不做标题相似度推断，避免仅凭相似标题制造大量无意义关系。
*/
var InterestSeedRelationEngine = class {
	now;
	unresolvedLinks = [];
	tagReport = {
		totalTags: 0,
		filteredTags: 0,
		pairsBeforeFilter: 0,
		pairsSkippedBySupport: 0,
		tagCandidates: 0
	};
	policy;
	constructor(now = () => (/* @__PURE__ */ new Date()).toISOString(), policy = {}) {
		this.now = now;
		this.policy = {
			maxTagSupport: positiveInteger(policy.maxTagSupport ?? DEFAULT_SHARED_TAG_POLICY.maxTagSupport, DEFAULT_SHARED_TAG_POLICY.maxTagSupport),
			maxPairsPerTag: positiveInteger(policy.maxPairsPerTag ?? DEFAULT_SHARED_TAG_POLICY.maxPairsPerTag, DEFAULT_SHARED_TAG_POLICY.maxPairsPerTag),
			maxTagCandidates: positiveInteger(policy.maxTagCandidates ?? DEFAULT_SHARED_TAG_POLICY.maxTagCandidates, DEFAULT_SHARED_TAG_POLICY.maxTagCandidates)
		};
	}
	/** 最近一次 suggest 中未能解析的链接，供构建报告使用。 */
	get lastUnresolvedLinks() {
		return [...this.unresolvedLinks];
	}
	/** 最近一次共享标签降噪的测试辅助统计，不进入持久化数据。 */
	get lastTagReport() {
		return { ...this.tagReport };
	}
	suggest(nodes) {
		this.unresolvedLinks = [];
		this.tagReport = {
			totalTags: 0,
			filteredTags: 0,
			pairsBeforeFilter: 0,
			pairsSkippedBySupport: 0,
			tagCandidates: 0
		};
		const candidates = [];
		const connected = /* @__PURE__ */ new Set();
		const resolver = this.createResolver(nodes);
		const now = this.now();
		const makeEdge = (source, target, relation, origin, confidence, reasons) => ({
			id: edgeIdFor(source, target, relation),
			source,
			target,
			relation,
			origin,
			status: "suggested",
			confidence,
			evidence: [...reasons],
			createdAt: now,
			updatedAt: now
		});
		for (const node of nodes) {
			const rawLinks = node.metadata.links;
			if (!Array.isArray(rawLinks)) continue;
			for (const rawLink of rawLinks) {
				if (typeof rawLink !== "string" || !rawLink.trim()) continue;
				const link = rawLink.trim();
				if (/\.(png|jpe?g|gif|webp|svg|pdf|mp3|mp4|webm|canvas)$/i.test(link)) continue;
				const target = resolver(link);
				if (!target) {
					this.unresolvedLinks.push(`${node.title} → [[${link}]]`);
					continue;
				}
				if (target.id === node.id) continue;
				connected.add(pairKey(node.id, target.id));
				const reasons = [`笔记《${node.title}》中存在链接：[[${link}]]`];
				candidates.push({
					edge: makeEdge(node.id, target.id, "references", "user", 1, reasons),
					reasons
				});
			}
		}
		const tagSets = /* @__PURE__ */ new Map();
		const tagGroups = /* @__PURE__ */ new Map();
		for (const node of nodes) {
			if (node.type === "topic") continue;
			const nodeTags = /* @__PURE__ */ new Set();
			for (const tag of node.tags) {
				const key = tagKey(tag);
				if (key) nodeTags.add(key);
			}
			if (nodeTags.size === 0) continue;
			tagSets.set(node.id, nodeTags);
			for (const tag of nodeTags) {
				const members = tagGroups.get(tag);
				if (members) members.push(node);
				else tagGroups.set(tag, [node]);
			}
		}
		const tagEntries = [...tagGroups.entries()];
		this.tagReport.totalTags = tagEntries.length;
		for (const [, members] of tagEntries) this.tagReport.pairsBeforeFilter += members.length * (members.length - 1) / 2;
		const eligibleTags = [];
		for (const entry of tagEntries) {
			const members = entry[1];
			if (members.length < 2) continue;
			if (members.length > this.policy.maxTagSupport) {
				this.tagReport.filteredTags += 1;
				this.tagReport.pairsSkippedBySupport += members.length * (members.length - 1) / 2;
				continue;
			}
			eligibleTags.push(entry);
		}
		eligibleTags.sort(([left], [right]) => compareText(left, right));
		const globalSelection = new BoundedPairSelection(this.policy.maxTagCandidates);
		for (const [, members] of eligibleTags) {
			const tagSelection = new BoundedPairSelection(this.policy.maxPairsPerTag);
			for (let left = 0; left < members.length; left += 1) {
				const first = members[left];
				if (!first) continue;
				for (let right = left + 1; right < members.length; right += 1) {
					const second = members[right];
					if (!second) continue;
					const key = pairKey(first.id, second.id);
					if (connected.has(key)) continue;
					tagSelection.consider({
						left: first,
						right: second,
						key,
						shared: sharedTagCount(first, second, tagSets),
						hash: hash64(key)
					});
				}
			}
			for (const pair of tagSelection.all()) globalSelection.consider(pair);
		}
		const selectedPairs = globalSelection.all();
		this.tagReport.tagCandidates = selectedPairs.length;
		for (const pair of selectedPairs) {
			const shared = sharedTags(pair.left, pair.right, tagSets);
			if (shared.length === 0) continue;
			const confidence = clamp01(.45 + .1 * Math.min(shared.length, 3));
			const reasons = [`两个笔记具有相同标签：${shared.join("、")}`];
			candidates.push({
				edge: makeEdge(pair.left.id, pair.right.id, "related-to", "rule", confidence, reasons),
				reasons
			});
		}
		const topics = nodes.filter((node) => node.type === "topic" && !node.sourceUri);
		if (topics.length > 0) for (const node of nodes) {
			if (node.type === "topic") continue;
			if (node.tags.length === 0) continue;
			for (const topic of topics) {
				if (connected.has(pairKey(node.id, topic.id))) continue;
				const noteTags = new Set(node.tags.map((tag) => tagKey(tag)));
				const shared = topic.tags.map((tag) => tagKey(tag)).filter((tag) => noteTags.has(tag)).sort(compareText);
				if (shared.length === 0) continue;
				const confidence = clamp01(.55 + .1 * Math.min(shared.length, 3));
				const reasons = [`匹配用户定义主题《${topic.title}》：共享标签 ${shared.map((tag) => `#${tag}`).join("、")}`];
				candidates.push({
					edge: makeEdge(node.id, topic.id, "about", "rule", confidence, reasons),
					reasons
				});
			}
		}
		candidates.sort((left, right) => compareText(left.edge.source, right.edge.source) || compareText(left.edge.target, right.edge.target) || compareText(left.edge.relation, right.edge.relation));
		return candidates;
	}
	createResolver(nodes) {
		const byPath = /* @__PURE__ */ new Map();
		const byTitle = /* @__PURE__ */ new Map();
		for (const node of nodes) {
			if (!node.sourceUri) continue;
			const path = pathFromUri(node.sourceUri);
			byPath.set(path.toLowerCase(), node);
			byPath.set(stripExtension(path).toLowerCase(), node);
			const title = noteTitleFromPath(path).toLowerCase();
			if (!byTitle.has(title)) byTitle.set(title, node);
		}
		return (target) => {
			const path = linkTargetToPath(target);
			if (!path) return null;
			return byPath.get(path.toLowerCase()) ?? byPath.get(stripExtension(path).toLowerCase()) ?? byTitle.get(noteTitleFromPath(path).toLowerCase()) ?? null;
		};
	}
};
//#endregion
//#region src/core/GraphBuilder.ts
function edgeKey(source, target, relation) {
	return `${source}\u0000${target}\u0000${relation}`;
}
function undirectedPairKey(source, target) {
	return source <= target ? `${source}\u0000${target}` : `${target}\u0000${source}`;
}
function metadataWithoutPosition(metadata) {
	const copy = { ...metadata };
	delete copy.position;
	return copy;
}
function sameNodeContent(left, right) {
	return left.title === right.title && left.type === right.type && left.tags.length === right.tags.length && left.tags.every((tag, index) => tag === right.tags[index]) && JSON.stringify(metadataWithoutPosition(left.metadata)) === JSON.stringify(metadataWithoutPosition(right.metadata));
}
function sameEdgeContent(left, right) {
	if (left.origin !== right.origin || left.status !== right.status || left.confidence !== right.confidence) return false;
	const leftEvidence = left.evidence ?? [];
	const rightEvidence = right.evidence ?? [];
	if (leftEvidence.length !== rightEvidence.length) return false;
	return leftEvidence.every((item, index) => item === rightEvidence[index]);
}
/**
* 构建地图。
*
* - 节点 id 由 `sourceUri` 稳定派生，重复扫描不会产生新节点；
* - 出链来自 MetadataCache，解析为 references（user / suggested）；
* - 只根据链接、共享标签与用户主题建立关系，绝不因为同目录就直接断言相关；
* - 以当前图谱为基线复用节点/关系的时间戳，并保留用户手动节点与
*   已确认 / 已拒绝 / AI 关系；
* - 扫描结果中消失的笔记节点会被移除，但手动节点始终保留。
*/
var InterestSeedGraphBuilder = class {
	currentGraph;
	relations;
	now;
	report = {
		nodes: 0,
		edges: 0,
		byType: {
			project: 0,
			document: 0,
			topic: 0,
			image: 0,
			audio: 0,
			video: 0,
			activity: 0
		},
		unresolvedLinks: [],
		warnings: [],
		conflicts: [],
		durationMs: 0
	};
	ruleSuggestions = true;
	minConfidence = .35;
	constructor(currentGraph, relations = new InterestSeedRelationEngine(), now = () => (/* @__PURE__ */ new Date()).toISOString()) {
		this.currentGraph = currentGraph;
		this.relations = relations;
		this.now = now;
	}
	get lastReport() {
		return this.report;
	}
	/** 规则建议开关来自插件设置，不属于 GraphBuildOptions。 */
	configure(ruleOptions) {
		if (ruleOptions.enableRuleSuggestions !== void 0) this.ruleSuggestions = ruleOptions.enableRuleSuggestions;
		if (ruleOptions.minConfidence !== void 0) this.minConfidence = ruleOptions.minConfidence;
	}
	build(nodes, options) {
		return this.buildWithReport(nodes, options).graph;
	}
	buildWithReport(nodes, options) {
		const startedAt = Date.now();
		const current = this.currentGraph();
		const warnings = [];
		const unresolvedLinks = [];
		const conflicts = [];
		const conflictProtectedIds = /* @__PURE__ */ new Set();
		const currentNodeById = /* @__PURE__ */ new Map();
		const currentNodeByUri = /* @__PURE__ */ new Map();
		const currentEdgeByKey = /* @__PURE__ */ new Map();
		const currentEdgeById = /* @__PURE__ */ new Map();
		const currentRelatedPair = /* @__PURE__ */ new Map();
		for (const node of current.nodes) {
			currentNodeById.set(node.id, node);
			if (node.sourceUri) currentNodeByUri.set(node.sourceUri.toLowerCase(), node);
		}
		for (const edge of current.edges) {
			currentEdgeByKey.set(edgeKey(edge.source, edge.target, edge.relation), edge);
			currentEdgeById.set(edge.id, edge);
			if (edge.relation === "related-to") {
				const pair = undirectedPairKey(edge.source, edge.target);
				const existing = currentRelatedPair.get(pair);
				if (!existing || existing.status === "suggested" && edge.status !== "suggested") currentRelatedPair.set(pair, edge);
			}
		}
		const store = new InterestSeedGraphStore(void 0, { now: this.now });
		for (const node of current.nodes) {
			if (node.sourceUri) continue;
			try {
				store.addNode(node);
			} catch (error) {
				warnings.push(`手动节点「${node.title}」无法保留：${error instanceof Error ? error.message : String(error)}`);
			}
		}
		const seenIds = /* @__PURE__ */ new Set();
		for (const node of nodes) {
			const path = node.sourceUri ? pathFromUri(node.sourceUri) : "";
			if (node.sourceUri && !this.inScope(path, options)) continue;
			if (!this.tagsAllowed(node.tags, options)) continue;
			const id = node.sourceUri ? nodeIdForUri(node.sourceUri) : node.id;
			if (seenIds.has(id)) {
				warnings.push(`重复的节点来源被忽略：${node.sourceUri ?? node.title}`);
				continue;
			}
			seenIds.add(id);
			const existing = (node.sourceUri ? currentNodeByUri.get(node.sourceUri.toLowerCase()) : void 0) ?? currentNodeById.get(id);
			const createdAt = existing?.createdAt ?? node.createdAt;
			const updatedAt = existing && sameNodeContent(existing, node) ? existing.updatedAt : node.updatedAt;
			const metadata = { ...node.metadata };
			const savedPosition = existing?.metadata.position;
			if (savedPosition !== void 0) metadata.position = savedPosition;
			try {
				store.addNode({
					...node,
					id,
					createdAt,
					updatedAt,
					metadata
				});
			} catch (error) {
				warnings.push(`节点「${node.title}」无法加入：${error instanceof Error ? error.message : String(error)}`);
			}
		}
		const candidates = this.relations.suggest(store.listNodes());
		if (this.relations instanceof InterestSeedRelationEngine && options.includeOutgoingLinks) unresolvedLinks.push(...this.relations.lastUnresolvedLinks);
		for (const candidate of candidates) {
			const edge = candidate.edge;
			if (edge.relation === "references" && !options.includeOutgoingLinks) continue;
			if (edge.origin === "rule") {
				if (!this.ruleSuggestions) continue;
				if ((edge.confidence ?? 0) < this.minConfidence) continue;
			}
			if (edge.relation === "related-to") {
				const existing = currentRelatedPair.get(undirectedPairKey(edge.source, edge.target));
				if (existing && existing.status !== "suggested") continue;
				if (existing && (existing.source !== edge.source || existing.target !== edge.target)) {
					edge.source = existing.source;
					edge.target = existing.target;
					edge.id = edgeIdFor(existing.source, existing.target, edge.relation);
				}
			}
			const existingById = currentEdgeById.get(edge.id);
			if (existingById && existingById.relation !== edge.relation) {
				conflictProtectedIds.add(existingById.id);
				conflicts.push({
					edgeId: existingById.id,
					keptRelation: existingById.relation,
					candidateRelation: edge.relation,
					source: existingById.source,
					target: existingById.target
				});
				continue;
			}
			this.addRegenerableEdge(store, {
				...edge,
				evidence: candidate.reasons
			}, currentEdgeByKey, warnings);
		}
		for (const edge of current.edges) {
			const protectedRename = edge.userRenamed === true || conflictProtectedIds.has(edge.id);
			if (edge.status === "suggested" && edge.origin !== "ai" && !protectedRename) continue;
			if (!store.getNode(edge.source) || !store.getNode(edge.target)) continue;
			try {
				store.addEdge({ ...edge });
			} catch (error) {
				warnings.push(`关系 ${edge.id} 无法保留：${error instanceof Error ? error.message : String(error)}`);
			}
		}
		const graph = store.toJSON();
		graph.updatedAt = this.now();
		const byType = {
			project: 0,
			document: 0,
			topic: 0,
			image: 0,
			audio: 0,
			video: 0,
			activity: 0
		};
		for (const node of graph.nodes) byType[node.type] += 1;
		this.report = {
			nodes: graph.nodes.length,
			edges: graph.edges.length,
			byType,
			unresolvedLinks: unresolvedLinks.slice(0, 50),
			warnings: warnings.slice(0, 50),
			conflicts: conflicts.slice(0, 50),
			durationMs: Math.max(0, Date.now() - startedAt)
		};
		return {
			graph,
			report: this.report
		};
	}
	addRegenerableEdge(store, input, currentEdgeByKey, warnings) {
		const key = edgeKey(input.source, input.target, input.relation);
		const existing = currentEdgeByKey.get(key);
		if (existing && existing.status !== "suggested") return;
		const next = { ...input };
		if (existing) {
			next.createdAt = existing.createdAt;
			if (sameEdgeContent(existing, {
				origin: input.origin ?? "user",
				status: input.status ?? "confirmed",
				confidence: input.confidence,
				evidence: input.evidence ? [...input.evidence] : void 0
			})) next.updatedAt = existing.updatedAt;
		}
		try {
			store.addEdge(next);
		} catch (error) {
			warnings.push(`关系 ${input.source} → ${input.target} 无法创建：${error instanceof Error ? error.message : String(error)}`);
		}
	}
	inScope(path, options) {
		if (options.includeFolders.length === 0) return true;
		return options.includeFolders.some((folder) => isInsideFolder(path, folder));
	}
	tagsAllowed(tags, options) {
		if (options.includeTags.length === 0) return true;
		const wanted = new Set(options.includeTags.map((tag) => tagKey(tag)));
		return tags.some((tag) => wanted.has(tagKey(tag)));
	}
};
//#endregion
//#region src/adapters/vaultScan.ts
/**
* 扫描范围：先排除，再按 include 白名单；include 为空表示整个 vault。
* 只处理 vault 内相对路径，不涉及任何绝对路径拼接。
*/
function shouldScanPath(path, scope) {
	if (scope.excludeFolders.some((folder) => isInsideFolder(path, folder))) return false;
	if (scope.includeFolders.length === 0) return true;
	return scope.includeFolders.some((folder) => isInsideFolder(path, folder));
}
/** 合并 frontmatter tags 与 MetadataCache 的内联标签。 */
function collectNodeTags(frontmatterTags, inlineTags) {
	const raw = [];
	const push = (value) => {
		if (typeof value === "string") raw.push(...value.split(/[,，;；\s]+/));
		else if (Array.isArray(value)) {
			for (const item of value) if (typeof item === "string") raw.push(item);
		}
	};
	push(frontmatterTags);
	raw.push(...inlineTags);
	return sanitizeTags(raw);
}
function matchesIncludeTags(tags, includeTags) {
	if (includeTags.length === 0) return true;
	const wanted = new Set(includeTags.map((tag) => tagKey(tag)));
	return tags.some((tag) => wanted.has(tagKey(tag)));
}
/**
* 类型优先级：frontmatter.type → project / activity 标记 → 默认 document。
* 扫描只处理 Markdown，因此这里不需要扩展名分支。
*/
function nodeTypeFromFrontmatter(frontmatter) {
	const declared = frontmatter.type;
	if (isNodeType(declared)) return declared;
	const project = frontmatter.project;
	if (project === true || project === "true") return "project";
	const activity = frontmatter.activity;
	if (activity === true || activity === "true") return "activity";
	return "document";
}
function titleFromMetadata(frontmatterTitle, headings, path) {
	if (typeof frontmatterTitle === "string" && frontmatterTitle.trim()) return frontmatterTitle.trim();
	const firstHeading = headings.find((heading) => heading.level === 1 && heading.heading.trim());
	if (firstHeading) return firstHeading.heading.trim();
	return noteTitleFromPath(path);
}
/**
* 把一次扫描结果转换为节点。节点只保存索引与图谱信息：
* 路径、扩展名、摘要、出链列表，不保存正文。
*/
function createSeedNode(input) {
	const metadata = {
		path: input.path,
		extension: input.extension,
		links: [...input.links]
	};
	if (input.summary) metadata.summary = input.summary;
	return {
		id: nodeIdForUri(input.uri),
		type: input.type,
		title: input.title,
		sourceUri: input.uri,
		tags: [...input.tags],
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
		metadata
	};
}
//#endregion
//#region standalone/src/vault.ts
async function scanVault(vaultPath, config) {
	const nodes = [];
	let files = 0;
	let skipped = 0;
	const walk = async (dir) => {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(dir, entry.name);
			const rel = relative(vaultPath, full).replace(/\\/g, "/");
			if (entry.isDirectory()) {
				if (shouldScanPath(rel, config)) await walk(full);
				continue;
			}
			if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
			if (!shouldScanPath(rel, config)) {
				skipped += 1;
				continue;
			}
			files += 1;
			const node = await nodeFromFile(full, rel);
			if (node && matchesIncludeTags(node.tags, config.includeTags)) nodes.push(node);
		}
	};
	await walk(vaultPath);
	return {
		nodes,
		files,
		skipped
	};
}
async function nodeFromFile(fullPath, relPath) {
	const frontmatter = parseFrontmatter((await readFile(fullPath, "utf8")).replace(/^\uFEFF/, ""));
	const body = frontmatter.body;
	const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
		level: match[1].length,
		heading: match[2].trim()
	}));
	const inlineTags = [...body.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map((match) => `#${match[1]}`);
	const tags = collectNodeTags(frontmatter.data.tags, inlineTags);
	const links = [...[...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1].split("|")[0])];
	const info = await stat(fullPath);
	const title = titleFromMetadata(frontmatter.data.title, headings, relPath);
	const summary = firstParagraph(body);
	return createSeedNode({
		uri: vaultUri(relPath),
		path: relPath,
		title,
		type: nodeTypeFromFrontmatter(frontmatter.data),
		tags,
		createdAt: info.birthtime.toISOString(),
		updatedAt: info.mtime.toISOString(),
		summary,
		links,
		extension: "md"
	});
}
function firstParagraph(body) {
	const lines = body.split(/\r?\n/);
	const paragraph = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (paragraph.length > 0) break;
			continue;
		}
		if (trimmed.startsWith("#") || trimmed.startsWith("```")) continue;
		paragraph.push(trimmed);
		if (paragraph.join(" ").length >= 180) break;
	}
	return paragraph.join(" ").slice(0, 240).trim();
}
function parseFrontmatter(raw) {
	if (!raw.startsWith("---")) return {
		data: {},
		body: raw
	};
	const end = raw.indexOf("\n---", 3);
	if (end < 0) return {
		data: {},
		body: raw
	};
	const text = raw.slice(3, end).replace(/^\r?\n/, "");
	const body = raw.slice(end + 4).replace(/^\r?\n/, "");
	const data = {};
	let currentKey = null;
	for (const line of text.split(/\r?\n/)) {
		const arrayItem = /^\s*-\s+(.+)$/.exec(line);
		if (arrayItem && currentKey) {
			const value = data[currentKey];
			if (!Array.isArray(value)) data[currentKey] = [];
			data[currentKey].push(stripQuotes(arrayItem[1].trim()));
			continue;
		}
		const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (!match) continue;
		currentKey = match[1];
		const value = match[2].trim();
		if (!value) data[currentKey] = [];
		else if (value.startsWith("[") && value.endsWith("]")) data[currentKey] = value.slice(1, -1).split(",").map((item) => stripQuotes(item.trim())).filter(Boolean);
		else data[currentKey] = stripQuotes(value);
	}
	return {
		data,
		body
	};
}
function stripQuotes(value) {
	return value.replace(/^["']|["']$/g, "");
}
//#endregion
//#region standalone/src/graph.ts
async function scanAndBuild(vaultPath) {
	const config = await loadConfig(vaultPath);
	const state = await loadState(vaultPath);
	const scan = await scanVault(vaultPath, config);
	const builder = new InterestSeedGraphBuilder(() => state.graph);
	builder.configure({ enableRuleSuggestions: true });
	const result = builder.buildWithReport(scan.nodes, {
		includeFolders: config.includeFolders,
		includeTags: config.includeTags,
		includeOutgoingLinks: true
	});
	await saveGraph(vaultPath, result.graph);
	return {
		graph: result.graph,
		files: scan.files,
		skipped: scan.skipped,
		warnings: result.report.warnings,
		unresolvedLinks: result.report.unresolvedLinks
	};
}
//#endregion
//#region standalone/src/server.ts
var webRoot = [resolve(fileURLToPath(new URL("../web", import.meta.url))), resolve(fileURLToPath(new URL("./web", import.meta.url)))].find((path) => existsSync(join(path, "index.html"))) ?? resolve(fileURLToPath(new URL("../web", import.meta.url)));
function startServer(options) {
	createServer(async (request, response) => {
		try {
			await route(request, response, options);
		} catch (error) {
			sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
		}
	}).listen(options.port, "127.0.0.1", () => {
		console.log(`InterestSeed running at http://127.0.0.1:${options.port}`);
		console.log(`Vault: ${options.vaultPath}`);
	});
}
async function route(request, response, options) {
	const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
	if (url.pathname === "/api/state") return sendJson(response, 200, await statePayload(options.vaultPath));
	if (url.pathname === "/api/scan" && request.method === "POST") {
		const result = await scanAndBuild(options.vaultPath);
		return sendJson(response, 200, {
			...await statePayload(options.vaultPath),
			files: result.files,
			skipped: result.skipped,
			warnings: result.warnings
		});
	}
	if (url.pathname === "/api/capture" && request.method === "POST") {
		const body = await readJson(request);
		const captured = await captureToVault(options.vaultPath, {
			text: typeof body.text === "string" ? body.text : "",
			...typeof body.url === "string" ? { url: body.url } : {},
			...typeof body.title === "string" ? { title: body.title } : {}
		});
		await scanAndBuild(options.vaultPath);
		return sendJson(response, 200, {
			ok: true,
			captured,
			...await statePayload(options.vaultPath)
		});
	}
	if (url.pathname === "/api/suggest" && (request.method === "GET" || request.method === "POST")) {
		const body = request.method === "POST" ? await readJson(request) : {};
		const nodeId = url.searchParams.get("nodeId") ?? (typeof body.nodeId === "string" ? body.nodeId : void 0);
		return sendJson(response, 200, { suggestions: await suggestRelations(options.vaultPath, nodeId ?? void 0) });
	}
	if (url.pathname === "/api/connect" && request.method === "POST") {
		const suggestion = (await readJson(request)).suggestion;
		if (!suggestion) return sendJson(response, 400, { error: "suggestion required" });
		return sendJson(response, 200, await connectSuggestion(options.vaultPath, suggestion));
	}
	if (url.pathname === "/api/undo" && request.method === "POST") {
		if (!await undoGraph(options.vaultPath)) return sendJson(response, 200, {
			ok: false,
			message: "Nothing to undo."
		});
		return sendJson(response, 200, {
			ok: true,
			...await statePayload(options.vaultPath)
		});
	}
	if (url.pathname === "/api/experiments" && request.method === "GET") return sendJson(response, 200, { experiments: (await listExperiments(options.vaultPath)).map(experimentView) });
	if (url.pathname === "/api/experiments" && request.method === "POST") {
		const body = await readJson(request);
		return sendJson(response, 200, {
			ok: true,
			experiment: experimentView(await startExperiment(options.vaultPath, {
				title: typeof body.title === "string" ? body.title : "",
				...typeof body.hypothesis === "string" ? { hypothesis: body.hypothesis } : {},
				...typeof body.nodeId === "string" ? { nodeId: body.nodeId } : {},
				...typeof body.targetDays === "number" ? { targetDays: body.targetDays } : {}
			}))
		});
	}
	if (url.pathname === "/api/experiments/log" && request.method === "POST") {
		const body = await readJson(request);
		return sendJson(response, 200, {
			ok: true,
			experiment: experimentView(await logExperiment(options.vaultPath, typeof body.id === "string" ? body.id : "", {
				interest: Number(body.interest ?? 3),
				energy: Number(body.energy ?? 3),
				evidence: typeof body.evidence === "string" ? body.evidence : "",
				...typeof body.next === "string" ? { next: body.next } : {}
			}))
		});
	}
	if (url.pathname === "/api/discoveries" && request.method === "GET") return sendJson(response, 200, { discoveries: (await listDiscoveries(options.vaultPath)).map(discoveryView) });
	if (url.pathname === "/api/discoveries/refresh" && request.method === "POST") return sendJson(response, 200, {
		ok: true,
		discoveries: (await refreshDiscoveries(options.vaultPath)).map(discoveryView)
	});
	if (url.pathname === "/api/discoveries/apply" && request.method === "POST") {
		const body = await readJson(request);
		return sendJson(response, 200, {
			...await applyDiscovery(options.vaultPath, typeof body.id === "string" ? body.id : ""),
			...await statePayload(options.vaultPath)
		});
	}
	if (url.pathname === "/api/discoveries/dismiss" && request.method === "POST") {
		const body = await readJson(request);
		return sendJson(response, 200, await dismissDiscovery(options.vaultPath, typeof body.id === "string" ? body.id : ""));
	}
	if (url.pathname === "/api/inbox" && request.method === "GET") return sendJson(response, 200, { items: await listInbox(options.vaultPath) });
	if (url.pathname === "/api/inbox" && request.method === "POST") {
		const body = await readJson(request);
		return sendJson(response, 200, {
			ok: true,
			...await enqueueInbox(options.vaultPath, typeof body.text === "string" ? body.text : "", body.source === "share" || body.source === "note" ? body.source : "clipboard", typeof body.sourceRef === "string" ? body.sourceRef : "")
		});
	}
	if (url.pathname === "/api/inbox/resolve" && request.method === "POST") {
		const body = await readJson(request);
		const status = body.status === "passed" ? "passed" : "kept";
		const result = await resolveInbox(options.vaultPath, typeof body.id === "string" ? body.id : "", status);
		if (status === "kept") await scanAndBuild(options.vaultPath);
		return sendJson(response, 200, {
			ok: true,
			...result,
			...await statePayload(options.vaultPath)
		});
	}
	if (url.pathname === "/api/config" && request.method === "GET") {
		const config = await loadConfig(options.vaultPath);
		const key = await resolveApiKey(options.vaultPath, config);
		return sendJson(response, 200, {
			config,
			keyReady: Boolean(key)
		});
	}
	if (url.pathname === "/api/config" && request.method === "PUT") {
		const body = await readJson(request);
		const config = await loadConfig(options.vaultPath);
		if (typeof body.model === "string" && body.model.trim()) config.model = body.model.trim();
		if (typeof body.baseUrl === "string" && body.baseUrl.trim()) config.baseUrl = body.baseUrl.trim();
		if (typeof body.keyEnv === "string" && body.keyEnv.trim()) config.keyEnv = body.keyEnv.trim();
		if (typeof body.enableAI === "boolean") config.enableAI = body.enableAI;
		if (typeof body.aiConsentGranted === "boolean") config.aiConsentGranted = body.aiConsentGranted;
		if (Array.isArray(body.includeFolders)) config.includeFolders = body.includeFolders.map(String);
		if (Array.isArray(body.excludeFolders)) config.excludeFolders = body.excludeFolders.map(String);
		if (Array.isArray(body.includeTags)) config.includeTags = body.includeTags.map(String);
		if (typeof body.key === "string") {
			await ensureStateDir(options.vaultPath);
			const keyPath = join(stateDir(options.vaultPath), "key");
			const value = body.key.trim();
			if (value) await writeFile(keyPath, value, "utf8");
			else if (existsSync(keyPath)) await rm(keyPath);
		}
		await saveConfig(options.vaultPath, config);
		const key = await resolveApiKey(options.vaultPath, config);
		return sendJson(response, 200, {
			ok: true,
			config,
			keyReady: Boolean(key)
		});
	}
	if (url.pathname === "/api/graph") return sendJson(response, 200, (await loadState(options.vaultPath)).graph);
	const filePath = url.pathname === "/" ? join(webRoot, "index.html") : join(webRoot, url.pathname);
	if (!filePath.startsWith(webRoot)) return sendText(response, 403, "Forbidden");
	try {
		const content = await readFile(filePath);
		response.writeHead(200, { "Content-Type": mime(filePath) });
		response.end(content);
	} catch {
		sendText(response, 404, "Not found");
	}
}
async function statePayload(vaultPath) {
	const state = await loadState(vaultPath);
	const config = await loadConfig(vaultPath);
	const key = await resolveApiKey(vaultPath, config);
	const active = await activeExperiment(vaultPath);
	const experiments = (await listExperiments(vaultPath)).map(experimentView);
	const discoveries = (await listDiscoveries(vaultPath)).map(discoveryView);
	const inbox = await listInbox(vaultPath);
	const degree = /* @__PURE__ */ new Map();
	for (const node of state.graph.nodes) degree.set(node.id, 0);
	for (const edge of state.graph.edges) {
		if (edge.status === "rejected") continue;
		degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
		degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
	}
	const top = [...state.graph.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)).slice(0, 3).map((node) => ({
		id: node.id,
		title: node.title,
		degree: degree.get(node.id) ?? 0
	}));
	const themeCounts = /* @__PURE__ */ new Map();
	for (const node of state.graph.nodes) for (const tag of node.tags ?? []) themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
	const insights = {
		top,
		themes: [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({
			tag,
			count
		})),
		orphans: state.graph.nodes.filter((node) => (degree.get(node.id) ?? 0) === 0).length
	};
	return {
		vaultPath,
		model: config.model,
		baseUrl: config.baseUrl,
		keyReady: Boolean(key),
		graph: state.graph,
		insights,
		activeExperiment: active ? experimentView(active) : null,
		experiments,
		discoveries,
		inbox: {
			pending: inbox.filter((item) => item.status === "pending").length,
			items: inbox
		},
		stats: {
			nodes: state.graph.nodes.length,
			edges: state.graph.edges.length,
			confirmed: state.graph.edges.filter((edge) => edge.status === "confirmed").length,
			suggested: state.graph.edges.filter((edge) => edge.status === "suggested").length
		}
	};
}
function sendJson(response, status, value) {
	response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
	response.end(JSON.stringify(value));
}
function sendText(response, status, value) {
	response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
	response.end(value);
}
async function readJson(request) {
	const chunks = [];
	for await (const chunk of request) chunks.push(Buffer.from(chunk));
	const raw = Buffer.concat(chunks).toString("utf8").trim();
	if (!raw) return {};
	return JSON.parse(raw);
}
function mime(path) {
	return {
		".html": "text/html; charset=utf-8",
		".js": "text/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".svg": "image/svg+xml",
		".png": "image/png"
	}[extname(path)] ?? "application/octet-stream";
}
//#endregion
//#region standalone/src/cli.ts
async function main() {
	const args = process.argv.slice(2);
	const command = args[0] ?? "help";
	const flags = parseFlags(args.slice(1));
	const vaultPath = resolve(typeof flags.vault === "string" ? flags.vault : process.cwd());
	if (command === "help" || flags.help) return help();
	if (!existsSync(vaultPath)) throw new Error(`Vault not found: ${vaultPath}`);
	if (command === "init") {
		await ensureStateDir(vaultPath);
		await saveConfig(vaultPath, {
			...DEFAULT_CONFIG,
			...await loadConfig(vaultPath)
		});
		const result = await scanAndBuild(vaultPath);
		return print({
			ok: true,
			vaultPath,
			nodes: result.graph.nodes.length,
			edges: result.graph.edges.length,
			files: result.files
		});
	}
	if (command === "scan") {
		const result = await scanAndBuild(vaultPath);
		return print({
			ok: true,
			nodes: result.graph.nodes.length,
			edges: result.graph.edges.length,
			files: result.files,
			skipped: result.skipped,
			warnings: result.warnings.slice(0, 5)
		});
	}
	if (command === "capture") {
		const text = typeof flags.text === "string" ? flags.text : "";
		if (!text.trim()) throw new Error("capture requires --text");
		const captured = await captureToVault(vaultPath, {
			text,
			...typeof flags.url === "string" ? { url: flags.url } : {},
			...typeof flags.title === "string" ? { title: flags.title } : {}
		});
		const result = await scanAndBuild(vaultPath);
		return print({
			ok: true,
			captured,
			nodes: result.graph.nodes.length,
			edges: result.graph.edges.length
		});
	}
	if (command === "status") {
		const state = await loadState(vaultPath);
		const config = await loadConfig(vaultPath);
		const active = await activeExperiment(vaultPath);
		const experiments = await listExperiments(vaultPath);
		return print({
			vaultPath,
			model: config.model,
			baseUrl: config.baseUrl,
			nodes: state.graph.nodes.length,
			edges: state.graph.edges.length,
			experiments: experiments.length,
			activeExperiment: active ? experimentView(active) : null,
			discoveries: (await listDiscoveries(vaultPath)).length,
			inbox: (await listInbox(vaultPath)).filter((item) => item.status === "pending").length
		});
	}
	if (command === "undo") {
		const previous = await undoGraph(vaultPath);
		if (!previous) return print({
			ok: false,
			message: "Nothing to undo."
		});
		return print({
			ok: true,
			nodes: previous.nodes.length,
			edges: previous.edges.length
		});
	}
	if (command === "suggest") return print({ suggestions: await suggestRelations(vaultPath, typeof flags.node === "string" ? flags.node : void 0) });
	if (command === "connect") {
		const source = typeof flags.source === "string" ? flags.source : "";
		const target = typeof flags.target === "string" ? flags.target : "";
		const relation = typeof flags.relation === "string" ? flags.relation : "相关";
		if (!source || !target) throw new Error("connect requires --source and --target");
		return print(await connectSuggestion(vaultPath, {
			source,
			target,
			relation,
			...typeof flags.reason === "string" ? { reason: flags.reason } : {},
			...typeof flags.confidence === "string" ? { confidence: Number(flags.confidence) } : {}
		}));
	}
	if (command === "experiment") {
		const sub = args[1] ?? "list";
		if (sub === "list") return print({ experiments: (await listExperiments(vaultPath)).map(experimentView) });
		if (sub === "start") {
			const title = typeof flags.title === "string" ? flags.title : "";
			if (!title) throw new Error("experiment start requires --title");
			return print({
				ok: true,
				experiment: experimentView(await startExperiment(vaultPath, {
					title,
					...typeof flags.node === "string" ? { nodeId: flags.node } : {},
					...typeof flags.days === "string" ? { targetDays: Number(flags.days) } : {}
				}))
			});
		}
		if (sub === "log") {
			const id = typeof flags.id === "string" ? flags.id : "";
			const evidence = typeof flags.evidence === "string" ? flags.evidence : "";
			if (!id) throw new Error("experiment log requires --id");
			return print({
				ok: true,
				experiment: experimentView(await logExperiment(vaultPath, id, {
					interest: Number(flags.interest ?? 3),
					energy: Number(flags.energy ?? 3),
					evidence,
					...typeof flags.next === "string" ? { next: flags.next } : {}
				}))
			});
		}
		throw new Error(`Unknown experiment command: ${sub}`);
	}
	if (command === "discoveries") {
		const sub = args[1] ?? "list";
		if (sub === "list") return print({ discoveries: (await listDiscoveries(vaultPath)).map(discoveryView) });
		if (sub === "refresh") return print({
			ok: true,
			discoveries: (await refreshDiscoveries(vaultPath)).map(discoveryView)
		});
		if (sub === "apply") return print(await applyDiscovery(vaultPath, typeof flags.id === "string" ? flags.id : ""));
		if (sub === "dismiss") return print(await dismissDiscovery(vaultPath, typeof flags.id === "string" ? flags.id : ""));
		throw new Error(`Unknown discoveries command: ${sub}`);
	}
	if (command === "inbox") {
		const sub = args[1] ?? "list";
		if (sub === "list") return print({ items: await listInbox(vaultPath) });
		if (sub === "add") return print({
			ok: true,
			...await enqueueInbox(vaultPath, typeof flags.text === "string" ? flags.text : "", "clipboard")
		});
		if (sub === "keep" || sub === "pass") {
			const result = await resolveInbox(vaultPath, typeof flags.id === "string" ? flags.id : "", sub === "keep" ? "kept" : "passed");
			if (sub === "keep") {
				const graph = await scanAndBuild(vaultPath);
				return print({
					ok: true,
					...result,
					nodes: graph.graph.nodes.length
				});
			}
			return print({
				ok: true,
				...result
			});
		}
		throw new Error(`Unknown inbox command: ${sub}`);
	}
	if (command === "serve") {
		startServer({
			vaultPath,
			port: Number(flags.port ?? 4173)
		});
		return;
	}
	if (command === "skill") {
		const skillPath = resolve(import.meta.dirname, "..", "skill", "SKILL.md");
		console.log(skillPath);
		return;
	}
	throw new Error(`Unknown command: ${command}`);
}
function parseFlags(args) {
	const result = {};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg.startsWith("--")) continue;
		const key = arg.slice(2);
		const next = args[index + 1];
		if (next && !next.startsWith("--")) {
			result[key] = next;
			index += 1;
		} else result[key] = true;
	}
	return result;
}
function print(value) {
	console.log(JSON.stringify(value, null, 2));
}
function help() {
	console.log(`InterestSeed — local-first interest validation for Markdown vaults

Usage:
  interestseed init [--vault <path>]
  interestseed scan [--vault <path>]
  interestseed capture --text <text> [--title <title>] [--url <url>]
  interestseed status [--vault <path>]
  interestseed discoveries list | refresh | apply --id <id> | dismiss --id <id>
  interestseed inbox list | add --text <text> | keep --id <id> | pass --id <id>
  interestseed suggest [--vault <path>] [--node <id>]
  interestseed connect --source <id> --target <id> --relation <name> [--reason <text>]
  interestseed undo
  interestseed experiment start --title <title> [--node <id>] [--days 3]
  interestseed experiment log --id <id> --evidence <text> [--interest 4] [--energy 4]
  interestseed experiment list
  interestseed serve [--vault <path>] [--port 4173]
  interestseed skill

Environment:
  INTERESTSEED_AI_API_KEY   local model key
  INTERESTSEED_AI_MODEL     optional model override
`);
}
main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
//#endregion
export {};
