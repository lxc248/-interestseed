# InterestSeed 3.7.2

移动端体验收尾。3.7.1 已经让插件能在手机上安装，这一版把**Agent 在移动端的表现**做干净。

## 移动端不再出现「点了才报错」的按钮

3.7.1 的做法是保留 Agent 入口，点下去再提示不可用。这一版改成：

```text
移动端 ribbon       只保留「打开兴趣图谱」「打开 InterestSeed AI 建议」
命令面板 Agent      仍然存在，触发时给出明确说明
```

## 被恢复出来的 Agent 面板不再是一个死输入框

桌面端开着 Agent 面板、同步到手机时，Obsidian 会恢复工作区布局。3.7.1 在这种情况下仍会渲染出输入框，用户打字、点发送才失败。

现在这种情况下 `AgentView` 会直接显示：

```text
Agent 仅桌面端可用
Agent 需要本地进程，目前只在桌面端可用。
其余功能（图谱、收件箱、实验、分享卡）在移动端可以正常使用。
```

并且不渲染会话输入区。

## 数据兼容

- 无 schema 变化
- `minAppVersion` 仍为 1.5.0

## 证据

```text
测试   798 passed（744 Vitest + 19 MCP + 35 Playwright）
覆盖率 行 87.68% / 分支 75.02% / 函数 86.81%
产物门禁 check:mobile-bundle 通过（dist/main.js 在无 Node 内置模块环境可加载）
CI     verify / e2e / size / CodeQL 全绿，npm audit 0
```

## 仍未完成的

- 没有独立第三方安全审计
- Agent 的移动端守卫是结构级约束测试，没有真机验证
