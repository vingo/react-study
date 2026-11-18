# W3D5 课前测验：手写 mini-react

先独立作答，不查资料、不运行代码；把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W3D5.md`，做完前不要打开。

本卷共 9 分：复习 1、复习 2 各 0.5 分；第 1 题 2.5 分；第 2 题 2.5 分；第 3 题 3 分。

说明：题目基于课堂 mini-react 的简化语义——元素是普通对象；render 在 Fiber 工作循环中创建节点、准备变更；commit 同步提交、执行插入/属性更新并切换 `currentRoot`；没有 lane、优先级、可中断渲染、Suspense 等真实 React 的并发/调度机制。不同 mini-react 写法可能在细节上不同（Hook 用数组还是链表、commit 用 `appendChild` 还是 `insertBefore`），答题时以题面代码为准；真实 React 的对应行为以 React 19.3 为准，并会单独说明。

## 复习 1：state 更新队列（0.5 分｜来自 W1D2 第 1 题）

初始 `n = 0`，点击一次按钮：

```tsx
function handleClick() {
  setN(n + 1)
  setN(x => x + 1)
  setN(n + 1)
  setN(x => x * 2)
}
```

1. 写出每次调用后的 pending state。
2. 最终显示多少？
3. 为什么第三个调用没有在第二个调用的结果上继续加一？

**你的答案：**

## 复习 2：key 与 state 重置（0.5 分｜来自 W1D5 第 2 题）

```tsx
function Messenger({ recipient }: { recipient: Contact }) {
  return <Chat recipient={recipient} />
}
```

`Chat` 内部有草稿 `useState`，还有一个输入框。

从 Ada 切换到 Grace 时，草稿为什么会保留？如何让每位收件人在切换后拿到空白草稿（不继承上一位的草稿）？为什么不建议写成 `key={Math.random()}`？

**你的答案：**

## 第 1 题：createElement、工作循环与双缓冲（2.5 分）

```js
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === 'object' ? child : createTextElement(child)
      ),
    },
  }
}

function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: { nodeValue: text, children: [] },
  }
}
```

### A. 元素形状（1 分）

```jsx
function App() {
  const [count] = useState(0)
  return (
    <div id="app">
      <h1>Hello</h1>
      <p>{count}</p>
    </div>
  )
}
```

1. 这段 JSX 编译后会调用什么？（说出经典 runtime 和自动 runtime 各一种形式即可。）
2. 按上面的 `createElement`，写出 `App()` 返回的 `div` 元素对象的简化形状（保留 `type`、`props.id`、`children`；文本用 `TEXT_ELEMENT` 表示）。
3. `App` 这个组件函数本身会出现在元素的哪个字段里？元素对象是 DOM 节点或 Fiber 吗？
4. 真实 React 元素通常还带 `key`、`ref`、`$$typeof` 等字段；它们与 `props` 是什么关系？mini 版为什么可以省略？

**你的答案：**

### B. 工作循环与双缓冲（1.5 分）

```js
function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)

  if (fiber.child) return fiber.child

  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling
    nextFiber = nextFiber.parent
  }
  return null
}

let wipRoot = null
let currentRoot = null

function render(element, container) {
  wipRoot = {
    dom: container,
    props: { children: [element] },
    alternate: currentRoot,
  }
  nextUnitOfWork = wipRoot
}

function commitRoot() {
  commitWork(wipRoot.child) // 把新 DOM 插入/更新到父节点
  currentRoot = wipRoot
  wipRoot = null
}
```

假设 `commitWork` 只在 commit 阶段把 DOM 变更（插入/属性更新）提交到父节点/`container`；render 阶段只创建节点，不修改页面上的 DOM。考虑 `<div><h1>A</h1><p>B</p></div>`（文本也是 `TEXT_ELEMENT` fiber）：

1. 从 `wipRoot` 开始，按 `performUnitOfWork` 的返回顺序写出访问的 fiber，直到返回 `null`。
2. 每个 fiber 的 `dom` 在什么时候创建？首次 commit 之前，这些 DOM 是否已经出现在页面上？如果工作循环中途停下，为什么用户看不到半成品？
3. commit 后 `currentRoot` 和 `wipRoot` 分别是什么？下一次更新时，新的 `wipRoot.alternate` 指向谁？子树里的 `alternate` 又对应什么？
4. 这个简化工作循环与真实 React 的并发渲染至少有一处关键区别，请指出。

**你的答案：**

## 第 2 题：keyed diff 找 bug（2.5 分）

下面的 keyed 协调假设旧 fiber 上有 `key` 和 `index`（旧的兄弟位置）；commit 对带 `PLACEMENT` 的节点执行 `parentDom.appendChild(dom)`，其他复用节点只更新 props。

```js
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null
  let lastPlacedIndex = 0

  const oldByKey = new Map()
  while (oldFiber) {
    oldByKey.set(oldFiber.key, oldFiber)
    oldFiber = oldFiber.sibling
  }

  while (index < elements.length) {
    const element = elements[index]
    const old = oldByKey.get(element.key)
    let newFiber

    if (old && old.type === element.type) {
      newFiber = {
        type: element.type,
        key: element.key,
        index,
        props: element.props,
        dom: old.dom,
        parent: wipFiber,
        alternate: old,
        effectTag: 'UPDATE',
      }
      oldByKey.delete(element.key)

      if (old.index < lastPlacedIndex) {
        newFiber.effectTag = 'PLACEMENT'
      } else {
        lastPlacedIndex = index
      }
    } else {
      newFiber = {
        type: element.type,
        key: element.key,
        index,
        props: element.props,
        parent: wipFiber,
        effectTag: 'PLACEMENT',
      }
    }

    if (index === 0) wipFiber.child = newFiber
    else prevSibling.sibling = newFiber

    prevSibling = newFiber
    index++
  }

  for (const old of oldByKey.values()) {
    old.effectTag = 'DELETION'
    deletions.push(old)
  }
}
```

### A. 找 bug（0.75 分）

同事反馈：列表从 `[A, B, C]` 重排为 `[C, A, B]` 后，每一行的 props 都更新了，输入框内容也没有串行，但屏幕上的行顺序看起来没有跟着新数据变化。

1. 指出上面代码中导致“没有发生移动”的那处错误（写出具体表达式及正确写法）。
2. `lastPlacedIndex` 应该记录什么？为什么它必须与“旧位置”比较？

**你的答案：**

### B. 预测行为（1 分）

每一行是 `<Row key={id}>`，`Row` 内有一个受控输入框和本地 `useState`。旧列表是 `[A, B, C]`，用户在 A 的输入框里输入了 `hello`，然后数据重排为 `[C, A, B]`。

1. 使用题面代码（有 bug）后，DOM 中三个 `<li>` 的顺序是什么？`hello` 出现在哪一行？A 的 Fiber、DOM 和 state 是否被复用？
2. 只修复 A 中的那一行后，DOM 顺序和 `hello` 的位置分别是什么？请结合 `PLACEMENT` 与 commit 的 `appendChild` 说明 DOM 是如何被移动到正确顺序的。
3. 如果重排后输入框内容没有串行、只是行顺序没变，这属于 state 错位还是提交顺序错误？为什么输入框内容没有串到别的行？

**你的答案：**

### C. index key 与 key 变化（0.75 分）

1. 如果 `Row` 改用 `key={index}`，从 `[A, B, C]` 顶部插入 X 得到 `[X, A, B, C]`，A 的 `hello` 会出现在哪一行？哪些行会新建/复用？
2. React 判断“能否复用旧 Fiber”看哪几个条件？key 变化时，旧 Fiber、DOM 和 state 分别发生什么？
3. key 需要全局唯一吗？为什么？

**你的答案：**

## 第 3 题：useState 的 Hook 链表、更新队列与纯度（3 分）

下面是一个 mini-react 的 Hook 简化实现。`renderFunctionComponent` 在每次渲染函数组件时调用；`getHook` 沿 `wipFiber.alternate` 的 Hook 链表按索引取旧 Hook；`scheduleUpdate` 会安排一次新的 render。

```js
let wipFiber = null
let hookIndex = 0

function renderFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  fiber.hooks = null

  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function getHook(fiber, index) {
  let hook = fiber && fiber.alternate && fiber.alternate.hooks
  for (let i = 0; hook && i < index; i++) {
    hook = hook.next
  }
  return hook || null
}

function useState(initial) {
  const oldHook = getHook(wipFiber, hookIndex)
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
    next: null,
  }

  const actions = oldHook ? oldHook.queue : []
  for (const action of actions) {
    hook.state = typeof action === 'function' ? action(hook.state) : action
  }

  const setState = action => {
    hook.queue.push(action)
    scheduleUpdate()
  }

  if (!wipFiber.hooks) wipFiber.hooks = hook
  else {
    let tail = wipFiber.hooks
    while (tail.next) tail = tail.next
    tail.next = hook
  }

  hookIndex++
  return [hook.state, setState]
}
```

### A. Hook 顺序（1 分）

```jsx
function Counter() {
  const [count, setCount] = useState(0)

  if (count > 0) {
    const [flag] = useState('flag')
  }

  const [step, setStep] = useState(10)

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>count+1</button>
      <button onClick={() => setStep(s => s + 1)}>step+1</button>
      <p>{count} / {step}</p>
    </div>
  )
}
```

初始渲染后，先把 `step` 从 10 加到 11（触发一次渲染），再点一次 `count+1`（再触发一次渲染）。

1. 首次渲染时，Hook 链表里依次有哪些 Hook？点完 `step+1` 的那次渲染后，Hook 链表又是什么？点完 `count+1` 的那次渲染中，`getHook(fiber, 1)` 取到的是哪个旧 Hook？它的 state 是多少？
2. 点完 `count+1` 后，`step` 显示多少？`flag` 的值实际是多少？为什么？
3. 真实 React 在这里会怎样？为什么 Hook 必须写在组件顶层，不能放在条件、循环或嵌套函数里？

**你的答案：**

### B. 更新队列与重渲染（1 分）

假设这个简化实现的 `scheduleUpdate` 只在当前没有进行中的工作时安排一轮工作循环，同一事件处理函数中的多次 `setState` 会在事件结束后一起处理。

```jsx
function Counter() {
  const [n, setN] = useState(0)
  const [step, setStep] = useState(1)

  function handleClick() {
    setN(n + 1)
    setN(x => x + 1)
    setStep(step + 10)
    setN(x => x * 2)
  }

  console.log('render', n, step)

  return <button onClick={handleClick}>{n} / {step}</button>
}
```

1. 点击一次按钮后，两个 Hook 的更新队列分别按什么顺序处理？写出每个 action 处理后的 pending state，最终显示什么？
2. 这次点击会让组件函数执行几次？控制台会打印哪些 `render` 日志？为什么不是每个 `setState` 都立即重渲染一次？
3. 如果把最后一个调用改成 `setN(n * 2)`，最终显示多少？为什么？

**你的答案：**

### C. 纯度（1 分）

```jsx
function List({ items }) {
  const [count, setCount] = useState(0)

  items.reverse()
  setCount(count + 1)

  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  )
}
```

1. 找出这段 render 中至少两处违反纯度的地方，分别说明它们会导致什么后果。
2. 在 mini-react 中没有 StrictMode、没有并发中断，是否就可以在 render 中做这些事？为什么？
3. 分别给出修复方式（不需要完整组件，写出关键行即可）。

**你的答案：**
