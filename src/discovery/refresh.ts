import type { DiscoveryFile } from './types';

/**
 * 只比较发现内容和状态，不比较文件/记录的时间戳。
 * 用于避免启动刷新在内容未变化时产生无意义的持久化写入。
 */
export function discoveryContentFingerprint(file: DiscoveryFile): string {
  return JSON.stringify(
    file.discoveries.map((discovery) => ({
      ...discovery,
      updatedAt: undefined,
    })),
  );
}

export function hasDiscoveryContentChanged(
  left: DiscoveryFile,
  right: DiscoveryFile,
): boolean {
  return discoveryContentFingerprint(left) !== discoveryContentFingerprint(right);
}
