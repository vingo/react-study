# W1D2 练习：State 快照、批处理和不可变更新

| 题目 | 文件 | 目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修复连续 3 次更新只加 1 的 bug | 10 分钟 |
| 2 | `ex2.tsx` | 不可变地更新嵌套对象 state | 15 分钟 |
| 3 | `ex3.tsx` | 不可变地批量更新数组 state，且不把派生值存进 state | 20 分钟 |

## 运行

在项目根目录先执行 `nvm use`，然后：

```bash
cd exercises
npx vitest W1D2       # 监听模式，保存后自动重跑
# 完成后的一次性验收：
npx vitest run W1D2
npx tsc --noEmit
```

初始状态下 3 个测试都会失败。修改 `ex1.tsx`、`ex2.tsx`、`ex3.tsx`，直到全绿。

`solutions/` 含参考答案。先尝试，再在卡住超过十分钟后查看。每题完成时，用一句话解释：为什么原写法使用了旧快照或修改了已有 state。
