# W3D1：Fiber 与协调

> 以 React 19.3 为准（npm 最新 19.3.1）。承接 [W1D1 渲染模型](W1D1-render-model.md) 的“render 纯、commit 写 DOM”和 [W1D5 组合与 Context](W1D5-composition-context.md) 的 key 重置。文中 Fiber 字段名参考 React 19.3 的 `react-reconciler@0.34.0` 开发构建，属于内部实现，可能随版本变化；标“面试口径”的地方只要求讲清机制，不要求背源码行号。代码为节省篇幅省略了 `react` 的 import。

## 1. 一句话结论

React 把 UI 表示成一棵由 Fiber 节点组成的链表树，并用 current / workInProgress 两棵树做双缓冲：render 阶段在 WIP 树上按“同层 + type + key”做 diff（可中断、可丢弃），commit 阶段一次性切换树并写 DOM；所以只有同一父级下 type 和 key 相同的节点才会复用 state（单节点没有 key 时看位置），key 就是列表项在兄弟之间的身份证。

## 2. 心智模型

```text
元素树（每次 render 重新创建）          Fiber 树（跨 render 持久化，链表）
<App>                                  App
  <List>                                 │ child
    <li key="a">A</li>                   ▼
    <li key="b">B</li>                  List
  </List>                                │ child
</App>                                   ▼
                                      li#a ──sibling──► li#b
                                        │                 │
                                        └──── return ─────┘   （都指回 List）

Fiber 的三种遍历指针：
  child   → 第一个子节点        sibling → 下一个兄弟        return → 父节点

双缓冲：
  current（屏幕上的树）   ◄── alternate ──►   workInProgress（正在算的树）
  render 只改 WIP；commit 的 mutation 之后 root.current = WIP，旧 current 留作下次的 alternate。
```

```tsx
function App({ items }: { items: Item[] }) {
  return <ul>{items.map((it) => <li key={it.id}>{it.text}</li>)}</ul>
}
```

这段 JSX 每次 render 都会新建普通的元素对象；真正跨 render 保存 DOM 引用、Hooks 状态和 diff 结果的是 Fiber 树。三句话记住：**元素树是描述，Fiber 树是工作台；current 是屏幕，WIP 是草稿；key 是列表项的身份。**

## 3. 要点

### 3.1 Fiber 节点：把树变成可暂停的链表

> 实现细节，面试口径：字段来自 `FiberNode` 构造器；不同 React 版本可能增删，但核心结构稳定。

| 字段 | 含义 | 为什么协调需要它 |
|---|---|---|
| `tag` | 节点种类：函数组件、HostComponent、HostText、Fragment、Suspense… | 决定 `beginWork` / `completeWork` 走哪个分支 |
| `type` | 具体类型：组件函数本身，或 `'div'` 这样的字符串 | 类型不同 → 整棵子树重建 |
| `elementType` | 元素上的原始类型（`memo` / `lazy` 包装时可能与 `type` 不同） | 判断“还是不是同一个组件” |
| `key` | 兄弟列表中的身份 | 数组 diff 用它匹配新旧节点 |
| `stateNode` | Host 节点对应的真实 DOM；函数组件通常为 `null` | commit 时拿到 DOM 做插入/更新 |
| `memoizedProps` | 上一次已提交的 props | 与 `pendingProps` 比较，决定能否跳过 |
| `pendingProps` | 本次 render 待处理的 props | `beginWork` 的输入 |
| `memoizedState` | 函数组件的 Hooks 链表（`useState` 的值就在里面） | 复用 Fiber 时 state 跟着复用 |
| `updateQueue` | 更新队列 / effect 等内部队列 | 保存待处理更新和副作用 |
| `child` / `sibling` / `return` | 第一个子节点 / 下一个兄弟 / 父节点 | 显式链表树，支撑可中断遍历 |
| `index` | 在兄弟中的位置 | 没有 key 时作为隐式 key |
| `alternate` | 另一棵树中对应的 Fiber | 双缓冲与节点复用 |
| `flags` / `subtreeFlags` | 本节点 / 子树的副作用位标记（插入、更新、删除、Passive 等） | commit 只处理有标记的节点 |
| `deletions` | 本节点下待删除的子 Fiber 数组 | commit 统一卸载 |
| `lanes` / `childLanes` | 本节点 / 子树待处理更新的优先级 | 决定这次 render 处理哪些更新 |

```tsx
// 仅用于观察：从 DOM 反查 Fiber，沿 return 指针打印组件路径（依赖开发构建的内部属性）
function FiberProbe() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current!
    let f: any = (el as any)[Object.keys(el).find((x) => x.startsWith('__reactFiber$'))!]
    const path: string[] = []
    while (f) {
      path.push(typeof f.type === 'string' ? f.type : f.type?.name ?? String(f.tag))
      f = f.return
    }
    console.log(path.join(' ← '))
  }, [])
  return <div ref={ref}>probe</div>
}
```

**为什么需要链表树，而不是普通递归？** 递归的调用栈由 JS 引擎管理，React 无法在“处理完一半”时把栈保存下来、稍后恢复。Fiber 把递归改成显式的“下一个是谁”：每个节点就是一个工作单元，处理完一个，`performUnitOfWork` 返回下一个；需要让出主线程时，只要记住当前的 `workInProgress`，之后从它继续。

- `child` 负责向下进入子树；
- `sibling` 负责在同一层继续；
- `return` 让收尾阶段能向上冒泡（`completeWork`）；
- `alternate` 让两棵树的节点一一对应，复用和切换都是 O(1)。

代价是指针跳转和位运算比直接递归更难读，但这是框架内部成本，换来的是可暂停、可恢复、可丢弃的渲染。

### 3.2 双缓冲：current 与 workInProgress

首次挂载时，`root.current` 指向 HostRoot Fiber，React 基于它创建 WIP 树。更新时调用 `createWorkInProgress(current, pendingProps)`：

- 如果 `current.alternate` 已存在，就复用它，只重置本次需要的字段；
- 否则新建一个 Fiber，并让 `current.alternate = wip`、`wip.alternate = current`。

render 全程只修改 WIP，current 仍然对应屏幕上已提交的树。commit 的 mutation 阶段把 DOM 改完后，执行：

```text
root.current = finishedWork
```

旧 current 留作下一次的 alternate。若 render 中途被打断、结果作废，WIP 直接丢掉即可，屏幕上的 current 从未被改过——这就是“保留旧屏幕、在后台准备新屏幕”的基础。

```tsx
// 仅用于观察：真实代码不要在 render 中读 DOM 或写日志
function Demo() {
  const [n, setN] = useState(0)
  const shown = () => document.getElementById('out')?.textContent
  console.log('render', n, 'DOM:', shown())          // 读到的是上一次 commit
  useLayoutEffect(() => console.log('commit', n, 'DOM:', shown()))
  return <button id="out" onClick={() => setN(n + 1)}>{n}</button>
}
```

首次 render 时 DOM 还不存在；点击后，render 日志仍读到旧值，layout effect 才读到新值。这正是 W1D1 薄弱点“render 读到上一次 commit 的 DOM”的底层原因：render 在 WIP 上算，DOM 还没有被 commit。

### 3.3 render 与 commit：beginWork、completeWork、work loop、副作用

```text
beginWork    向下   这个节点要不要更新？它的 children 是什么？
completeWork 向上   这个节点的 DOM 怎么建/改？子树有哪些副作用要冒泡？
```

一次工作循环的直觉：

1. `performUnitOfWork(wip)` 调用 `beginWork(current, wip, lanes)`。
2. `beginWork` 根据 `tag` 调用组件函数或准备 Host 节点，并返回第一个子 Fiber；返回 `null` 表示没有子节点。
3. 有子节点就继续向下；没有就进入 `completeUnitOfWork`，对该节点调用 `completeWork`，然后找 `sibling`，没有就沿 `return` 回到父级继续收尾。
4. `completeWork` 首次挂载时为 Host 节点在内存中创建 DOM 并组装子树（尚未插入文档）；更新时主要计算/标记属性变化，并把子树的副作用标记汇总到 `subtreeFlags`。

`beginWork` 里有一个重要优化：如果 props 没变、没有该 lane 的更新、context 也没变，就 `bailout`，复用已有子 Fiber 并跳过这棵子树的重新计算。`memo` 和 React Compiler 的效果最终都落到这里（W3D3 展开）。

下面用普通对象模拟 Fiber 的 `child` / `sibling` / `return`，观察两个阶段的顺序：

```ts
type F = { name: string; child?: F; sibling?: F; return?: F }
const a: F = { name: 'li#a' }, b: F = { name: 'li#b' }, root: F = { name: 'ul', child: a }
a.sibling = b; a.return = b.return = root
function workLoop(wip?: F) {
  while (wip) {
    console.log('beginWork', wip.name)
    if (wip.child) { wip = wip.child; continue }
    while (wip) {
      console.log('completeWork', wip.name)
      if (wip.sibling) { wip = wip.sibling; break }
      wip = wip.return
    }
  }
}
workLoop(root) // begin ul → begin li#a → complete li#a → begin li#b → complete li#b → complete ul
```

真实实现里，同步渲染用 `workLoopSync` 一口气跑完；并发渲染用类似 `while (wip && !shouldYield())` 的循环，在每个工作单元后检查是否该把主线程还给浏览器（Scheduler 约 5ms 时间片，实现细节）。

**commit 的四个子阶段（了解顺序即可）：**

1. before mutation：读取 DOM 快照；
2. mutation：插入/更新/删除 DOM，解绑 ref，执行 layout effect 的 cleanup；
3. layout：执行 `useLayoutEffect` setup，绑定 ref；
4. passive：执行 `useEffect`（通常在浏览器绘制后）。

**副作用列表怎么来的？** 有副作用的 Fiber 会被打上相应的 `flags`（例如 Placement、Layout、Passive），具体的 effect 回调存在 Hook 的循环链表里；`completeWork` 把子树的标记汇总到 `subtreeFlags`。commit 从 root 向下遍历，遇到 `subtreeFlags` 为 0 的子树直接跳过。早期 React 用 `firstEffect` / `nextEffect` 把有副作用的 Fiber 串成链表，现代实现用 flags + subtreeFlags（实现细节，面试口径）。

W1D1 说“render 纯、commit 写 DOM”；Fiber 解释了为什么：render 在 WIP 上可能重复执行、被打断、被丢弃，只有 commit 拥有唯一的 DOM 写权限。

### 3.4 Diff 规则：同层比较，type + key 决定复用

协调（reconciliation）就是“用新元素树和旧 Fiber 树比较，决定复用谁、新建谁、删除谁”。规则可以压缩成下面几条：

| 新旧情况 | 结果 |
|---|---|
| 同父级、同 `type`、同 `key`（单节点看位置） | 复用 Fiber / DOM / state，只更新 props |
| 同父级、同 `type`、`key` 不同 | 卸载旧的，挂载新的，state 重置 |
| 同父级、`type` 不同 | 整棵子树重建，state 重置 |
| 不同父级（哪怕 type 和 key 都一样） | 不跨层移动，视为删除 + 新建 |
| 数组里 `key` 相同、`type` 相同 | 复用，位置可能移动 |
| 数组里 `key` 相同、`type` 不同 | 删旧建新 |

关键点：

- **只做同层比较。** React 不会把节点从一棵父树“搬”到另一棵父树；跨父级移动一定丢 state。
- **单节点**：比较 `key` 和 `type`，都相同才复用；否则删旧建新。
- **type 不同的代价**：React 不知道两个不同组件之间如何迁移 state，DOM 标签的属性/事件也可能完全不同，所以直接重建整棵子树。
- **state 保留规则**：在同一父级下，`type` 和 `key` 相同才会保留 state（没有 key 的单节点用位置判断）；key 变化等于换了身份。W1D5 从“使用”角度讲 key 重置，这里从“diff”角度解释原因。
- **key 只作用于兄弟列表**：不同父级、不同数组里的相同 key 互不影响；key 也不需要全局唯一。
- **W2D5 讲的是 state 该放在哪，这里讲的是同一份 state 在 diff 中会不会被保留**，两个问题不要混。

```tsx
function Counter({ name }: { name: string }) {
  const [score, setScore] = useState(0)
  return <button onClick={() => setScore(score + 1)}>{name}: {score}</button>
}
function Scoreboard({ isA }: { isA: boolean }) {
  return isA ? <Counter name="A" /> : <Counter name="B" />
}
// 切换 isA 后分数还在：同位置 + 同类型 → 复用同一个 Counter
// 想让两个分支各自独立：<Counter key="a" ... /> / <Counter key="b" ... />
```

React 看不到“A 和 B 语义上不是同一个人”，它只看到同一位置、同一组件类型。需要区分身份时，key 是最便宜的手段。

### 3.5 列表 diff 的直觉：按 key 匹配、move 的判定、删除/新增

数组子节点的协调可以按下面的可操作规则理解（不需要背源码行号）：

1. **先按位置试匹配。** 新旧列表从左到右逐项比较，只有 `key` 相同才继续看 `type`；`key` 不同就停止这一轮。
2. **剩下的旧节点建 Map。** 以 `key` 为键（没有 key 时用 `index`），把还没匹配的旧 Fiber 放进 Map，方便 O(1) 查找。
3. **新列表逐项找旧节点。** 在 Map 里按 key 找：找到且 type 相同 → 复用；找不到或 type 不同 → 新建（旧节点进入删除）。
4. **用 `lastPlacedIndex` 判断是否移动。** 从左到右记录已复用节点的旧 index 最大值；如果当前复用的旧 index 小于它，说明这个节点在新列表里需要往右移，标记 `Placement`；否则更新 `lastPlacedIndex`。
5. **收尾。** 没被复用的旧节点删除（`ChildDeletion`），新增节点插入；commit 阶段统一执行 `insertBefore` / `appendChild` / `removeChild`。

这不是“最小编辑距离”，也不是最优的最长递增子序列，而是一趟线性启发式；它保证正确性，但不保证移动次数最少（面试口径）。

```tsx
function Row({ row }: { row: { id: string; text: string } }) {
  const [open, setOpen] = useState(false)
  return <li><button onClick={() => setOpen(!open)}>{row.text}</button>{open && ' ✓'}</li>
}
function List({ rows }: { rows: { id: string; text: string }[] }) {
  return <ul>{rows.map((row) => <Row key={row.id} row={row} />)}</ul>
}
// ✗ 若改成 key={index}：在顶部插入一条后，open 状态留在“第 0 行”，跟着位置走而不是跟着 row 走
```

**index key 为什么会错位？** 假设旧列表是 `[A(key=0), B(key=1)]`，在顶部插入 C 后变成 `[C(key=0), A(key=1), B(key=2)]`：

```text
key=0：旧 A 的 Fiber 被复用给 C → C 继承了 A 的 DOM 和 state
key=1：旧 B 的 Fiber 被复用给 A → A 继承了 B 的 DOM 和 state
key=2：B 是新 key → 新挂载
```

React 认为“key=0 还是同一个组件”，于是复用了 DOM/state，只把 props 换成 C 的数据。输入框内容、展开状态、焦点、动画因此全部跟着位置走，而不是跟着数据走。删除和重排同理：只要 key 会随位置变化，身份就会错位。

**什么时候可以接受 index key？** 列表完全静态、不会插入/删除/排序/筛选，且子项没有需要保留的交互 state。只要列表可能重排，或者子项有输入框、展开状态、动画，就应使用稳定 ID。**不要用 `Math.random()` 生成 key**：每次 render 都是新 key，等于每次全部卸载重建。

### 3.6 并发渲染预告：lanes 与可中断

React 19 的更新按 **lane** 分优先级。lane 是位掩码中的一位（transition 等场景是一组位），root 维护 `pendingLanes`，每次 render 选择当前最高优先级的一组 lane 来处理。概念上的分类（具体分配是实现细节，面试口径）：

| lane 概念 | 典型来源 | 行为 |
|---|---|---|
| Sync | click、input 等离散交互 | 立即同步渲染，保证输入不卡 |
| InputContinuous | drag、scroll 等连续交互 | 较高优先级 |
| Default | 普通 `setState`、数据到达 | 默认并发渲染 |
| Transition | `startTransition` / `useDeferredValue` | 可被更高优先级更新打断 |
| Idle / Offscreen | 预取、隐藏内容 | 最低优先级或特殊用途 |

并发渲染的三个关键事实：

- **render 可中断。** React 在每个工作单元后检查是否该让出主线程；更高优先级的更新到来时，可以暂停当前低优先级 render，先处理紧急更新，再回来继续或重做。
- **低优先级工作可以被丢弃。** 如果新的更新让旧结果过时，React 不必把旧 WIP 算完。
- **commit 仍然同步且原子。** 对同一个 root，DOM 只在 commit 阶段改，屏幕不会看到半棵树。所谓“并发”是 render 阶段的时间切片，不是 DOM 逐步更新。

```tsx
function Search({ items }: { items: string[] }) {
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(items)
  const [isPending, startTransition] = useTransition()
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQ(value) // 紧急 lane：输入框立即响应
    startTransition(() => setShown(items.filter((x) => x.includes(value)))) // 低优先级
  }
  return <><input value={q} onChange={onChange} />{isPending && '更新中…'}
    <ul>{shown.map((x) => <li key={x}>{x}</li>)}</ul></>
}
```

输入时 `setQ` 走紧急 lane，列表过滤走 transition lane；用户继续打字可以打断列表的 render，`isPending` 用来显示“旧结果还在，新结果正在算”。W3D2 会展开 `useTransition`、`useDeferredValue` 和 `<Activity>`。

**为什么 render 必须纯？** 因为 render 可能执行 0 次、1 次或多次；可能被中断后重来；可能算完但被丢弃。任何在 render 中发请求、写 ref、改全局变量、订阅的代码，都会重复执行，或者作用在一棵永远不会提交的树上。副作用放事件处理函数或 Effect；render 只根据 props、state、context 计算 JSX。

### 3.7 实践含义

- **用稳定 ID 做 key。** 数据库主键、后端返回的 id，或在创建数据时生成的 `crypto.randomUUID()`；生成一次并持久化，不要在 render 里重新生成。
- **不要用随机 key。** `key={Math.random()}` 会让每次 render 都卸载重建整棵子树，state、DOM、焦点、动画全部丢失。
- **不要用 index 作为可重排队列的 key。** 插入、删除、排序、筛选都会让 key 与数据错位；只有完全静态的列表才可以考虑。
- **key 只在兄弟列表内唯一。** 不同数组、不同父级可以重复；不需要全局唯一。
- **key 变化 = 卸载重建。** 旧组件的 Effect cleanup 会执行，DOM 和 state 会丢失；可以有意用它重置 state（W1D5），但不要把它当日常“强制刷新”手段。
- **key 不是 prop。** React 会剥掉 key，子组件里读不到 `props.key`；需要 id 时单独传。
- **列表的每一项都要 key，不是只给第一项。** 嵌套列表每一层各自需要 key，作用域是各自的兄弟列表。
- **`<Fragment>` 需要 key 时用完整写法。** `<></>` 不能接收 key。

```tsx
import { Fragment } from 'react'
// 每个数组内部唯一即可；不同数组可以重复 key
{groups.map((group) => (
  <Fragment key={group.id}>
    <h2>{group.title}</h2>
    {group.items.map((item) => <Row key={item.id} item={item} />)}
  </Fragment>
))}
```

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| 可重排/可插入列表用 `key={index}` | `key={item.id}` 等稳定 ID | 插入/删除/排序后 key 与数据错位，state 和 DOM 跟着位置走 |
| `key={Math.random()}` 强制刷新 | 只在身份变化时换稳定 key | 每次 render 都是新 key，整棵子树卸载重建 |
| 认为不写 key 只是少个警告 | 显式提供稳定 key | 不写时 React 用位置/index 作为隐式 key，等于选择“位置身份” |
| 在子组件里读 `props.key` | 单独传 `id` prop | key 是 React 保留属性，不会出现在 props 中 |
| 认为 key 必须全局唯一 | 只需在兄弟列表内唯一 | 不同数组/父级可以使用相同 key |
| 同一级两个兄弟用同一个 key | 每个兄弟 key 唯一 | 重复 key 会让匹配和复用混乱 |
| 把节点从一个父级“移动”到另一个父级，期望保留 state | 接受卸载重建，或把状态提升到共同父级 | diff 只做同层比较，跨父级是删除 + 新建 |
| 认为同位置同类型一定保留 state | 同时看 key；key 变了就重置 | 身份 = 位置 + 类型 + key |
| 把 key 当日常“强制重新渲染”手段 | 改 props/state；只有确实要重置时才换 key | key 变化会卸载整棵子树，代价远大于普通更新 |
| render 中发请求、写 ref、改全局变量，认为“只执行一次” | 放事件处理函数或 Effect | render 可能重复、被中断、被丢弃 |
| 认为并发渲染会把半成品 DOM 逐步显示 | 理解 commit 一次性切换 | render 在 WIP 上，DOM 只在 commit 改 |
| 列表的 id 在 render 中重新生成 | 在创建数据时生成并持久化 | 每次 render 新 id = 每次全部重建 |
| 条件渲染两个同位置同类型分支，以为 state 会分开 | 用不同 key 或不同组件类型 | React 只看位置 + 类型，不看业务语义 |
| 给 `<></>` 加 key | `<Fragment key={...}>` | 简写 Fragment 不支持 key |

## 5. 三句话自测

1. **Fiber 为什么用 `child` / `sibling` / `return` 链表，而不是普通递归？** 因为递归调用栈无法保存和恢复；链表把渲染拆成一个个工作单元，`return` 支持向上收尾，`alternate` 支持双缓冲，从而可以暂停、恢复或丢弃。
2. **双缓冲下 render 和 commit 各做什么？** render 在 workInProgress 树上执行 `beginWork` / `completeWork`，可中断、可重做；commit 同步执行 DOM 变更，然后 `root.current = finishedWork`，屏幕始终看到一致的树。
3. **列表 diff 中 key 如何决定复用和移动？index key 为什么错？** 同层同 type 同 key 才复用；按 key 建 Map 匹配，旧 index 小于 `lastPlacedIndex` 时标记移动；index key 把身份绑在位置上，插入/重排后 state 和 DOM 会跟错数据。

## 6. 官方阅读

- https://legacy.reactjs.org/docs/reconciliation.html （协调规则与两个假设；规则至今适用）
- https://react.dev/learn/preserving-and-resetting-state （state 保留与 key 重置）
- https://react.dev/learn/rendering-lists （key 的规则、index key 与随机 key 的问题）
