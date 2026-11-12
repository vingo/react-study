# W1D1 渲染模型

## 1. 一句话结论
组件是一个纯函数：给定相同的 props、state 和 context，返回相同的 JSX；React 先调用它算出"想要的 UI"（render），再只把有差异的部分写进 DOM（commit）。

## 2. 心智模型

```
触发 (trigger)          渲染 (render)                 提交 (commit)            绘制 (paint)
─────────────          ──────────────                ──────────────           ─────────────
createRoot().render  →  调用组件函数，得到 JSX 树  →   对比新旧树，只修改    →   浏览器把 DOM
或 setState             （纯计算，不碰 DOM）            有差异的 DOM 节点         画到屏幕上
                        可能被调用多次、可能被丢弃       只执行一次，不可中断
```

把 React 想成餐厅：触发是顾客下单，render 是厨师做菜（可以重做，顾客看不到），commit 是把菜端上桌（端上去就是定局）。

关键推论：**render 可能被执行多次、被打断、甚至结果被丢弃**（StrictMode、并发渲染、Suspense 都会这样做）。所以 render 里不能有"做一次和做两次结果不同"的操作。

## 3. 要点

### 3.1 什么会触发渲染
只有两种：首次挂载，以及组件自身（或祖先）的 state 变化。父组件重新渲染时，默认会递归渲染它的所有子组件，不管子组件的 props 有没有变（用了 `memo` 或 React Compiler 时可以跳过，W3D3 详讲）。

```tsx
function Parent() {
  const [n, setN] = useState(0)
  // 点击后 Parent 重新渲染，Child 也会被重新调用，即使它没有 props
  return <><button onClick={() => setN(n + 1)}>{n}</button><Child /></>
}
```

"重新渲染"只代表函数被重新调用，不代表 DOM 被改。DOM 是否改动由 commit 阶段的对比决定。

### 3.2 纯函数的边界
render 期间**不能修改已存在的东西**（模块变量、props、外部对象、DOM）；**可以修改本次渲染新建的局部变量**。

```tsx
let count = 0
function Bad() { count++; return <p>{count}</p> }        // ✗ 修改了模块变量

function Good({ items }: { items: string[] }) {
  const sorted = [...items].sort()                      // ✓ 先复制，再修改局部变量
  return <ul>{sorted.map(i => <li key={i}>{i}</li>)}</ul>
}
```

副作用（请求、订阅、改 DOM）应放在事件处理函数里；实在要和渲染同步时才放进 useEffect（W1D3 详讲）。

### 3.3 StrictMode 为什么渲染两次
开发环境下，`<StrictMode>` 会把以下函数**每次渲染都调用两次**：组件函数体；传给 `useState`、`useMemo`、`useReducer` 的函数（初始化函数、计算函数、reducer）；`setState` 的更新函数。挂载后还会额外执行一轮 Effect 的 cleanup → setup，ref 回调也会额外解绑再绑定一次。

目的：纯组件调用两次结果一样，不纯的组件会暴露出差异。生产环境不会重复调用。React 19 中，第二次渲染会复用第一次 useMemo/useCallback 的结果。

### 3.4 commit 只改有差异的地方，组件类型决定"是否复用"
React 按**位置 + 类型**（以及 key，W1D5 详讲）对比新旧树：同一位置、同一类型 → 复用 DOM 和 state，只更新属性；类型不同 → 卸载旧的（state 丢失），挂载新的。

```tsx
function Form() {
  const [dark, setDark] = useState(false)
  const Field = () => <input />          // ✗ 每次渲染都创建一个"新类型"
  return <div className={dark ? 'dark' : ''}><Field /><button onClick={() => setDark(!dark)}>切换</button></div>
}
// 点"切换"后，Field 是新函数 → 类型不同 → input 被卸载重建，已输入的文字丢失
```

修正：把组件定义放在模块顶层。

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| render 中 `props.list.sort()` | `[...props.list].sort()` 或 `toSorted()` | sort 原地修改，改的是父组件的数据 |
| 模块级 `let id = 0`，render 中 `id++` | 序号用 props 传入；只需要唯一 ID（如 label 的 `htmlFor`）时用 `useId()` | render 可能执行多次，结果不确定 |
| render 中调用 `new Date()`、`Math.random()` | 作为 props 或 state 传入，在事件或 Effect 中更新 | 每次调用结果不同，组件不再是纯函数 |
| 在组件内部定义另一个组件 | 定义在模块顶层，通过 props 传数据 | 每次渲染都是新类型，导致子树重建、state 丢失 |
| 认为"重新渲染 = DOM 被重写" | 重新渲染只是重新调用函数 | commit 只修改有差异的 DOM 节点 |
| 为了"只渲染一次"去掉 StrictMode | 修复不纯的代码 | 双重调用暴露的 bug 在并发渲染下真实存在 |

## 5. 三句话自测
1. 渲染只是调用组件函数算出 JSX，commit 才真正修改 DOM，且只修改有差异的节点。
2. 组件在 render 中只能修改本次新建的局部变量，不能修改 props、模块变量或外部对象。
3. 同一位置、同一组件类型才会复用 state；在组件内部定义组件会导致每次渲染都重建子树。

## 6. 延伸阅读
- https://react.dev/learn/render-and-commit
- https://react.dev/learn/keeping-components-pure
- https://react.dev/reference/react/StrictMode
