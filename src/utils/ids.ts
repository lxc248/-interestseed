let sequence = 0;

/**
 * 生成带前缀的唯一 id。时间戳保证跨会话不重复，自增序号保证同毫秒内不重复。
 */
export function createId(prefix = 'id'): string {
  sequence = (sequence + 1) % 0xffffff;
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `${prefix}_${time}${sequence.toString(36)}${random}`;
}

export function resetIdSequence(): void {
  sequence = 0;
}

/** FNV-1a 32 位哈希，输出 base36。 */
export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
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
export function hash64(input: string): string {
  let left = 0x811c9dc5;
  let right = 0xc2b2ae35;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193) >>> 0;
    right = Math.imul(right ^ (code + 0x9e3779b9), 0x85ebca6b) >>> 0;
  }

  return `${left.toString(36).padStart(7, '0')}${right.toString(36).padStart(7, '0')}`;
}

/**
 * 来自 vault 文件的节点使用稳定 id：同一个 uri 永远得到同一个 id，
 * 因此重复扫描会命中 upsert 而不是创建新节点。
 */
export function nodeIdForUri(uri: string): string {
  return `node_${hash64(uri.toLowerCase())}`;
}

/**
 * 关系的确定性 id：由 source、target、relation 共同决定。
 * 重复推断不会产生重复边；状态变化（suggested → confirmed）不改变 id。
 */
export function edgeIdFor(source: string, target: string, relation: string): string {
  return `edge_${hash64(`${relation}\u0000${source}\u0000${target}`)}`;
}
