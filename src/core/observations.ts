import { createId } from '../utils/ids';

export type ObservationBelief = 'stronger' | 'weaker' | 'changed';

export const OBSERVATION_BELIEF_LABELS: Record<ObservationBelief, string> = {
  stronger: '更确定',
  weaker: '变弱',
  changed: '有变化',
};

export interface InterestObservation {
  id: string;
  at: string;
  source: string;
  sourceRef?: string;
  evidence: string;
  belief: ObservationBelief;
}

const MAX_OBSERVATIONS = 40;

export function normalizeObservations(raw: unknown): InterestObservation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: String(item.id ?? ''),
      at: String(item.at ?? ''),
      source: String(item.source ?? 'manual'),
      ...(item.sourceRef ? { sourceRef: String(item.sourceRef) } : {}),
      evidence: String(item.evidence ?? ''),
      belief: (item.belief === 'stronger' || item.belief === 'weaker'
        ? item.belief
        : 'changed') as ObservationBelief,
    }))
    .filter((item) => item.id && item.at && item.evidence)
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, MAX_OBSERVATIONS);
}

export function appendObservation(
  metadata: Record<string, unknown> | undefined,
  input: Omit<InterestObservation, 'id' | 'at'> & { at?: string },
): InterestObservation[] {
  const observation: InterestObservation = {
    id: createId('observation'),
    at: input.at ?? new Date().toISOString(),
    source: input.source,
    ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    evidence: input.evidence.trim(),
    belief: input.belief,
  };
  if (!observation.evidence) return normalizeObservations(metadata?.observations);
  return normalizeObservations([
    observation,
    ...normalizeObservations(metadata?.observations),
  ]);
}

export function latestObservation(
  metadata: Record<string, unknown> | undefined,
): InterestObservation | undefined {
  return normalizeObservations(metadata?.observations)[0];
}
