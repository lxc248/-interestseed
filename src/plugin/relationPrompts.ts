import { type App } from 'obsidian';
import type { InterestSeedNode } from '../types/graph';
import { RelationCreateModal } from '../ui/RelationCreateModal';
import { RelationEditModal } from '../ui/RelationEditModal';

export function openRelationCreateModal(input: {
  app: App;
  source: InterestSeedNode;
  targets: InterestSeedNode[];
  onConfirm: (selection: { targetId: string; relation: string }) => void;
}): void {
  new RelationCreateModal(input.app, input.source, input.targets, input.onConfirm).open();
}

export function openRelationEditModal(input: {
  app: App;
  relation: string;
  onConfirm: (relation: string) => void;
}): void {
  new RelationEditModal(input.app, input.relation, input.onConfirm).open();
}
