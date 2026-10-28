# InterestSeed · 本地验收归档

这个目录保存本机 UI 验收产生的原始截图、调试截图和旧备份，方便复现与追溯。

## 结构

```text
review/artifacts/2026-10-28/
├── ui-screenshots/
│   ├── main-clean2.png       最终主工作区
│   ├── explore-clean.png     最终 Explore Studio
│   ├── agent-warning.png     千问未配置 Key 的 Agent 状态
│   ├── narrow-700d.png       窄窗口回归
│   ├── overview-v2.png       总览验收
│   ├── settings2.png         设置页验收
│   ├── desktop-history/      早期桌面截图与设计迭代
│   └── ...                   其余基线/调试截图
└── legacy/
    ├── interestseed-old-backup-20261028.zip
    └── dsh-ungrouped-test-sessions-backup-20261028.zip
```

## 规则

- `ui-screenshots/` 和 `legacy/` 只保留在本机，不提交 Git；
- 不包含 API Key、Cookie 或 `.env`；
- 正式发布用截图在 `assets/screenshot-1..3.png`；
- 需要发布时，只从 `assets/` 选择经过裁剪的最终图。

## 验收记录

完整问题与修复记录见 `review/视觉验收_2026-10-28.md`。
