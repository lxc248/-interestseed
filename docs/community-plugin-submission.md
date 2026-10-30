# Obsidian 社区插件提交材料

## 已完成

```text
fork:   lxc248/obsidian-releases
branch: interestseed-submission
commit: 9a222fa（包含 community-plugins.json 的 InterestSeed 条目）
```

条目：

```json
{
  "id": "interestseed",
  "name": "InterestSeed",
  "author": "aicoder",
  "description": "Turn one saved post into a real 3-day action, then let evidence decide whether to keep it.",
  "repo": "lxc248/-interestseed"
}
```

## 直接提交入口

```text
https://github.com/obsidianmd/obsidian-releases/compare/master...lxc248:interestseed-submission
```

## 阻塞原因

```text
obsidianmd/obsidian-releases
  pull_request_creation_policy: collaborators_only

GitHub API 创建 PR 返回 404。
```

这意味着外部账号无法通过 API 自动创建 PR；需要在 GitHub 网页上以有权限的账号手动点击 **Create pull request**，或先获得该仓库的 collaborator 权限。

## 手动步骤

```text
1. 打开上面的 compare 链接
2. 确认只修改 community-plugins.json
3. 标题：Add InterestSeed plugin
4. 点 Create pull request
5. 等待 Obsidian 维护者审核
```
