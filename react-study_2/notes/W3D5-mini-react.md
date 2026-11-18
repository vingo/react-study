# W3D5：手写 mini-react

> 以 React 19.3 的公开语义为准。mini-react 是教学实现，不是 React 源码的复制；`current`、`alternate`、`memoizedState` 等字段借用 React 的内部概念，但实现刻意简化，不能用于生产。文中代码来自同一个 `mini-react/index.js` 骨架，按 3.1–3.6 组合即可运行；单独摘录时依赖同节定义的同名函数。

## 1. 一句话结论

React 的核心是一条单向流水线：JSX 在编译期变成 `createElement` 调用，返回不可变的元素对象；`render` 以 current Fiber 树为模板创建 workInProgress 树，用 `child` / `sibling` / `return` 链表逐个处理，并在同层按 `type` + `key` 复用节点；`commit` 同步、原子地写 DOM 后切换 current；`useState` 只是挂在 Fiber 上按调用顺序排列的 Hook 链表和更新队列，`setState` 排队后从根重新 render。

## 2. 心智模型

```text
JSX 源码
  │ Babel / SWC 编译（构建期，不是浏览器运行期）
  ▼
createElement(type, props, ...children) ──► 元素对象 { type, key, props }
  │                                          每次 render 重新创建，只是“描述”
  │ render
  ▼
Fiber 树（跨 render 保留）
  current（屏幕上的树） ◄── alternate ──► workInProgress（草稿树）
  每个节点：child ─► 第一个子节点；sibling ─► 下一个兄弟；parent/return ─► 父节点
  │ beginWork 向下，completeWork 向上；同层按 type + key diff
  ▼
commit：同步、原子地写 DOM；root.current = workInProgress
  ▼
屏幕
```

```jsx
function Counter() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN((x) => x + 1)}>{n}</button>
}
// click → setN(action) 入队并调度
// → 从根 render：Counter 重新执行，useState 找到旧 Hook 并重放队列
// → diff：同父级、同 type 'button'、同 key → 复用 DOM 与 Hook state
// → commit：只把文本 0 改成 1，然后 currentRoot = workInProgress
```

记住三句话：**元素树是每次新建的图纸，Fiber 树是跨 render 的工作台，DOM 只在 commit 被修改。** mini-react 把这套机制压缩到几百行，因此能看清每一层职责，也必然丢掉大量工程细节。

## 3. 要点

### 3.1 JSX 编译成元素对象，不是 HTML

JSX 不是浏览器能识别的语言，也不是 HTML 字符串。它在构建期被 Babel / SWC 编译成函数调用：经典运行时调用 `React.createElement`，自动运行时调用 `react/jsx-runtime` 的 `jsx` / `jsxs`。浏览器最终只收到普通 JavaScript。所以 JSX 里的 `className`、`htmlFor`、`onClick` 是 JavaScript 对象属性，不是 HTML 属性；`<div>hello {name}</div>` 里的表达式在编译期变成参数；相邻的多个根节点需要 Fragment 包起来；文本会被当作文本节点处理，默认转义，而不是拼进 `innerHTML`。

元素对象只是“描述 UI 的不可变数据”。真实 React 元素还有 `$$typeof`（标记可信元素）、`_owner`、开发期字段等；React 19 让函数组件可以把 `ref` 当作普通 prop 接收（不再需要 `forwardRef`），但宿主元素的 `ref` 仍由 React 特殊处理。mini 只保留最小形状：`type`、`key`、`props`，其中 `children` 放在 `props` 里。真实 React 不会把文本 child 变成元素对象，而是由 reconciler 在渲染时创建文本节点；mini 也保留字符串和数字，等到构建 Fiber 时再转成 Text 节点，这和官方模型一致。

`type` 区分两种东西：字符串是宿主标签（`'div'`、`'button'`），最终会调用 `document.createElement`；函数是组件，`createElement` 只把函数引用存进 `type`，**不会执行它**，要等到 render 的 `beginWork` 才调用 `Counter(props)`。因此自定义组件首字母必须大写：`<Counter />` 传递函数变量，`<counter />` 会被编译成字符串 `'counter'`，变成未知的宿主标签。

```js
function normalizeChildren(input) {
  const out = []
  for (const child of (Array.isArray(input) ? input : [input])) {
    if (child == null || typeof child === 'boolean') continue
    if (Array.isArray(child)) out.push(...normalizeChildren(child))
    else out.push(child)
  }
  return out
}
export function createElement(type, config, ...children) {
  const { key = null, ...props } = config ?? {}
  const kids = children.length ? normalizeChildren(children)
    : config?.children !== undefined ? normalizeChildren([config.children]) : []
  return { type, key: key ?? null, props: { ...props, children: kids } }
}
```

关键点：`key` 被单独提取，不会出现在 props 里，且 `key: 0` 合法，不能用真假值判断；`null`、`undefined`、布尔值不渲染，直接过滤；嵌套数组递归展平；字符串和数字保留原值，渲染时再转文本。可变参数 children 优先于 `props.children`，两者都没有时是 `[]`。真实 `createElement` 还会校验 key、处理 ref 与开发期告警，mini 省略。

```jsx
function Counter({ step }) { return <button>{step}</button> }

const host = <div className="box">hi</div>
// 编译为 createElement('div', { className: 'box' }, 'hi')
// → { type: 'div', key: null, props: { className: 'box', children: ['hi'] } }

const comp = <Counter step={2} />
// → { type: Counter, key: null, props: { step: 2, children: [] } }
// createElement 只记录 Counter 函数，不执行它；beginWork 才调用 Counter(props)
```

用 mini 跑 JSX 时，构建工具要配置 classic runtime（例如文件顶部的 `/** @jsx createElement */`，或 esbuild 的 `jsxFactory`）；自动运行时的 `jsx` / `jsxs` 签名不同，本文测试直接调用 `createElement`，避免依赖编译配置。mini 没有实现 Fragment，练习里用单个父节点或数组 children 代替 `<>...</>`。

**为什么元素对象要每次重建？** 因为组件是纯函数，render 只是根据当前 props/state 重新算一份描述；把描述和“上一次的真实 DOM 引用、Hook 状态、diff 结果”分开，才能安全地重复 render、丢弃结果。真正跨 render 持久化的是 Fiber 树，不是元素树。

### 3.2 首次 render：从元素树到 Fiber 与 DOM

`render(element, container)` 是 mini 的根入口。它创建一棵以 `container` 为 DOM 的 root Fiber，把 `element` 放进 root 的 `props.children`，然后启动工作循环。首次挂载时 `alternate` 为 `null`；对同一个容器再次 `render` 新元素时，`alternate` 指向上一棵 current 树，走更新路径。

`beginWork` 处理宿主节点时创建一个**尚未插入文档**的 DOM：文本 Fiber 用 `document.createTextNode`，元素 Fiber 用 `document.createElement`，然后 `updateDom(dom, {}, props)` 绑定初始属性与事件。函数组件 Fiber 没有 DOM，它只执行组件函数并协调返回的元素。`completeWork` 在真实 React 中负责挂载时创建 DOM、计算更新、处理 hydration，并把子树的 flags 冒泡给父级；mini 的 `completeWork` 只做标记冒泡，DOM 插入统一留给 commit。这是刻意简化，但“render 只准备、commit 才写屏幕”的边界保持不变。

commit 阶段把 root 的子 DOM 挂到容器；更深层的节点按新 sibling 顺序 append 到父节点，必要时通过移动已有节点完成重排。因此首次 render 结束时 DOM 才可查询，render 函数执行期间 `document.querySelector` 看不到新节点，这与 W1D1 的“render / commit 时序”一致。文本 Fiber 的 `type` 是 `null`，`props` 里只有 `nodeValue`；字符串和数字在构建 Fiber 时转成 Text 节点。更新文本时改的是 `node.nodeValue`，绝不能对父元素直接写 `textContent`，否则会清空并重建整棵子树。

```js
let currentRoot = null, wipRoot = null, nextUnitOfWork = null, deletions = []
let rootElement = null, rootContainer = null, isRendering = false
export function render(element, container) {
  if (isRendering) throw new Error('render 期间不要再次 render 或 setState'); isRendering = true
  rootElement = element; rootContainer = container
  const sameRoot = currentRoot?.dom === container
  wipRoot = {
    type: 'ROOT', key: null, props: { children: [element] }, dom: container,
    parent: null, child: null, sibling: null, alternate: sameRoot ? currentRoot : null,
    effectTag: null, subtreeDirty: false, memoizedState: null, index: 0,
  }
  deletions = []
  nextUnitOfWork = wipRoot
  try { workLoop() } finally { isRendering = false }
}
```

```js
function createDom(fiber) {
  const dom = fiber.type === null
    ? document.createTextNode('')
    : document.createElement(fiber.type)
  updateDom(dom, {}, fiber.props)
  return dom
}
```

```js
const toAttr = (name) => name === 'className' ? 'class' : name === 'htmlFor' ? 'for' : name

function removeDomProps(dom, prev, next) {
  for (const name in prev) {
    if (name === 'children' || prev[name] === next[name]) continue
    if (name.startsWith('on')) { if (prev[name]) dom.removeEventListener(name.slice(2).toLowerCase(), prev[name]) }
    else if (name === 'nodeValue') dom.nodeValue = ''
    else if (name === 'style') dom.removeAttribute('style')
    else if (name === 'value') dom.value = ''
    else if (name === 'checked') dom.checked = false
    else dom.removeAttribute(toAttr(name))
  }
}
```

```js
function setDomProps(dom, prev, next) {
  for (const name in next) {
    if (name === 'children' || prev[name] === next[name]) continue
    if (name.startsWith('on')) { if (next[name]) dom.addEventListener(name.slice(2).toLowerCase(), next[name]) }
    else if (name === 'nodeValue') dom.nodeValue = next[name]
    else if (name === 'style') { dom.style.cssText = ''; Object.assign(dom.style, next[name]) }
    else if (name === 'value') dom.value = next[name] == null ? '' : String(next[name])
    else if (name === 'checked') dom.checked = Boolean(next[name])
    else if (next[name] === false || next[name] == null) dom.removeAttribute(toAttr(name))
    else dom.setAttribute(toAttr(name), next[name] === true ? '' : String(next[name]))
  }
}
```

```js
function updateDom(dom, prev, next) {
  removeDomProps(dom, prev, next)
  setDomProps(dom, prev, next)
}
```

`updateDom` 的核心是**差量**：旧事件处理器变了或没了，先解绑；新处理器不同，再绑定；属性做 `prev` / `next` 对比。这样更新时不会重复叠加监听器，也不会让旧闭包继续响应点击。文本节点没有属性，只设置 `nodeValue`。属性名映射（`className` → `class`、`htmlFor` → `for`）、布尔属性、`value` / `checked` 的 property 同步都做了最简处理；SVG 命名空间、事件捕获、`onChange` 与 React 受控输入的完整语义没有实现，真实 React 的 DOM 属性层要复杂得多。

事件这里也有一个刻意的简化：mini 给每个 DOM 节点直接 `addEventListener('click', handler)`，`onClick` 只是把 `on` 去掉并转小写；真实 React 在根容器做事件委托，包装成合成事件，并处理捕获、优先级、`onChange` 归一化等。`onDoubleClick` 在 mini 里会变成原生 `doubleclick`，而正确事件名是 `dblclick`，所以不要拿它当完整事件系统。

### 3.3 Fiber 工作循环：beginWork、completeWork 与双缓冲

Fiber 是把“递归渲染”改写成“显式链表遍历”的节点。mini 的 Fiber 只需要这些字段：`type`、`key`、`props`、`dom`、`parent`、`child`、`sibling`、`alternate`、`effectTag`、`subtreeDirty`、`memoizedState`、`index`。真实 React 还有 `tag`、`stateNode`、`pendingProps` / `memoizedProps`、`flags` / `subtreeFlags`、`lanes` 等，不同版本可能增删；这里只保留理解机制所需的最小集合。React 把父指针叫 `return`，mini 叫 `parent`，含义相同。

`beginWork` 向下：判断 Fiber 种类。root 协调 children；函数组件执行函数并用返回值协调；宿主节点没有 DOM 就先创建，再协调 children。`completeWork` 向上：真实 React 在这里挂载 DOM、计算更新、处理 hydration、把子树的副作用标记冒泡；mini 只把 `effectTag` / `subtreeDirty` 往父级冒泡，commit 再遍历。两者共同构成一次工作循环：有 child 就下潜，没有 child 就收尾并找 sibling，找不到 sibling 就沿 parent 回到上层继续收尾。

**为什么用链表而不是普通递归？** 普通递归的调用栈由 JS 引擎管理，React 无法在处理到一半时把整个栈保存下来、稍后恢复。Fiber 把每个节点变成一个工作单元，`child` 负责向下、`sibling` 负责同层前进、`return` 负责向上收尾；主循环只要记住当前的 `nextUnitOfWork`，就能在任意单元后让出主线程，之后从同一个指针继续。真实 React 的并发渲染正是利用这一点，在每个工作单元后检查是否该 yield；单个组件函数体仍然不能被打断，所以一个耗时 200ms 的组件依旧会卡住。mini 使用同步 `while`，没有实现时间切片，但结构上预留了挂起点。

双缓冲是另一条主线。更新时不会原地改屏幕上的树，而是基于 current 创建 workInProgress：同一个 Fiber 的 `alternate` 指向另一棵树中的对应节点。render 全程只改 WIP 的 Fiber 结构，current 仍对应已提交的屏幕；commit 完成 DOM 变更后执行 `currentRoot = wipRoot`，旧 current 留作下一次的 alternate。如果 render 被中断或结果被丢弃，WIP 直接扔掉即可，屏幕从未被改过。mini 是同步实现，不会真的丢弃，但“current / WIP 分离”让这个能力成为可能。注意：mini 的 Hook 对象在 current 和 WIP 之间共享（3.5 详述），这是同步简化；真实 React 会为 WIP 复制 Hook，避免未提交的 render 污染 current。

```js
const isText = (node) => typeof node === 'string' || typeof node === 'number'
const typeOf = (node) => isText(node) ? null : node.type
const propsOf = (node) => isText(node) ? { nodeValue: String(node) } : node.props
function createFiber(node, parent, alternate = null) {
  return {
    type: typeOf(node), key: isText(node) ? null : node.key ?? null, props: propsOf(node),
    dom: null, parent, child: null, sibling: null, alternate,
    effectTag: null, subtreeDirty: false, memoizedState: null, index: 0,
  }
}
```

```js
function beginWork(fiber) {
  if (fiber.type === 'ROOT') reconcileChildren(fiber, fiber.props.children)
  else if (typeof fiber.type === 'function') {
    wipFiber = fiber; hookIndex = 0
    const output = fiber.type(fiber.props); wipFiber = null   // 离开 Hook 上下文
    reconcileChildren(fiber, [output])
  } else {
    if (!fiber.dom) fiber.dom = createDom(fiber)
    reconcileChildren(fiber, fiber.props.children ?? [])
  }
}
function completeWork(fiber) {
  if ((fiber.effectTag || fiber.subtreeDirty) && fiber.parent) fiber.parent.subtreeDirty = true
}
```

```js
function performUnitOfWork(fiber) {
  beginWork(fiber)                         // 向下：调组件 / 建 DOM / diff children
  if (fiber.child) return fiber.child
  let node = fiber
  while (node) {
    completeWork(node)                     // 向上：收尾、冒泡标记
    if (node.sibling) return node.sibling
    node = node.parent                     // React 里叫 return
  }
  return null
}
```

```js
function workLoop() {
  while (nextUnitOfWork) nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  if (wipRoot) commitRoot()
}
```

```js
function commitRoot() {
  deletions.forEach(commitDeletion)
  commitFiber(wipRoot)
  currentRoot = wipRoot     // 双缓冲切换：旧 current 留作下次 alternate
  wipRoot = null
  deletions = []
}
```

```js
function commitFiber(fiber) {
  if (!fiber.effectTag && !fiber.subtreeDirty) return
  if (fiber.dom && fiber.alternate && fiber.type !== 'ROOT') updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  if (fiber.dom) placeHostChildren(fiber)
  for (let child = fiber.child; child; child = child.sibling) commitFiber(child)
}
```

`commitFiber` 只深入 dirty 子树：有 DOM 且被复用的节点先做 props/事件 diff，再确保直接宿主子节点按顺序落位；没有标记的分支直接跳过。不过 mini 没有 props 相等时的 bailout，reconcile 会给每个复用节点打 `UPDATE`，实际几乎整棵 WIP 都会进入 commit；dirty 检查主要是演示 flags 的形状，不是真正的性能优化。首次挂载没有 `currentRoot`，所有 Fiber 都是新建的；更新时 `beginWork` 会在 `alternate` 上找到旧 Fiber，复用它的 `dom` 和 Hook 链表。commit 处理完后切换 `currentRoot`，WIP 清空。真实 React 的 commit 分成 mutation / layout / passive 等子阶段，mini 没有 Effect，所以只有“插节点、改属性、删节点”三件事。

### 3.4 协调 / diff：同层、type + key、复用与移动

协调规则可以压缩成一张表：

| 新旧情况 | 结果 |
|---|---|
| 同父级、同 `type`、同 `key`（无 key 时看位置） | 复用 Fiber、DOM、Hook state，只更新 props |
| 同父级、同 `type`、`key` 不同 | 卸载旧的，挂载新的，state 重置 |
| 同父级、`type` 不同 | 整棵子树重建，state 重置 |
| 不同父级（哪怕 type/key 相同） | 不跨层移动，视为删除 + 新建 |
| 数组里 key 相同、type 相同 | 复用，位置可能移动 |
| 数组里 key 相同、type 不同 | 删旧建新 |

mini 的实现是：把旧 children 按“有 key 用 key、无 key 用旧 index”放进 Map；新 children 逐项查找，type 相同就复用旧 Fiber，并让新 Fiber 的 `dom` 指向旧 DOM、`alternate` 指向旧 Fiber；找不到或 type 不同就新建并标记 `PLACEMENT`；旧 Map 里剩下的全部进入 `deletions`。复用时如果旧 index 与新 index 不同，也标记 `PLACEMENT`，让这棵子树进入 commit 的 dirty 遍历。更新 props/事件由 `updateDom(dom, oldProps, newProps)` 完成；删除由 commit 的 `commitDeletion` 把 DOM 移除；插入和移动统一在 commit 里按新顺序 append，已存在的节点会被 `appendChild` 移动到末尾，从而完成重排。

真实 React 的列表 diff 更精细：先从左到右按位置匹配公共前缀，再用 Map 处理剩余 key，并用 `lastPlacedIndex` 判断是否需要移动，尽量减少 DOM 操作。mini 只要 index 变了就标记 `PLACEMENT`，commit 再按新顺序 append 整个子节点列表，结果正确，但可能多做几次 DOM 移动。另外，mini 只在同一父级下比较，跨父级移动一定卸载重建，这与真实 React 一致。

```js
function reconcileChildren(wip, raw) {
  const elements = normalizeChildren(raw)
  const oldMap = new Map(); let prev = null
  for (let old = wip.alternate?.child; old; old = old.sibling) oldMap.set(old.key == null ? `i:${old.index}` : `k:${old.key}`, old)
  elements.forEach((element, index) => {
    const lookup = isText(element) || element.key == null ? `i:${index}` : `k:${element.key}`
    const old = oldMap.get(lookup), reuse = old && old.type === typeOf(element)
    if (reuse) oldMap.delete(lookup)
    const fiber = reuse ? reuseFiber(old, element, wip, index) : newFiber(element, wip, index)
    if (prev) prev.sibling = fiber; else wip.child = fiber
    prev = fiber
  })
  for (const old of oldMap.values()) deletions.push(old)
}
```

`raw` 先经 3.1 的 `normalizeChildren` 归一化；字符串/数字保留原值，匹配时按位置和文本 Fiber（`type === null`）比较。`old.index` 来自上一轮协调，给没有 key 的节点提供位置身份。

```js
const newFiber = (node, wip, index) => ({ ...createFiber(node, wip), index, effectTag: 'PLACEMENT' })
const reuseFiber = (old, node, wip, index) => ({
  ...old, type: typeOf(node), props: propsOf(node), parent: wip, child: null, sibling: null,
  alternate: old, index, effectTag: old.index === index ? 'UPDATE' : 'PLACEMENT',
  subtreeDirty: false, memoizedState: old.memoizedState,
})
```

`reuseFiber` 用展开保留旧 Fiber 的 `dom`，但清空 `child` / `sibling`，因为这一轮会重新建立链表；`alternate` 指回旧 Fiber，commit 后它成为新的 current。`memoizedState` 直接指向旧 Hook 链表：mini 为了同步实现简单，复用同一批 Hook 对象；真实 React 会把 Hook 复制到 WIP 上，避免未提交的 render 污染 current。

```js
function collectHostChildren(fiber, out = []) {
  for (let child = fiber.child; child; child = child.sibling) {
    if (child.dom) out.push(child)
    else collectHostChildren(child, out)   // 函数组件 Fiber 没有 DOM，继续下沉
  }
  return out
}
```

```js
function placeHostChildren(hostFiber) {
  for (const kid of collectHostChildren(hostFiber)) {
    hostFiber.dom.appendChild(kid.dom)   // 已存在节点会被移动到末尾
  }
}
```

```js
function commitDeletion(fiber) {
  if (fiber.dom) { fiber.dom.remove(); return }   // 宿主节点：整棵 DOM 子树一起移除
  for (let child = fiber.child; child; child = child.sibling) commitDeletion(child)
}
```

按新顺序逐个 `appendChild` 是比 `insertBefore` 更简单的重排策略：同一个父节点上，append 一个已经存在的节点会把它移动到末尾；从左到右处理完所有直接宿主子节点，最终顺序就和新 Fiber 树一致。`collectHostChildren` 会穿过函数组件 Fiber，把它的宿主根节点当作当前父节点的直接子节点，所以 keyed 重排组件行时，被移动的 DOM 不会漏掉。代价是即使顺序没变也可能产生多余的 DOM 移动；真实 React 用 flags + `lastPlacedIndex` 只移动真正需要的节点。删除时如果节点本身有 DOM，移除它就会带走整棵 DOM 子树；函数组件 Fiber 没有 DOM，所以要递归到它的宿主子节点。mini 没有 cleanup。

**index key 为什么会错位？** 假设旧列表是 `[A(key=0), B(key=1)]`，在顶部插入 C 后变成 `[C(key=0), A(key=1), B(key=2)]`：

```text
key=0：旧 A 的 Fiber 被复用给 C → C 继承了 A 的 DOM、Hook state、焦点
key=1：旧 B 的 Fiber 被复用给 A → A 继承了 B 的状态
key=2：B 是新 key → 新挂载
```

React 只看到“key=0 还是同一个组件”，于是复用旧 DOM/state，只把 props 换成 C 的数据。输入框内容、展开状态、动画、焦点因此跟着位置走，而不是跟着数据走。只有列表完全静态、不会插入/删除/排序/筛选，且子项没有需要保留的交互 state 时，才可以考虑 index key；否则用数据库 id、创建数据时生成的 UUID 等稳定标识。不要用 `Math.random()` 生成 key，那等于每次 render 都卸载重建整棵子树。key 只需要在同一个兄弟列表内唯一，不需要全局唯一；同一层重复 key 会让 Map 匹配混乱；key 也不是 prop，子组件里读不到。另一个常见身份错误是在组件内部定义组件：每次 render 都会创建新的函数 `type`，diff 看到类型变化，整棵子树重新挂载。

### 3.5 Hooks：Fiber 上的 Hook 链表与更新队列

函数组件的 Fiber 用 `memoizedState` 保存 Hook 链表的头节点。真实 React 的 Hook 节点包含 `memoizedState`（当前值）、`queue`（更新队列）、`next`（下一个 Hook）等；mini 用一个简化对象 `{ state, queue, next }`。每次函数组件 render 都从 `hookIndex = 0` 开始，第 n 次 `useState` 调用读取 `memoizedState` 链表上的第 n 个 Hook；有旧 Hook 就直接复用同一个对象，处理并清空它的 update queue，没有就创建并接到链表尾部。练习脚手架用 `fiber.hooks[hookIndex]` 数组保存同样的顺序，二者在“调用顺序就是身份”上等价；本文用 `memoizedState.next` 更接近真实 React 的概念。`beginWork` 在组件函数返回后把 `wipFiber` 置回 `null`，所以事件处理函数里误调 Hook 会被下面的 guard 拦住。**Hook 的身份就是调用顺序，不是变量名。** 这也是 Hook 不能条件调用的根本原因：如果在某个分支少调用一个 Hook，后面所有 Hook 的序号都会前移，`age` 会读到 `name` 的 state，或者读到 `null` 后重置；真实 React 会给出 "Rendered fewer hooks than expected" 之类的错误，mini 没有检查，只会静默错位。Hook 也不能在组件外调用，因为此时没有 `wipFiber` 可供挂载。

state 保留规则在这里落地：同父级、同 `type`、同 `key` 的 Fiber 会被复用，`alternate` 指向旧 Fiber，旧 Hook 链表还在，所以 state 保留；type 变化、key 变化、跨父级移动都会新建 Fiber，旧 Hook 链表不可达，state 重置。模块级还需要 `let wipFiber = null, hookIndex = 0`；`beginWork` 进入函数组件时设置它们。卸载组件时，mini 只移除 DOM，不执行 Hook 的“清理”逻辑；真实 React 会处理 Effect cleanup 等。

```js
function getHook(fiber, index) {
  let hook = fiber?.memoizedState
  for (let i = 0; i < index && hook; i++) hook = hook.next
  return hook
}
```

```js
export function useState(initial) {
  if (!wipFiber) throw new Error('Hooks 只能在函数组件渲染期间调用')
  let hook = getHook(wipFiber, hookIndex)
  if (!hook) {
    hook = { state: typeof initial === 'function' ? initial() : initial, queue: [], next: null }
    if (hookIndex === 0) wipFiber.memoizedState = hook
    else getHook(wipFiber, hookIndex - 1).next = hook
  }
  for (const action of hook.queue) hook.state = typeof action === 'function' ? action(hook.state) : action
  hook.queue = []
  const setState = (action) => { hook.queue.push(action); scheduleUpdate() }
  hookIndex++
  return [hook.state, setState]
}
```

队列按顺序重放：直接值会替换 pending state，更新函数会接收上一步的 pending state。例如本轮的 `n` 是 0：

```jsx
setN(5)          // pending: 0 → 5（直接值替换）
setN((x) => x + 1) // pending: 5 → 6（函数读取上一步）
setN(42)         // pending: 6 → 42（再次替换）
// 下一次 render：n = 42
```

两个 `setN(n + 1)` 都读取本轮快照 0，结果都是替换为 1，最终是 1；两个 `setN((x) => x + 1)` 则依次得到 1、2。`setState` 不会修改当前 render 闭包里的 `state` 变量；它只是把 action 推进 Hook 的队列并请求调度。mini 的调度是同步的，所以这次调用返回时 DOM 可能已经更新；真实 React 通常异步/批处理，不能假设。无论哪种，下一次 render 才按队列算出新值。

真实 React 的 dispatch 函数引用稳定，更新队列还带 lane、eager state 计算和 bailout；mini 每次 render 都创建新的 `setState` 闭包，但闭包引用的是同一个共享 Hook 对象，所以同一事件里的多次 dispatch 能落到同一队列。mini 没有优先级和 eager bailout，组件卸载后的旧闭包也不会产生有效更新；真实 React 的 dispatch 会定位到 fiber 的更新队列。学习时知道这是边界即可。

### 3.6 调度与 re-render：setState 之后发生了什么

`setState` 只做两件事：把 action 放进对应 Hook 的队列，调用 `scheduleUpdate`。mini 的调度是**同步**的：`scheduleUpdate` 直接调用 `render(rootElement, rootContainer)`，从根重新执行 `workLoop`，最后 commit 并切换 current。因此点击处理函数返回时 DOM 已经更新；同一事件里连续两次 `setState` 会触发两次同步 render（不是批处理），但共享 Hook 队列保证 action 不会丢。因为从根开始，所有函数组件都会重新执行；没有 `memo`、没有 bailout，是否改 DOM 完全交给 diff。真实 React 会把同一事件的更新批处理、按 lane 调度，并可能异步、可中断地 render；commit 仍然同步且原子。

```js
function scheduleUpdate() {
  if (isRendering) throw new Error('不要在 render 期间 setState')
  if (!currentRoot) return
  render(rootElement, rootContainer)
}
```

这个实现故意把调度简化成同步：没有 Scheduler、没有 lane、没有时间切片，每次 `setState` 都从根跑完一轮。真实 React 的自动批处理覆盖事件、timeout、promise 等场景；离散交互（click/input）有更高优先级，transition 可以被输入打断，render 可以被暂停/丢弃，commit 仍然同步且原子。mini 没有这些，但足以说明“setState 只是请求更新”：不要依赖它在真实 React 中同步改 DOM；mini 的测试可以立即断言，是因为它刻意同步 flush。`isRendering` 的 guard 也让“render 期间 setState”直接报错，避免无限循环；练习脚手架则可能记一个 pending 标志、等本轮 render 结束后再跑，目的相同。

**为什么 render 必须纯？** 因为 render 可能执行多次、被中断、被丢弃；即便 mini 目前每次更新同步跑一次，真实 React 的并发、StrictMode 和 Suspense 重试都会让组件函数重复执行。在 render 里发请求、写 ref、改全局变量、调用 `setState`，轻则重复执行，重则死循环；mini 的 `isRendering` guard 会把 render 中的 setState 直接变成异常。render 只应根据 props/state/context 计算元素；副作用放事件处理函数或 Effect（mini 没有 Effect，这也是它的边界）。

### 3.7 实现边界：mini-react 只用于理解

mini-react 的目标是让你能白板讲清“JSX → 元素 → Fiber → DOM → Hook → 更新”这条链路，不是替代 React。下面这些能力刻意没有实现：

| 范围 | mini-react | 真实 React 19 |
|---|---|---|
| 并发与调度 | 同步 `workLoop`；每次 setState 同步从根 render，无批处理 | Scheduler + lanes；批处理、可中断、按优先级、transition |
| Suspense / `use` / Activity | 无 | 完整异步与隐藏子树模型 |
| Context / Portal / SSR / hydration | 无 | 完整支持 |
| Error Boundary | 无 | 错误边界、错误捕获 |
| 事件系统 | 每节点原生监听；简单转小写 | 根委托、合成事件、捕获/冒泡、优先级、`onChange` 归一化 |
| Effect / ref / cleanup | 无 | `useEffect`、`useLayoutEffect`、ref 绑定与清理 |
| 组件能力 | 函数组件、宿主标签、文本 | Fragment、memo、lazy、forwardRef、Server Components 等 |
| Hooks | 仅 `useState`；不检查调用规则 | 全套 Hooks、规则检查、lane 队列、eager bailout |
| 协调 | key/index Map；index 变化即移动；无 bailout | 两遍扫描、Map、`lastPlacedIndex`、flags、bailout |
| DOM 细节 | 属性名映射、setAttribute、value/checked、简单 style | 属性/属性名、命名空间、SVG、受控输入、受控样式等 |
| 根 | 模块级全局变量，单 root（练习脚手架用 WeakMap 支持多容器） | `createRoot` 支持多个 root、卸载、并发特性 |
| commit | 遍历 WIP，更新 props、按新顺序 append 子节点 | mutation/layout/passive 子阶段、flags、effect list |
| 性能 | 每次从根 render，无 memo/Compiler | memo、Compiler、lane 跳过、时间切片 |

所以：**不要用 mini-react 的性能特征推断 React**。mini 每次更新都重新执行所有组件，commit 还会重新 append 宿主子节点，只是为了把协调讲清楚，并可能带来多余的 DOM 移动、焦点/选区变化；真实 React 的大量工程复杂度都在这些“没有实现”的格子里。学习顺序应该是先用 mini 建立因果链，再回到 React 文档看它在每个格子里补了什么。

### 3.8 测试方式：jsdom + 直接 DOM 断言

mini-react 不依赖 ReactDOM，所以不能用 `@testing-library/react` 的 `render`（它内部会调用 ReactDOM）。可以在 Vitest 的 `jsdom` 环境里直接创建容器、断言 DOM，也可以把容器挂到 `document.body` 后用 `@testing-library/dom` 的 `getByRole` / `waitFor` 做查询。测试的目标不是覆盖率，而是验证“元素 → Fiber → DOM → 点击 → 队列 → 重新 render → 复用/更新”这条链路。下面的测试假设已经 `import { createElement, render, useState } from './mini-react/index.js'`，并把 `Row` / `List` 放在测试模块顶层。

```js
test('counter: createElement → render → click → setState → update', () => {
  const root = document.createElement('div')
  function Counter() {
    const [n, setN] = useState(0)
    return createElement('button', { onClick: () => setN((x) => x + 1) }, String(n))
  }
  render(createElement(Counter), root)
  const btn = root.querySelector('button')
  expect(btn.textContent).toBe('0')
  btn.click()                              // mini 同步 flush，点击返回时已更新
  expect(btn.textContent).toBe('1')
  expect(root.querySelector('button')).toBe(btn) // DOM 被复用，不是重建
})
```

```js
function Row({ item }) {
  const [n, setN] = useState(0)
  return createElement('li', { key: item.id, 'data-id': item.id, onClick: () => setN((x) => x + 1) }, `${item.text}:${n}`)
}
const List = ({ items }) => createElement('ul', null, ...items.map((item) => createElement(Row, { key: item.id, item })))
```

```js
test('keyed list: reorder keeps DOM and state by id', () => {
  const root = document.createElement('div')
  const A = { id: 'a', text: 'A' }, B = { id: 'b', text: 'B' }
  render(createElement(List, { items: [A, B] }), root)
  root.querySelector('[data-id="a"]').click()
  const a = root.querySelector('[data-id="a"]')
  render(createElement(List, { items: [B, A] }), root)
  expect(root.querySelector('[data-id="a"]')).toBe(a)
  expect(a.textContent).toBe('A:1')
})
```

测试要点：

- **断言最终 DOM 和节点身份**，不要断言 render 调用次数或精确耗时；真实 React 的 StrictMode、并发、Suspense 会改变次数。mini 没有这些，但习惯应该一致。
- mini 是同步实现，所以 `button.click()` 返回后可以直接断言；真实 React 的更新通常是异步/批处理的，Testing Library 里要用 `await waitFor(...)` 或 `findBy*`，不要用固定 `setTimeout`。
- 用 `toBe` 比较 DOM 节点引用，可以验证 diff 是否复用；用 `toHaveTextContent` / `querySelector` 验证内容。
- 再补一个“事件处理器替换”测试：第二次 render 传入新的 handler，点击后旧 handler 不应被调用；这能暴露 `updateDom` 忘记解绑旧监听器的问题。
- 再补一个 index key 对照测试：用 `key={index}` 重排后 state 跟着位置走，用稳定 id 时 state 跟着数据走。mini 没有“卸载时清理 Effect”的测试面，因为 Effect 本身没有实现；真实 React 里卸载/依赖变化的 cleanup 必须单独测。
- mini 没有 `unmount` API，模块还持有 `currentRoot`；测试之间用新的容器（并移除旧容器）或 `vi.resetModules()` 重新导入，避免上一个 root 的全局状态干扰。真实项目中用 `cleanup` 和 `root.unmount()`。
- 如果使用 `@testing-library/dom`，查询前要把容器 `document.body.append(container)`；`getByRole` 默认会忽略不可见元素，这一点与 React Testing Library 相同。

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| 把 JSX 当 HTML 字符串，用 `innerHTML` 拼 | 让 JSX 编译成 `createElement` / `jsx` 调用 | JSX 是构建期语法糖；`className`、事件、表达式、转义规则都与 HTML 不同 |
| 认为 `createElement` 会执行组件函数 | 只记录 `type`，在 `beginWork` 中调用 | 元素是描述；提前调用会绕过 Fiber、Hook 和 diff |
| 每次 render 都重新创建 Fiber/DOM | 用 `alternate` 复用旧 Fiber、DOM 和 Hook | 元素树可以重建，Fiber 必须跨 render 持久化，否则 state/焦点全丢 |
| 直接修改 state（`arr.push`、`obj.x = 1`、`n++`） | 复制并替换，或使用更新函数 | state 是快照，应当只读；同引用可能被跳过，也会污染旧快照 |
| 列表用 `key={index}` | 用稳定 id | 插入/删除/排序后 key 与数据错位，DOM/state 跟着位置走 |
| 用 `key={Math.random()}` 或每次 render 新 key | 创建数据时生成一次并持久化 | 每次都是新身份，整棵子树卸载重建 |
| `setState` 后立刻读 DOM 或当前 state | 代码只依赖下一次 render 的 state；真实 React 测试用 `waitFor` | setState 只是请求更新；mini 为了教学同步 flush，真实 React 有批处理/lane，不保证同步 DOM |
| 在条件、循环或提前 `return` 前后调用 Hook | 所有 Hook 固定在组件顶层、顺序不变 | Hook 按调用顺序匹配；顺序变化会让后续 Hook 读到错误状态 |
| 在组件外调用 Hook | 只在函数组件或自定义 Hook 的 render 中调用 | 没有当前 Fiber，无法挂载 Hook；React 会抛 invalid hook call |
| 在 render/`beginWork` 里直接 `appendChild` 到文档 | 只创建 detached DOM，commit 再插入 | render 可能重做/丢弃；屏幕只能由 commit 原子更新 |
| 更新时只加新监听器，不移除旧监听器 | 在 `updateDom` 里先移除变化/删除的监听器；真实项目在 Effect cleanup 中清理 | 旧闭包继续触发，造成重复请求、状态错乱或内存泄漏 |
| 类型变了还期望复用 DOM/state | 同层同 `type` + `key` 才复用 | 类型是身份的一部分；不同组件无法安全迁移 state |
| 在子组件里读 `props.key` | 另外传 `id` 或业务字段 | key 是 React 保留属性，会被提取，不出现在 props 中 |
| 认为每个 setState 都会在真实 React 中立即单独 render | 同一事件/同一 tick 会批处理；mini 则每个 setState 同步 render | 不要依赖 render 次数；React 自动批处理，mini 只是教学简化 |
| 在 render 中 setState、发请求或改全局 | 把副作用放到事件处理函数或 Effect | render 可能重复执行；mini 的 guard 会抛错，真实 React 可能形成无限循环 |
| 用父节点 `textContent = ...` 更新文本 | 让文本成为独立 Fiber，更新 `nodeValue` | 直接改 `textContent` 会清空并重建所有子 DOM，丢失状态/焦点 |
| 把组件函数当普通函数直接调用（`{Counter()}`） | 用 `<Counter />` / `createElement(Counter)` | 绕过 Fiber、Hook 和 diff，Hook 上下文不存在 |
| 认为改 Fiber 就等于改屏幕 | Fiber 是工作台，commit 才写 DOM | render 在 WIP 上算，current 才对应屏幕 |

## 5. 三句话自测

1. **`createElement` 返回什么？组件函数和宿主标签在 `type` 上如何区分？** 返回 `{ type, key, props }` 形式的不可变元素对象；字符串 `type` 是宿主标签，函数 `type` 是组件，`createElement` 只记录函数，render 的 `beginWork` 才执行它，所以 JSX 不是 HTML。
2. **Fiber 工作循环如何用 `child` / `sibling` / `return` 遍历？双缓冲解决什么？** 向下 `beginWork`、向上 `completeWork`，显式链表把渲染拆成可暂停/恢复/丢弃的工作单元；current 是屏幕上的树，workInProgress 是草稿，commit 写 DOM 后交换，旧 current 留作下一次 alternate。
3. **`useState` 如何找到旧 state？为什么不能条件调用 Hook？** 第 n 次 Hook 调用读取 `memoizedState` 链表上的第 n 个节点（复用 Fiber 时它来自旧树）并重放、清空它的更新队列；条件调用会改变调用顺序，使后续 Hook 读到错误的状态，所以 Hook 必须固定在组件顶层。

## 6. 官方阅读

- https://react.dev/learn/writing-markup-with-jsx
- https://react.dev/reference/react/createElement
- https://react.dev/reference/react/useState

> 官方根渲染 API 是 `createRoot(container).render(element)`；本文的 `render(element, container)` 是 mini-react 的简化入口，不是 ReactDOM 的公开 API。
