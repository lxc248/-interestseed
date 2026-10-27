import { hash64 } from '../utils/ids';
import { tagKey } from '../utils/validation';
import { DISCOVERY_IDENTITY_VERSION } from './types';

export { DISCOVERY_IDENTITY_VERSION };

const KIND_DOMAIN = 'cross-project-topic';

/**
 * 长度前缀编码，避免 "a|b" 与 "a" + "|b" 之类的歧义拼接。
 * 字段顺序由调用方固定，字段自身可以包含分隔符。
 */
export function encodeIdentityFields(fields: readonly string[]): string {
  return `${fields.length}:${fields
    .map((field) => `${field.length}:${field}`)
    .join('|')}`;
}

export function normalizeIdentityKeys(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result.sort();
}

function normalizeExactKeys(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result.sort();
}

function normalizeSubjectKeys(values: readonly string[]): string[] {
  return normalizeIdentityKeys(values.map((value) => tagKey(value)));
}

export function evidenceProfile(
  evidence: readonly { kind: string; nodeId: string }[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of evidence) {
    if (!item.nodeId.trim()) continue;
    const key = encodeIdentityFields([item.kind, item.nodeId.trim()]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result.sort();
}

export function dedupeKeyFor(
  projectKeys: readonly string[],
  subjectKeys: readonly string[],
): string {
  return hash64(
    encodeIdentityFields([
      'interestseed/discovery/dedupe/v2',
      KIND_DOMAIN,
      ...normalizeIdentityKeys(projectKeys),
      '--subject--',
      ...normalizeSubjectKeys(subjectKeys),
    ]),
  );
}

export function suppressionKeyFor(
  projectKeys: readonly string[],
  subjectKeys: readonly string[],
  evidence: readonly { kind: string; nodeId: string }[],
  recordId?: string,
): string {
  const profile = evidenceProfile(evidence);
  if (profile.length === 0) {
    if (recordId) {
      return hash64(
        encodeIdentityFields([
          'interestseed/discovery/suppression/record-scope/v2',
          KIND_DOMAIN,
          recordId,
        ]),
      );
    }
    return hash64(
      encodeIdentityFields([
        'interestseed/discovery/suppression/empty-profile/v2',
        KIND_DOMAIN,
      ]),
    );
  }
  return hash64(
    encodeIdentityFields([
      'interestseed/discovery/suppression/v2',
      KIND_DOMAIN,
      ...normalizeIdentityKeys(projectKeys),
      '--subject--',
      ...normalizeSubjectKeys(subjectKeys),
      '--evidence--',
      ...profile,
    ]),
  );
}

/**
 * 身份槽：语义主题 + 节点对。
 * dedupeKey 负责主题，nodeIds 负责保留独立节点对，避免把独立变体强行合并。
 */
export function identitySlotKey(
  dedupeKey: string,
  nodeIds: readonly string[],
): string {
  return hash64(
    encodeIdentityFields([
      'interestseed/discovery/slot/v2',
      KIND_DOMAIN,
      dedupeKey,
      '--nodes--',
      ...normalizeExactKeys(nodeIds),
    ]),
  );
}

export function discoveryIdFor(
  dedupeKey: string,
  evidence: readonly string[],
  ruleVersion: string,
): string {
  return `discovery_${hash64(
    encodeIdentityFields([
      'interestseed/discovery/id/v2',
      KIND_DOMAIN,
      dedupeKey,
      '--evidence--',
      ...normalizeExactKeys(evidence),
      '--rule--',
      ruleVersion,
    ]),
  )}`;
}
