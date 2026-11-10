/**
 * 移动端安全门禁：用一个「没有 Node 内置模块」的沙箱加载 dist/main.js。
 *
 * Obsidian 移动端不提供 require('fs') / require('child_process')，
 * 所以只要打包产物在模块加载阶段碰到它们，插件在手机上就会白屏。
 * 这里直接执行产物顶层代码，比读源码猜测可靠。
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const bundlePath = resolve(root, 'dist/main.js');

const source = await readFile(bundlePath, 'utf8');

/** 只提供 obsidian，任何其它 require 都视为移动端不可用。 */
const obsidianStub = new Proxy(
  {},
  {
    get: (_target, property) => {
      if (property === 'Platform') return { isDesktopApp: false };
      if (property === '__esModule') return true;
      return class {};
    },
  },
);

const required = [];

const moduleStub = { exports: {} };

const sandbox = {
  module: moduleStub,
  exports: moduleStub.exports,
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  AbortController,
  fetch: () => Promise.reject(new Error('network disabled in sandbox')),
  require: (name) => {
    if (name === 'obsidian') return obsidianStub;
    required.push(name);
    throw new Error(`移动端无法 require('${name}')`);
  },
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

let failure = null;
try {
  vm.runInNewContext(source, sandbox, { filename: 'dist/main.js' });
} catch (error) {
  failure = error;
}

const problems = [];
if (failure) {
  problems.push(`加载 dist/main.js 失败：${failure.message}`);
}
if (required.length > 0) {
  problems.push(`模块加载阶段尝试 require 了 Node 内置模块：${[...new Set(required)].join(', ')}`);
}
if (!moduleStub.exports || Object.keys(moduleStub.exports).length === 0) {
  problems.push('dist/main.js 没有导出任何内容，构建可能不完整');
}

if (problems.length > 0) {
  console.error('移动端兼容检查失败：');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('Mobile bundle check passed: dist/main.js loads without any Node builtin.');
