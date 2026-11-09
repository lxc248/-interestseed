import { type App } from 'obsidian';

export function unloadPlugin(input: {
  app: App;
  graphViewType: string;
  agentViewType: string;
  aiViewType: string;
  invalidateAuditBinding: () => void;
  closeDiscoveryQueue: () => void;
  flushDiscoveryQueue: () => void;
  flushPersistence: () => void;
  disposePersistence: () => void;
}): void {
  input.invalidateAuditBinding();
  input.app.workspace.detachLeavesOfType(input.graphViewType);
  input.app.workspace.detachLeavesOfType(input.agentViewType);
  input.app.workspace.detachLeavesOfType(input.aiViewType);
  input.closeDiscoveryQueue();
  input.flushDiscoveryQueue();
  input.flushPersistence();
  input.disposePersistence();
}
