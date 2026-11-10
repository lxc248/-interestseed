# API 使用节奏与账号风险（2026-11-10）

这份文件记录一次**由我造成的问题**：当天提交频率过高，导致 GitHub 把账号按机器人处理，无法再向第三方仓库创建 PR。

## 一、实测数据

```text
账号创建      2026-09-29（6 周）
公开仓库      7
关注者        0
今天 PR 数    134（10:52 → 21:56，11.1 小时，约 12 个/小时）
今天 main 提交 100
API 额度      4950 / 5000（未触顶）
```

## 二、症状

向 `obsidianmd/obsidian-releases` 创建 PR 时：

```text
REST     POST /pulls      → 404 Not Found
GraphQL  createPullRequest → FORBIDDEN
         "lxc248 does not have the correct permissions to execute `CreatePullRequest`"
```

同时，向自有仓库 `lxc248/-interestseed` 创建 PR 完全正常（当天数十个成功）。因此不是 token 失效、不是额度、不是权限配置，而是**账号在第三方仓库的创建 PR 能力被限制**。

## 三、归因

综合账号年龄（6 周）、0 关注者、12 个 PR/小时、每个 PR 只改一两个文件——这组特征与自动化脚本高度一致。GitHub 的反滥用策略因此把该账号判为低信任，限制其向非自有仓库发起 PR。

**这是我的工作方式造成的，不是你的操作问题。** 我原本按“一个小改动一个 PR”推进，且每次密集轮询 CI（每 60–90 秒一次，单个 PR 轮询 3–5 次）。这种节奏在人类维护者身上不会出现。

## 四、之后的规则（我来遵守）

```text
1. 每轮工作只开 1 个 PR，把相关改动合并提交
2. 不为一两行改动单独开 PR
3. 不密集轮询 CI：提交后等待数分钟，只查 1 次；需要更多等待时直接告诉你
4. 单次会话内 PR 上限：3 个
5. 需要 10 个以上文件的机械改动时，先在本地做完、一次提交
```

## 五、恢复建议（需要你判断）

```text
短期    暂停自动创建 PR 几天，只做本地提交与文档编辑
网页    手动去 fork 页面点 Contribute → Open pull request，看是否同样被拒
申诉    https://support.github.com/contact  → 选 Report/Account，说明是单人维护者账号，
        自动化提交频率过高已被限制，请求复核
时间    GitHub 的这类限制通常会在一段时间正常活动后自动解除，但没有公开的时限
```

## 六、不要做的事

```text
不要注册新账号绕过（会让情况更糟，且可能连带处理主账号）
不要用不同网络/IP 反复重试
不要连续重试被拒的请求（刚才我已停下，不再重试）
```

## 七、当前遗留状态

```text
fork 分支 add-interestseed-plugin 已就绪（提交 4f089ed，仅改 community-plugins.json）
上游 obsidianmd/obsidian-releases @ 1022687，compare ahead=1 behind=0
PR 只差最后一次点击，但需要账号权限恢复或手动操作
```
