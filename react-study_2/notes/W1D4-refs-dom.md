# W1D4：Ref 与 DOM

## 一句话结论
state 用于会影响屏幕的值，ref 用于跨 render 保存但不参与渲染的值或获取 DOM 节点；只有在事件处理函数或 Effect 中读写 `ref.current`，不要在 render 中读写它。

## 心智模型

```text
state:   setState → 请求 render → UI 可能改变
ref:     ref.current = value → 不触发 render → UI 不会自动改变

<input ref={inputRef} />
       ↓ commit 后
inputRef.current = 实际 HTMLInputElement
       ↓ 事件处理函数 / Effect
inputRef.current.focus()
```

ref 是 escape hatch。先试 props/state 的声明式方式；确实需要命令式操作（聚焦、滚动、选择文本、第三方 widget、保存 timer ID）时才用 ref。

## 1. useRef 保存不参与渲染的值

```tsx
function Chat() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function send() {
    timeoutRef.current = setTimeout(() => alert('已发送'), 3000)
  }
  function undo() {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
  }
}
```

`useRef(initialValue)` 每个组件实例只创建一个 `{ current }` 对象，后续 render 忽略 initialValue。改 `current` 不会 render，所以若值要显示在 UI 上，应使用 state。

不要在 render 期间读写 `ref.current`。渲染可能被重复、暂停或丢弃，读写 ref 会让输出不可预测。唯一常见例外是惰性初始化：只有当 `current === null` 时赋予一个确定的新值。

## 2. 操作 React 管理的 DOM

```tsx
function Search() {
  const inputRef = useRef<HTMLInputElement>(null)
  return <>
    <input ref={inputRef} aria-label="搜索" />
    <button onClick={() => inputRef.current?.focus()}>聚焦搜索框</button>
  </>
}
```

React 在 commit 时设置 `current`；节点移除时设回 `null`。可以聚焦、滚动和测量，但不要修改 React 同时管理的内容、属性或结构，例如 `inputRef.current.innerHTML = ...`。

## 3. React 19：ref 是普通 prop

React 19 中，函数组件直接从 props 接收 `ref`，不再需要 `forwardRef`：

```tsx
type SearchInputProps = { label: string; ref?: React.Ref<HTMLInputElement> }
function SearchInput({ label, ref }: SearchInputProps) {
  return <label>{label}<input ref={ref} /></label>
}

function Page() {
  const ref = useRef<HTMLInputElement>(null)
  return <SearchInput label="关键词" ref={ref} />
}
```

`forwardRef` 仍能运行，但 React 官方已标为 deprecated，未来会移除。组件库应只暴露需要的命令式能力；需要限制能力时用 `useImperativeHandle`（只暴露 `focus()`，而非整个 DOM 节点）。

## 4. 回调 ref 与清理

动态列表不能在 `map` 中调用 `useRef`。可用一个 ref 保存 Map，并以 callback ref 登记每个节点：

```tsx
const itemRefs = useRef(new Map<string, HTMLLIElement>())
<li ref={(node) => {
  itemRefs.current.set(item.id, node)
  return () => itemRefs.current.delete(item.id) // React 19 cleanup
}} />
``` 

React 19 会在节点移除时调用 callback 返回的 cleanup。若 callback 不返回 cleanup，兼容期内 React 会以 `null` 调用它；不要依赖该旧行为。回调函数体用花括号，避免意外返回 DOM 节点：

```tsx
// ✗ ref={node => nodes.set(id, node)}  // Map.set 的返回值不是 cleanup
// ✓ ref={node => { nodes.set(id, node) }}
```

## 5. 受控与非受控 input

```tsx
// 受控：React state 是唯一真相来源，适合实时校验、联动、提交前处理
const [email, setEmail] = useState('')
<input value={email} onChange={e => setEmail(e.target.value)} />

// 非受控：DOM 保存当前值，defaultValue 只设置初始值
<input defaultValue="hello" ref={inputRef} />
```

传 `value` 或 `checked` 就是受控 input，必须同步提供会更新该值的 `onChange`。同一个 input 的生命周期里不要在受控与非受控间切换。不要把 `value={undefined}` 传给受控 input；空值使用 `''`。

## 常见误区

| 误区 | 正确做法 |
|---|---|
| 用 ref 保存 count 并期望页面更新 | 影响 UI 的值用 state |
| render 中 `ref.current++` 或读 DOM | 在事件处理函数或 Effect 中操作 |
| `map` 中每项 `useRef()` | callback ref + 一个 `Map` ref |
| React 19 新组件仍包装 `forwardRef` | 直接从 props 解构 `ref` |
| `value={text}` 没有 `onChange` | 添加 `onChange` 更新 state，或用 `defaultValue` 变为非受控 |

## 三句话自测
1. ref 改变不会触发 render，适合保存不影响 UI 的可变值和 DOM 节点；显示在 UI 的数据用 state。
2. React commit 后才赋值 DOM ref，因此在事件或 Effect 中操作它，不能在 render 中读写它。
3. React 19 的函数组件直接接收 ref prop；动态节点使用 callback ref 的 cleanup 管理 Map。

## 官方阅读
- https://react.dev/reference/react/useRef
- https://react.dev/learn/manipulating-the-dom-with-refs
- https://react.dev/learn/referencing-values-with-refs
- https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop
- https://react.dev/reference/react-dom/components/input
