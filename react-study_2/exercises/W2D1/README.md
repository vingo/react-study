# W2D1：Actions 与表单

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修复 `useActionState` 表单：错误提示、保留历史任务、成功后清空输入 | 15 分钟 |
| 2 | `ex2.tsx` | 把 `useFormStatus` 放进 form 的子组件，正确显示 pending 按钮 | 15 分钟 |
| 3 | `ex3.tsx` | 用 `useOptimistic` 乐观添加任务，成功写入真实 state，失败回滚并报错 | 20 分钟 |

合计约 50 分钟。

## 开始

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W2D1
```

初始状态下 3 个文件共 7 个测试都会失败（是断言失败，不是导入错误）。完成后验收：

```bash
npx vitest run W2D1
npx tsc --noEmit
```

## 提示

- `useActionState` 的 action 签名是 `(prevState, formData)`；返回的新 state 会替换旧 state，需要自己合并历史数据。
- `useFormStatus` 只能读取**渲染它的组件的父级 form** 的状态。在渲染 `<form>` 的同一个组件里调用，永远得到 `pending: false`。
- `useOptimistic` 的更新要在 action（或 transition）内发起。action 结束后，如果真实 state 没有包含该条目，乐观项会自动消失——这正是失败回滚的基础。
- action 在 `await` 之后更新真实 state 时，需要再包一层 `startTransition`；否则这次更新不会被当作文档所说的 Transition 更新。

`solutions/` 内是参考实现。请先自己做，卡住超过十分钟再看。完成后发“验收 W2D1”。
