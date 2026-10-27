# 第 4 步：仿真后的 Bug 复扫

日期：2026-10-27

## 复查命令

```text
typecheck  通过
test       42 个 test 文件 / 427 用例通过
lint       通过
build      通过
python -m py_compile research/*.py 通过
```

## 危险模式复扫

未发现：

- `window.prompt` / `window.confirm` / `window.alert`；
- `eval` / `innerHTML` / `localStorage`；
- `as any` / `: any`；
- 空 catch；
- TODO/FIXME 业务残留；
- 硬编码密钥。

## 实验相关 bug

V2 首次运行时发现：

```text
research/phase3_simulation_v2.py ci95()
→ 每次迭代重复 mean(values)
→ 60,000 条结果时 O(n²) 卡顿
```

已修复为预先计算均值，重新完成 60,000 次实验。

## 产品代码结论

```text
本次复扫：未发现新的产品运行时代码 bug
仿真脚本：1 个已修正性能 bug
下一步：逐文件完整代码审查
```