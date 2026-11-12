# W1D5：组件组合、状态提升、key、Reducer 与 Context

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 将两个 Panel 的展开状态提升到最近公共父级 | 15 分钟 |
| 2 | `ex2.tsx` | 用联系人稳定 ID 作为 key，切换收件人时重置 Chat 草稿 | 15 分钟 |
| 3 | `ex3.tsx` | 编写不可变 reducer，并通过 state / dispatch Context 跨层共享 | 20 分钟 |

## 开始

```bash
cd /Users/maochaobo/work_projects/test/react-study
nvm use
cd exercises
npx vitest W1D5
```

初始状态下 4 个测试都会失败。完成后一次性验收：

```bash
npx vitest run W1D5/*.test.tsx
npx tsc --noEmit
```

`solutions/` 内有参考实现。请先自己完成；卡住超过十分钟后再打开。完成后发“验收 W1D5”。
