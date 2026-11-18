# W3D2：并发渲染（useDeferredValue、useTransition、Activity）

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修 bug：用 `useDeferredValue` 让输入紧急更新、列表后台过滤，列表先保留旧结果 | 15 分钟 |
| 2 | `ex2.tsx` | 补全实现：用 `useTransition` 做 Tab 切换的 pending UI，旧内容保留、紧急输入不阻塞 | 15 分钟 |
| 3 | `ex3.tsx` | 小功能：用 `<Activity>` 实现 tab keep-alive，保留 state 与 DOM、隐藏时清理 Effects | 20 分钟 |

合计约 50 分钟。三题都不要求修改测试，测试断言就是验收标准。

## 先自己做

`solutions/` 里是参考答案。**请先独立完成，卡住超过 10 分钟再看。**
测试文件（`*.test.tsx`）是验收标准，不要修改断言；也不要修改共享的
`package.json`、`vitest.config.ts`、`tsconfig.json`。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W3D2
npx tsc --noEmit
```

如果 `node -v` 不是 24.x，先把 nvm 的 Node 放进 PATH（见项目根目录 `.nvmrc`）：

```bash
export PATH=/Users/maochaobo/.nvm/versions/node/v24.22.2/bin:$PATH
```

初始状态：3 个测试文件、6 个用例，**5 个失败、1 个通过**，失败全部来自断言
（不是导入或类型错误）：

- `ex1.test.tsx`：第 1 个用例失败（没有“新 query + 旧列表”的过渡渲染）；
  第 2 个用例初始通过，用来确认最终结果没有错位。
- `ex2.test.tsx`：2 个用例都失败（没有 pending 提示，tab 高亮立即切换）。
- `ex3.test.tsx`：2 个用例都失败（隐藏 tab 被卸载：DOM 不在、state 丢失）。

参考答案 6/6 通过，且没有 act 警告或未处理 rejection；起始与参考答案都通过
`npx tsc --noEmit`。

验证参考答案：把 `solutions/exN.tsx` 覆盖对应的 `W3D2/exN.tsx` 后重新运行，
验证完恢复起始文件。最终 `npx vitest run W3D2` 应回到 5 个失败。

## 题目提示

### 1. useDeferredValue：输入紧急、列表后台

- 输入框的 `query` 继续用普通 `useState` 更新；列表不要直接使用 `query`，
  而是读取 `useDeferredValue(query)`。React 会先提交“新输入 + 旧列表”的一次
  render，再在后台用新值重算列表。
- `useMemo(() => filterProducts(deferredQuery), [deferredQuery])` 可以让紧急
  render 直接复用旧列表，避免同一个查询被重复过滤。
- 过渡期间可以用 `query !== deferredQuery` 标记“列表是旧的”（题目用
  `data-stale` 暴露出来），完成后自动变成 `false`。
- 测试通过模块内的 render 日志观察两次 render，不依赖任何真实计时；
  每一次 render 的 `count` 必须对应当次实际的 `listQuery`，这就是“不出现
  不一致的中间/最终结果”的含义。
- 也可以用 `useTransition` 维护一个单独的“已提交 query”，但推荐
  `useDeferredValue`，代码更短。

### 2. useTransition：切换 tab 的 pending UI

- React 19 支持异步 action：`startTransition(async () => { ... })`。
  `isPending` 会覆盖整个异步流程；但 `await` 之后的 state 更新按当前文档
  还要再包一层 `startTransition`，才能继续作为 transition 更新。
- 加载期间不要提前 `setActiveTab`：高亮和内容都应等加载完成后再一起作为
  transition 提交，否则会出现“tab 已选中、内容还是旧的”的不一致。
- 过滤框的 `setFilter` 必须留在 transition 外，这样它才是紧急更新。
- 测试用 `resolveTabLoad('activity')` 放行受控 promise，用 DOM 上的
  `role="status"`、`data-tab`、`aria-selected` 断言 pending 时序；不要用
  `setTimeout`/秒数。

### 3. `<Activity>`：tab keep-alive

- 把两个面板分别包进 `<Activity mode={active ? 'visible' : 'hidden'}>`，
  不要条件渲染。隐藏的子树仍保留 fiber、state 和 DOM，React 会把宿主节点设为
  `display: none !important`。
- 隐藏时 React 会卸载该子树的 Effects（cleanup），但保留 state；切回
  `visible` 时会用原来的 state 重新渲染并重新 setup Effects。订阅、定时器这类
  副作用因此不会在隐藏期间继续运行。
- jsdom 的 `getComputedStyle(...).display` 能读到 `none`；隐藏面板仍可被
  `queryByTestId` / `getByLabelText` 找到，这正是 keep-alive 的断言点。
- 不要用 CSS 自己写 `display:none` 来冒充：那样 Effects 不会 cleanup，
  测试会失败。

完成后发“验收 W3D2”。
