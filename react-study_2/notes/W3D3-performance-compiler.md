# W3D3：性能与 React Compiler

> 以 React 19.3 + React Compiler 1.0（npm `babel-plugin-react-compiler@1.0.0`）为准。承接 [W3D1](W3D1-fiber-reconciliation.md) 的 `beginWork` bailout 与 [W3D2](W3D2-concurrent-rendering.md) 的 transition。**练习环境不安装、不启用 Compiler**；启用放到第 3 周末的 kanban v3，日常练习不要改共享构建配置。

## 1. 一句话结论

性能优化不是“把所有组件包上 memo”，而是先用 Profiler 找到一次真实交互里最贵的 commit 和组件，再按“修数据流 → 组合/拆分 → 稳定引用 → 虚拟化/并发 → Compiler”的顺序用最小手段消除可感知卡顿；`memo`/`useMemo`/`useCallback` 只是引用缓存提示（不是语义保证），React Compiler 1.0 在构建期自动做等价的 memoization，但只优化符合 Rules of React 的组件/Hook，仍然要测量。

## 2. 心智模型

```text
一次点击的账本
  click → setState → render（可中断、可重做） → commit（同步写 DOM） → paint
                       │                          │
                       │                          └─ Profiler 的 commit 时长
                       └─ 组件函数耗时 = flamegraph 的宽度

诊断顺序（不要跳步）
  1. 哪个交互卡？          录一段 Profiler / Performance
  2. 哪个 commit 贵？      看 commit 柱状图，选最慢的一次
  3. 谁在 render？为什么？ flamegraph / ranked + “Why did this render?”
  4. 贵在哪？              render JS？commit DOM？layout？网络？
  5. 最小手段              结构 → 稳定引用 → 虚拟化/并发 → Compiler
  6. 同样场景复测          前后对比，而不是“感觉快了”

优化手段的大致优先级
  状态下沉 / children 组合 / 拆分
    > 减少不必要 state/Effect、稳定 props
    > memo / useMemo / useCallback（只打热点）
    > 虚拟化 / useDeferredValue / transition
    > React Compiler（全局基线，不替代前几项）
```

```tsx
function App() {
  const [q, setQ] = useState('')
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} />
      <ResultList query={q} />
    </>
  )
}
```

每敲一个字符，`App` 和 `ResultList` 都会 render。这本身不是问题；问题只在于这段 render 是否让输入出现可感知延迟。**先有交互和测量，才有优化对象。**

## 3. 要点

### 3.1 Profiler 读图：先找“最贵的那次 commit”

- 打开 React DevTools 的 Profiler，点录制，做一个真实交互（例如在搜索框输入一个字符），停止。不要录一长串无关操作。
- 顶部每根柱子是一次 commit，柱高/颜色表示这次 commit 的耗时；先用过滤阈值隐藏很快的 commit，再点最慢的那根。
- Flamegraph：宽度 = 该组件及其子树的 render 耗时（灰色组件的宽度来自它上一次 render，颜色才表示本次 commit 的耗时）；灰色 = 本次没有 render；偏黄 = 更贵。点击组件可看 props/state/hooks 的变化，以及 “Why did this render?”（父组件 render、props 变化、state 变化、context 变化等）。
- Ranked：把选中 commit 里的组件按耗时排序，适合快速定位“最贵的组件”；它回答“谁最贵”，不回答“谁渲染得最频繁”。
- Chrome Performance 面板的 React tracks 还能看到 Scheduler（Blocking/Transition/Suspense/Idle）、Components flamegraph，以及一次 render 的 Update → Render → Commit → Remaining Effects 阶段；出现 “Cascading update” 往往意味着 render/Effect 里又调度了更新。
- **区分 render 与 commit**：render 是调用组件函数，可中断、可重做；commit 是同步写 DOM、跑 layout effect，不能被打断。render 长 → memo/拆分/Compiler/transition 可能有用；commit 长（大量真实 DOM 变更、布局计算重）→ memo 帮助有限，要减少 DOM/样式/layout 工作。

```tsx
function Board() {
  const [q, setQ] = useState('')
  const rows = expensiveFilter(q) // 假设这是一个耗时的过滤
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索" />
      <ul>{rows.map((r) => <li key={r.id}>{r.name}</li>)}</ul>
    </>
  )
}
```

录制“输入一个字符”后，flamegraph 里 `Board` 的宽度包含 `expensiveFilter` 和所有 `li` 的 render；如果 `Board` 很宽而 `li` 都是灰色，说明贵在过滤本身，而不是子组件重渲染。

### 3.2 Profiler API：`onRender` 只做补充测量

- `<Profiler id onRender>` 在**已提交**的更新后调用；被中断、被丢弃的 render 不会触发。它统计的是 commit，不是 render 次数。
- 参数：`id`、`phase`（`mount` / `update` / `nested-update`）、`actualDuration`、`baseDuration`、`startTime`、`commitTime`。
- `actualDuration`：本次更新中，Profiler 子树实际花在 render 上的毫秒数；`baseDuration`：把每个组件最近一次 render 的耗时相加、**假设没有任何 memoization** 的估算值。`actualDuration` 明显小于 `baseDuration`，说明 bailout/memo 生效；两者接近，说明几乎整棵子树都在重算。
- 它只测 React 的 render，不包含网络、图片解码和浏览器 paint；`commitTime` 可在多个 Profiler 之间对齐同一次 commit。
- 生产构建默认关闭 profiling（有额外开销）。需要时用 `react-dom/profiling` 构建（常用 bundler alias 把 `react-dom/client` 指过去）。不要在日常开发构建里比较绝对毫秒数：StrictMode 会双调用，开发构建也更慢。
- Profiler 边界要少而稳定，按“页面区域/交互”划分；不要给每个组件包一层。

```tsx
import { Profiler } from 'react'

function onRender(id: string, phase: string, actualDuration: number, baseDuration: number) {
  if (actualDuration > 16) {
    console.warn(`${id} ${phase}: ${actualDuration.toFixed(1)}ms / base ${baseDuration.toFixed(1)}ms`)
  }
}

export function App() {
  return (
    <Profiler id="board" onRender={onRender}>
      <Board />
    </Profiler>
  )
}
```

首次 `mount` 的 `actualDuration` 通常很高，不能拿来和更新比；要在同一个交互、同一台机器、同样 CPU 降速下比较优化前后。`Board` 省略了定义。

### 3.3 渲染性能的常见来源：次数不等于耗时

- **父组件重渲染的级联**：React 默认在父组件 render 时 render 所有子组件，除非子组件能 bailout。级联本身是正常的，只有它变贵时才需要处理。
- **context value 是新引用**：Provider 的 `value` 每次 render 新建对象/数组，所有消费者都会重渲染；`memo` 挡不住 context 更新。
- **内联对象/函数**：`<Child options={{...}} onSave={() => ...} />` 每次都是新引用，既击穿 `memo`，也可能让 Effect 反复执行。
- **render 里的昂贵计算**：过滤、排序、大数组 map、正则、JSON 解析，每次 render 都重跑。
- **列表过大**：即使每行都很便宜，创建上万个元素和 DOM 本身也贵；给每行包 `memo` 不会减少元素数量。
- **layout thrash**：在循环里读 `offsetWidth` → 写 `style` → 再读，会强制浏览器同步布局；应先批量读、再批量写，或改用 `transform`/CSS。
- **Effect 里 setState 的连锁更新**：一次交互触发多轮 render/Effect；很多性能问题来自这种级联，而不是单个组件函数。
- **“渲染次数多”不是结论**：1000 个便宜组件可能比 1 个昂贵图表便宜；诊断看 commit 里的耗时分布，不看控制台打印了多少次 render。

```tsx
const ThemeContext = createContext({ dark: false })
function App() {
  const [count, setCount] = useState(0)
  const value = { dark: false } // 每次 render 都是新对象
  return (
    <ThemeContext value={value}>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      <Toolbar />
    </ThemeContext>
  )
}
function Toolbar() {
  const { dark } = useContext(ThemeContext)
  return <p>{dark ? 'dark' : 'light'}</p>
}
```

`count` 变化时 `value` 是新引用，`Toolbar` 即使只读 `dark` 也会重渲染。若 `value` 真的不依赖 state，把它移到组件外；若依赖，用 `useMemo` 固定引用。注意：这只减少消费者重渲染，不能让昂贵的 context 消费者在 value 真变时跳过。

### 3.4 `memo`：浅比较 props，只在特定形状下有用

- `memo(Component)` 返回一个新组件；父组件 render 时，React 用 `Object.is` **逐个浅比较**新旧 props，全部相同就复用上次结果，跳过这个组件及其子树（仍会因自身 state/context 变化而 render）。
- 有用的条件：纯展示、render 较贵、props 稳定、父组件经常因无关 state 更新。四个条件缺一个，收益就会大打折扣。
- 无用/有害的典型：props 每次都是新对象/新函数；`children` 是父组件每次新建的元素；自定义比较函数写错或做深比较；代码离开 `memo` 就不正确（说明正确性问题没解决）；用 `memo` 掩盖“状态放太高/组件太大”的结构问题。
- `memo` 不加速首次 render，反而多一次比较；如果组件 render 很便宜，包 `memo` 可能净亏。
- 官方口径：memoization 是性能优化，不是保证；React 仍可能因其他原因重渲染。

```tsx
const ExpensiveChart = memo(function ExpensiveChart({ points }: { points: number[] }) {
  const max = Math.max(...points)
  return <canvas data-max={max} />
})

function Dashboard() {
  const [tab, setTab] = useState('chart')
  const [points] = useState([1, 2, 3])
  return (
    <>
      <button onClick={() => setTab(tab === 'chart' ? 'raw' : 'chart')}>{tab}</button>
      <ExpensiveChart points={points} />
    </>
  )
}
```

`tab` 变化时 `points` 还是同一个数组引用，`memo` 让图表跳过；如果写成 `points={[1, 2, 3]}`，每次都是新数组，`memo` 永远失效。**先让 props 稳定，再谈 memo。**

### 3.5 组合通常优于 memo：children、状态下沉、拆分

- **children 组合**：包装组件只负责布局/交互，昂贵子树作为 `children` 由上层创建；包装组件自己的 state 更新时，`children` 元素引用不变，React 可以直接复用，不需要 `memo`。
- **状态下沉**：把输入框、展开/悬停等临时 state 放到真正使用它的小组件里；状态越靠上，重渲染的子树越大。
- **拆分**：把昂贵且不依赖高频 state 的部分移出高频更新的组件，或把高频 state 隔离到叶子。
- 这些是结构优化，不增加比较成本，也不会被“新引用”击穿；通常应先于 `memo` 考虑。

```tsx
function Card({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button onClick={() => setOpen(!open)}>{open ? '收起' : '展开'}</button>
      {children}
    </section>
  )
}

function Page() {
  return <Card><ExpensiveTable /></Card>
}
```

`Card` 的 `open` 变化只重渲染 `Card`，`ExpensiveTable` 的元素对象是 `Page` 上次创建的同一个引用，整棵子树被跳过。若 `Card` 在自己的 return 里写 `<ExpensiveTable />`，每次 `setOpen` 都会新建元素并重渲染它。

### 3.6 `useMemo` / `useCallback`：缓存引用，不是语义保证

- `useMemo(fn, deps)` 在依赖 `Object.is` 相等时复用上次 `fn` 的返回值；`useCallback(fn, deps)` 等价于 `useMemo(() => fn, deps)`，缓存函数本身。
- 两个用途：**跳过昂贵计算**（大数组过滤/排序、派生统计）、**保持引用稳定**（context value、传给 `memo` 子组件的 props、Effect 依赖、自定义 Hook 返回值）。
- 官方明确：它们是性能优化，不是语义保证；React 可能因内存等原因丢弃缓存。**不要让正确性依赖缓存是否命中**；需要稳定语义时用 state/ref 或改数据流。
- 依赖数组必须写全所有响应式值，长度和顺序固定、内联书写。空依赖 `[]` 的含义是“永远不重算”，不是“安全地只算一次”；读取了变化 props 就会拿到旧值。
- 不要滥用：大多数计算很快；`useMemo` 本身有内存和比较成本，还会让代码更难读。只有 Profiler 指向的热点才值得加。
- `useMemo` 不加速首次 render，只帮助更新；`useCallback` 只有在消费者真的比较函数引用时才有意义（`memo` 子组件、Effect 依赖）。

```tsx
const Row = memo(function Row({ item, onPick }) {
  return <li><button onClick={() => onPick(item.id)}>{item.name}</button></li>
})

function List({ items }) {
  const [q, setQ] = useState('')
  const visible = useMemo(() => items.filter((i) => i.name.includes(q)), [items, q])
  const onPick = useCallback((id) => console.log(id), [])
  return <><input value={q} onChange={(e) => setQ(e.target.value)} />
    <ul>{visible.map((i) => <Row key={i.id} item={i} onPick={onPick} />)}</ul></>
}
```

`visible` 只在 `items`/`q` 变化时重算；`onPick` 引用稳定，`Row` 的 `memo` 才不会被新函数击穿。反过来，若 `Row` 没包 `memo`，`useCallback` 在这里几乎没有收益。`items`、`Row` 的定义省略。

### 3.7 React Compiler 1.0：构建期自动 memoization

- React Compiler 是构建期工具（核心是 Babel 插件），分析组件和 Hook 的纯度与依赖关系，在编译产物里插入缓存槽，自动完成大致等价于 `memo` + `useMemo` + `useCallback` 的优化。
- 它主要优化**更新性能**：跳过父组件更新引发的级联重渲染，并缓存组件/Hook 内部的昂贵计算。默认 infer 模式下只处理 React 组件和 Hook，**不处理普通函数**，缓存也**不跨组件/Hook 共享**；工具函数若在多个组件里被调用，仍可能重复计算。
- 前提是遵守 Rules of React：render 必须纯、props/state 不可变。遇到可能违规的代码，编译器会**跳过该组件/Hook 的优化**，而不是冒险改行为；`eslint-plugin-react-hooks@latest` 的 `recommended-latest` 能标出无法优化的组件。跳过是安全的，可以逐步修。
- `"use memo"`：在 annotation 模式下显式选择编译，或在 infer 模式下覆盖判断；`"use no memo"`：临时退出编译（排障用）。函数级指令放函数体第一行，模块级放文件最顶部、所有 import 之前。指令是逃生舱，应写清原因和移除条件。
- 不是魔法：不加速首次 render，不减少 DOM 节点、布局、网络或图片成本，也不能修复不纯的代码；如果代码原本**依赖 memoization 保证正确性**（例如靠引用相等避免 Effect 重跑），编译器改变缓存行为可能暴露 bug。已有 `useMemo`/`useCallback` 可保留，删除前要测试。
- 开启方式（Vite，`@vitejs/plugin-react` 6+）：安装 `babel-plugin-react-compiler` 和 `@rolldown/plugin-babel`，在 Vite 配置中用 `reactCompilerPreset()`；Babel 插件必须最先处理源码。旧版 plugin-react 可用内联 `babel.plugins`。React DevTools 中已编译的组件会显示 Memo 标记。
- **本练习环境不安装、不启用 Compiler**；日常练习不要改共享 Vite 配置。第 3 周末的 kanban v3 再统一开启，并用 Profiler 对比前后。

```js
// vite.config.js —— 仅 v3 使用；日常练习不要改共享配置
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }), // 必须最先分析源码
  ],
})
```

```tsx
function DataGrid() {
  'use no memo' // TODO: 修复动态行高问题后移除（ISSUE-123）
  return <Grid />
}
```

### 3.8 优化决策与验证：先结构、后缓存、再全局

- 决策顺序：复现并测量 → 修数据流（去掉不必要 state/Effect、状态下沉）→ 拆分/children 组合 → 稳定 props（必要时 `useMemo`/`useCallback`）→ 大列表虚拟化 → 用 `useDeferredValue`/transition 保响应（W3D2）→ 最后才考虑全局 Compiler。
- 只有当交互出现**可感知卡顿**、且 Profiler 指向明确热点时才优化；没有测量的“优化”很容易增加复杂度却没有收益。
- 验证必须同场景前后对比：同一交互、同一设备/CPU 降速、同一构建模式。看最慢 commit、`actualDuration`/`baseDuration` 的比值，以及用户可感知的输入延迟。
- 测试可以断言行为和粗粒度的 commit 次数趋势（例如 Profiler 的 `onRender` 调用次数），但**不要断言毫秒数或精确 commit 次数**：开发构建、StrictMode 双调用、并发中断、机器差异都会让数字不稳定。性能回归测试是趋势护栏，不是基准测试。
- 虚拟化（如 TanStack Virtual）解决的是“元素/DOM 数量”，不是“单行 render 贵”；它和 `memo`、deferred 是不同层面的工具。

```tsx
import { Profiler } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
test('搜索输入后显示最终结果', async () => {
  const commits = vi.fn()
  render(<Profiler id="search" onRender={commits}><Search /></Profiler>)
  await userEvent.type(screen.getByRole('textbox'), 'ab')
  expect(screen.getByText('2 results')).toBeInTheDocument()
  // 只做粗粒度趋势断言；不要断言具体毫秒或精确 commit 次数
  expect(commits).toHaveBeenCalled()
})
```

`Search` 省略了定义。真实项目里，性能验证更多依赖生产 profiling 构建和 DevTools；单元测试负责“功能没坏”，不负责给出可信的毫秒数。

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| 所有组件都包 `memo` | 只给 Profiler 指出的、props 稳定的昂贵组件 | 比较有成本、可读性下降；一个总是新的 prop 就让整块优化失效 |
| `useMemo(() => filter(items, q), [])` | 依赖写全 `[items, q]` | 空依赖会缓存第一次的结果，后续 props 变化时拿到旧值 |
| 用 `useMemo`/`useCallback` 保证函数只执行一次或引用永远不变 | 正确性用 state/ref/数据流保证 | 官方说缓存可能被丢弃，它们是性能优化，不是语义保证 |
| 认为 `memo` 能阻止 context 或自身 state 引起的渲染 | 修 context value 引用或拆分 context；`memo` 只比较 props | 消费者仍会因 context 变化重渲染，自身 state 变化也照常 render |
| 用 Compiler 替代修数据流 | 先修不纯 render、不必要 Effect、状态位置 | 编译器只优化符合规则的代码，违规会跳过；坏数据流仍然存在 |
| 只看 render 次数，不看耗时 | 看最慢 commit 和组件耗时分布 | 次数多不一定慢；一个昂贵组件可能比一千个空组件更贵 |
| 在 render 里排序/过滤/做大计算 | `useMemo`、移到组件外、放服务端，或交给 Compiler | 每次 render 都执行，父组件的无关更新也会重跑 |
| 大列表给每行包 `memo` 就以为够了 | 虚拟化 + 稳定 key；`memo` 只减少重渲染 | 仍然要创建全部元素和 DOM，首屏和 commit 依旧很重 |
| context 的 `value` 写内联对象 | 组件外常量，或 `useMemo` 固定引用 | 每次新引用导致所有消费者重渲染 |
| 内联函数传给 `memo` 子组件 | `useCallback`，或状态下沉/children 组合 | 浅比较失败，`memo` 形同虚设 |
| 把昂贵子树写在包装组件自己的 return 里 | 由上层通过 `children` 传入 | 包装组件 state 更新时，children 元素引用稳定 |
| 在测试里断言性能优化后的毫秒数或精确 commit 数 | 断言最终 UI；性能在 profiling 构建和 DevTools 里测 | StrictMode、并发、机器噪声都会让数字不稳定 |
| 在普通 production 构建里用 `<Profiler>` 比较时间 | 使用 `react-dom/profiling` 构建 | 默认生产构建关闭 profiling，没有有效的计时数据 |
| 认为 Compiler 会缓存所有普通函数 | 把昂贵计算放进组件/Hook，或自行缓存 | 默认 infer 模式只处理组件/Hook，缓存不跨组件共享 |
| 认为 transition/deferred 减少了渲染工作量 | 用 memo/拆分/虚拟化降低工作量，transition 只调优先级 | 总工作量不变，只是不阻塞紧急更新（W3D2） |
| 拿首次 mount 的 `actualDuration` 和更新比较 | 比较同一交互优化前后的更新 | mount 包含创建 DOM 和首次计算，天然更慢 |
| 给 `memo` 写自定义比较函数做深比较 | 简化 props，或让引用保持稳定 | 深比较成本可能超过 render 本身，还容易漏字段 |
| 测试中断言精确的 render 次数 | 用 `findBy`/`waitFor` 断言最终 UI；趋势断言放宽 | StrictMode、并发中断、Suspense 重试都会改变次数 |

## 5. 三句话自测

1. **拿到一个“卡”的页面，你的诊断顺序是什么？** 先录一次真实交互，在 Profiler 里找最慢的 commit，用 flamegraph/ranked 和 “Why did this render?” 判断是 render 贵、commit/DOM 贵，还是级联更新；再决定用结构、缓存、虚拟化还是并发，并在同场景复测。
2. **`memo`/`useMemo`/`useCallback` 什么时候有用？** 只在组件 render 贵、props/依赖稳定、父组件频繁更新时有用；props 每次新引用、children 每次新元素、计算很便宜或代码依赖缓存保证正确性时，它们无效甚至有害；引用稳定性是手段，不是语义保证。
3. **React Compiler 1.0 做了什么、没做什么？** 它在构建期分析符合 Rules of React 的组件/Hook，自动插入等价 memoization，减少级联重渲染和组件内昂贵计算；它不优化普通函数、不跨组件共享缓存、不降低 DOM/布局/网络成本，也不能替代正确数据流，违规代码会被跳过。

## 6. 官方阅读

- https://react.dev/reference/react/Profiler
- https://react.dev/reference/react/memo
- https://react.dev/learn/react-compiler
