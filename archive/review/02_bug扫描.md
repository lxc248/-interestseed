# 第 2 步：全项目 Bug 扫描

日期：2026-10-27

## 自动检查

```text
typecheck  通过
test       42 test files / 427 tests 通过
lint       通过
build      通过
```

## 模式扫描

已扫描：

- TODO / FIXME / HACK / XXX；
- `@ts-ignore` / `@ts-expect-error`；
- `window.prompt` / `window.confirm` / `window.alert`；
- `eval` / `innerHTML` / `outerHTML`；
- `localStorage` / `sessionStorage`；
- `console` / `debugger`；
- 空 `catch {}`；
- 硬编码密钥/密码字段；
- `as any` / `: any`。

结果：

- 没有 `window.prompt` / `window.confirm` / `window.alert` 业务调用；
- 没有 `eval`、`innerHTML`、`localStorage`；
- 没有 `as any` / `: any`；
- 没有空 catch；
- 没有硬编码 API key；
- `console.error/warn` 只用于已有错误报告/监听器异常，不是调试残留；
- 41 个 `*.test.ts`，另有 `tests/discoveryQuality.ts` 测试辅助文件，故目录中 42 个文件不等于 42 个测试文件。

## 重点风险复核

- `DiscoveryWriteQueue` / `PersistenceService` 写入失败有错误路径和备份；
- `GraphSession` 写入有撤销快照；
- `DiscoveryApplication` 有 apply / existing / stale / recovery；
- `DiscoveryExplorerModal` AI 失败有 UI 错误状态，不影响本地探索数据；
- `ModelProvider.explore` 只发送聚合主题/项目/计数；
- `DiscoveryPanel` 主题筛选按 `subjectKeys` 拼接键匹配，已修正矩阵项目拆分；
- `GraphCanvas` 事件监听、动画帧、定时器有清理路径；
- `InterestSeedView` 发现/详情面板已拆为独立 DOM。

## 本步结论

```text
未发现阻断级 bug
发现 1 个文档计数说明需要修正：
  tests 目录 42 个文件，但 test 文件是 41 个
进入第 3 步：独立仿真实验
```