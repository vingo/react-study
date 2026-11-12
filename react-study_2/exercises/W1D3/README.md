# W1D3 练习：Effect 的边界、清理与依赖

| 题目 | 文件 | 目标 | 用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 移除用于派生 UI 的 Effect | 10 分钟 |
| 2 | `ex2.tsx` | 用 Effect 同步 window resize，并正确清理事件监听器 | 15 分钟 |
| 3 | `ex3.tsx` | 用 Effect 管理 interval，使用更新函数避开过期闭包，并清理定时器 | 20 分钟 |

## 运行

```bash
cd /Users/maochaobo/work_projects/test/react-study
nvm use
cd exercises
npx vitest W1D3
```

起始状态下三个测试均失败。完成后做一次验收：

```bash
npx vitest run W1D3
npx tsc --noEmit
```

`solutions/` 是参考答案。先完成练习；卡住超过十分钟再打开。做完后在对话中说“验收 W1D3”。
