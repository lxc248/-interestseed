# Obsidian 社区插件目录提交核对（2026-11-10）

目标：把 InterestSeed 提交到 [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) 的 `community-plugins.json`。

本文件只记录**可验证事实**，不预测审核结果。

## 一、当前状态

| 项目 | 现状 | 结论 |
| --- | --- | --- |
| 仓库公开 | 是 | 通过 |
| 根目录 `manifest.json` | 存在 | 通过 |
| `manifest.id` | `interestseed`（无空格、无 `obsidian`） | 通过 |
| `manifest.name` | `InterestSeed`（无 `Obsidian`、无 `Plugin`） | 通过 |
| `manifest.description` | 约 40 字，远低于 250 上限 | 通过 |
| `manifest.author` | `aicoder` | 通过 |
| `manifest.minAppVersion` | `1.5.0` | 通过 |
| `versions.json` | `3.7.0 → 1.5.0` 已登记 | 通过 |
| LICENSE | AGPL-3.0-only | 通过 |
| 源码可读、无混淆 | 是 | 通过 |
| 无 `eval` | 全仓库 `src` 未命中 | 通过 |
| 网络请求默认关闭 | `enableAI=false`、`aiConsentGranted=false` | 通过（需在 README 说明） |
| `isDesktopOnly` | `false`（Agent 功能已加桌面守卫） | 通过：主体不依赖 Node；`DshAcpClient.start()` 在移动端直接拒绝并给出提示 |
| 插件 release 资产 | `3.7.2` release 已含 `main.js`(667,841) / `manifest.json`(287) / `styles.css`(216,552) | 通过 |
| release tag 与 manifest 版本一致 | tag `3.7.2` → `e700792` | 通过 |
| 发布工作流上传插件三件套 | `release.yml` 已上传三件套 | 通过 |

## 二、本轮修复（已完成，2026-11-10）

1. `manifest.json` 的 `isDesktopOnly` 改为 `false`：插件主体不依赖 Node，Agent 功能用 `Platform.isDesktopApp` 在移动端显式拒绝。
2. `release.yml` 在发布时额外上传 `dist/main.js`、`dist/manifest.json`、`dist/styles.css`，资产名保持原样。
3. 打 `3.7.0` tag（不带 `v`），由工作流构建并发布三件套。
4. README 增加“网络与隐私”段落，说明 AI 默认关闭、仅在你开启并填 key 后才访问 `https://api.deepseek.com`。

## 三、提交时需要填的条目

`community-plugins.json` 追加：

```json
{
  "id": "interestseed",
  "name": "InterestSeed",
  "author": "aicoder",
  "description": "把一条收藏变成 3 天真实行动：一次只验证一个兴趣，用证据决定继续或放下。",
  "repo": "lxc248/-interestseed"
}
```

提交方式：fork `obsidianmd/obsidian-releases` → 编辑 `community-plugins.json`（追加到数组末尾）→ 提 PR，标题 `Add InterestSeed plugin`。

## 四、提交前必须自检的四件事

- [x] `https://github.com/lxc248/-interestseed/releases/tag/3.7.0` 页面能直接看到 `main.js`、`manifest.json`、`styles.css` 三个资产
- [x] `manifest.json` 在 release 里的 `version` 是 `3.7.0`（已下载资产核对）
- [x] 该 release 由 `release.yml` 在 CI 中构建（run 42799636717 success），非本地构建
- [x] README 已加「网络与隐私」段，说明 AI 默认关闭、仅开启后访问 `api.deepseek.com`

## 五、已知不阻断但会被 reviewer 提到的点

- 仓库根目录有大量历史报告 `.md` 与截图，体积偏大（约 29.6 MB tree）。审核不要求清理，但会拖慢 clone。
- 4.0.x 的 standalone 版本与 3.7.0 的插件版本号不一致，需在 README 里解释清楚（插件 3.7.0 / CLI 4.0.x）。
- 尚无独立第三方安全审计，README 中不得暗示已审计。
## 六、自动化门禁

`npm run check:obsidian` 会检查：`id` 命名规则、`name` 不含 Obsidian/Plugin、描述 ≤250 字符、`version` 与 `package.json` 一致、`versions.json` 有对应条目、`RELEASE_NOTES_<version>.md` 存在、`src` 无 `eval`。

该检查已加入 `npm run verify`，因此每次 CI 都会跑。

设置 `OBSIDIAN_CHECK_RELEASE=1` 时会额外用 GitHub API 核对 release 里的 `main.js` / `manifest.json` / `styles.css`；发布工作流在发布后自动跑这一步，缺资产会直接失败。
`npm run check:mobile-bundle` 会用一个**没有 Node 内置模块**的沙箱加载 `dist/main.js`：只放行 `require('obsidian')`，其余任何 `require` 都判失败。这样如果有人在模块顶层 `import fs from 'node:fs'`，CI 会立刻拦住——那种改动会让插件在手机上白屏，而普通单测发现不了。
`check:obsidian` 还会核对两件与「用户能不能装上」直接相关的事：

- `README.md` / `README.en.md` 必须引用真实的插件包名 `interestseed-<version>.zip`
- 打开 `OBSIDIAN_CHECK_RELEASE=1` 时，release 里必须真的存在这个 zip

加这条的原因：README 曾经写着 `interestseed-v3.7.0.zip`，而实际资产叫 `interestseed-3.7.2.zip`。安装说明指向不存在的文件，用户第一步就会卡住，而所有测试和 CI 都不会报错。