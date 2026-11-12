# W1D4 练习：Ref 与 DOM

| 题目 | 文件 | 目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 用 object ref 聚焦原生 input | 10 分钟 |
| 2 | `ex2.tsx` | 用 React 19 的普通 `ref` prop 透传 DOM ref | 15 分钟 |
| 3 | `ex3.tsx` | 受控输入提交后，用 ref 命令式恢复焦点 | 20 分钟 |

## 运行

```bash
cd /Users/maochaobo/work_projects/test/react-study
nvm use
cd exercises
npx vitest W1D4
```

起始状态下三个测试都失败。完成后执行一次性验收：

```bash
npx vitest run W1D4/*.test.tsx
npx tsc --noEmit
```

`solutions/` 有参考实现。先独立完成；卡住超过十分钟后再看。完成后在对话中说“验收 W1D4”。
