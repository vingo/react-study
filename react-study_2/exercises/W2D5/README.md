# W2D5：状态管理选型：Zustand 5 与 selector

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修 bug：把整店订阅改成窄 selector，按渲染次数验证订阅范围 | 15 分钟 |
| 2 | `ex2.tsx` | 补全实现：全局 store 的不可变 actions / 派生 selector；把筛选留在 URL、草稿留在局部 state | 15 分钟 |
| 3 | `ex3.tsx` | 小功能：`persist` + `createJSONStorage` + `partialize` 做部分持久化 | 20 分钟 |

合计约 50 分钟。

## 先自己做

`solutions/` 里是参考答案。请先独立完成，卡住超过 10 分钟再看。
测试文件（`*.test.tsx`）是验收标准，不要修改断言。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W2D5
```

初始状态下测试是红的，失败全部来自断言（不是导入/类型错误）：
共 8 个用例失败、4 个通过（12 个用例）。

- `ex1.test.tsx`：2 个失败。`TaskCountBadge` 订阅了整个 store，
  切换主题、重命名任务（数量没变）时都会被 Profiler 记录到多余的一次渲染。
- `ex2.test.tsx`：2 个失败。`togglePin` 是空实现、`selectPinnedCount` 恒为 0；
  搜索框把 URL 的 `q` 复制进局部 state，输入不再写回 URL。
- `ex3.test.tsx`：4 个全失败。设置写进了 `sessionStorage`，且没有 `partialize`，
  `localStorage` 里读不到，恢复逻辑也无从谈起。

完成后两条命令都要通过：

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W2D5
npx tsc --noEmit
```

验证参考答案：用 `solutions/exN.tsx` 覆盖对应的 `exN.tsx` 后重新运行，
12/12 通过且没有 act 警告；验证完记得恢复起始文件。
参考答案与起始文件均通过 `npx tsc --noEmit`。

## Store 重置（测试 helper 的约定）

每个测试文件在 `beforeEach` 里调用题目导出的 reset 函数，避免上一个用例的
state 泄漏到下一个用例：

- `ex1`：`resetTaskStore()` → `useTaskStore.setState({ tasks, theme })`，
  合并式更新，保留 actions，任务数组每次重新创建。
- `ex2`：`resetWorkspaceStore()` → 把 `theme` / `sidebarOpen` / `pinnedIds`
  恢复默认，保留 actions。
- `ex3`：`resetSettingsStore()` → 恢复默认设置并调用
  `useSettingsStore.persist.clearStorage()`；测试另外清空
  `localStorage` 与 `sessionStorage`。模拟刷新用
  `useSettingsStore.persist.rehydrate()`（在 `act` 中 await）。

这些 reset 已写在测试里，不需要你实现或修改，但做题时可以直接用它们手动重置。

## 题目提示

### 1. 窄 selector 与重渲染

- `useTaskStore()` 等价于 `useTaskStore((state) => state)`：任何 `setState`
  都会产生新的 state 对象引用，订阅者必然重渲染。
- `useTaskStore((state) => state.tasks.length)` 返回数字；Zustand 5 用
  `Object.is` 比较前后值，长度不变就不通知订阅者。
- 测试用 React `<Profiler onRender>` 统计子树真正 commit 的次数：
  初始挂载计 1 次，之后只在对应子树重渲染时增加。
- 若一个组件需要同时读多个字段，可以让 selector 返回对象并用
  `useShallow`（`zustand/react/shallow`）包住；只有一个字段时直接用窄 selector。
  本题不需要 `useShallow`。

### 2. 状态归属：全局 / URL / 局部

- 全局 store 放跨组件、跨页面共享且不属于服务端的数据：主题、侧边栏、收藏。
- URL 放“刷新、分享链接、前进后退都应还原”的筛选条件：`useSearchParams`
  读，`setSearchParams` 写；输入框的值直接从 `searchParams.get('q')` 派生。
- 修改 URL 前先 `new URLSearchParams(searchParams)` 复制，空字符串要
  `delete('q')`，避免留下 `?q=`。
- 编辑草稿属于当前编辑器：放在 `TaskEditor` 的 `useState`，组件卸载就丢弃。
  如果搬进全局 store，取消后再次打开会看到上次的半截草稿（测试会抓到）。
- 派生值（收藏数量）从 `pinnedIds` 计算，不要再存一份 `count`。
- 不可变更新：加入用展开 `[...ids, id]`，移除用 `filter`，不要 `push` / `splice`。

### 3. persist 与部分持久化

- `persist(config, options)` 的 `name` 是 storage key，`storage` 决定读写哪个
  Storage，`partialize` 决定哪些字段落盘。
- `createJSONStorage(() => localStorage)` 负责 JSON 序列化/反序列化；
  写入 `localStorage` 的内容形如
  `{ "state": { "theme": "dark", "fontSize": "large" }, "version": 0 }`。
- `partialize` 只返回 `theme` 和 `fontSize`；`sidebarOpen`、`sessionNote`
  以及 actions 都不应该出现在存储里。
- 恢复时 Zustand 默认把存储对象浅合并回当前 state：存储里没有的字段保持
  当前值，所以临时 UI 状态不会被旧存储覆盖。
- 测试用 `persist.rehydrate()` 模拟刷新；它可能返回 Promise，用
  `await act(async () => { ... })` 包住，避免 act 警告。
