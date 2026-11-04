# InterestSeed 2.3.1 — 外链路线修复

2.3.0 的两轮真实 UI 测试发现并修复了一个数据层问题。

## 修复

`sourceUri` 之前统一走 `normalizePath`，把：

```text
https://www.xiaohongshu.com/explore/1
```

变成了：

```text
https:/www.xiaohongshu.com/explore/1
```

于是兴趣路线会生成：

```text
[[https:/www.xiaohongshu.com/...|标题]]
```

错误双链。

现在：

- `https://` / `http://` 原样保留；
- 旧的 `https:/` 自动修复为 `https://`；
- `vault:` 路径仍然正常规范化；
- 图谱加载时会修复旧数据。

## 验证

```text
56 test files
470 tests passing
typecheck / lint / build passing
```

新增测试：

```text
keeps external URLs intact
repairs previously collapsed URL slashes
normalizes vault paths and vault URIs
```

## 两轮模拟

```text
review/persona-student-2.3.0/
review/persona-office-2.3.0/
review/2.3.1-persona-tests.md
```

## 发布

```text
interestseed-v2.3.1.zip
interestseed-skill-v2.3.1.zip
```

AGPL-3.0-only.
