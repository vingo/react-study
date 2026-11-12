# W1D4 课前测验：Ref 与 DOM

先独立作答。将答案写在题目下的「你的答案」处，答案在 `notes/.answers/W1D4.md`，暂时不要打开。

## 复习 1：Effect 生命周期
未开启 StrictMode。`roomId` 从 `"general"` 变为 `"react"`，随后组件卸载。写出日志顺序：

```tsx
useEffect(() => {
  console.log('connect', roomId)
  return () => console.log('disconnect', roomId)
}, [roomId])
```

**你的答案：**
connect general -》disconnect general -》 connect react


## 复习 2：Effect 的边界
以下操作各应放在 **render**、**事件处理函数** 或 **Effect**？

1. 由 `items` 算出 `totalPrice`。
2. 用户点击“购买”后发 POST 请求。
3. 根据 `roomId` 连/断 WebSocket。

**你的答案：**
1: render
2: 事件处理函数
3: userEffectEvent


## 第 1 题：state 还是 ref
下面两个值分别应使用 state 还是 ref？说明是否应该触发重新渲染。

1. 显示在秒表界面上的已过秒数。
2. `setInterval` 返回的 timer ID，只在点击停止时使用。

**你的答案：**
1: state
2: ref



## 第 2 题：预测行为
点击按钮后，页面上的数字会变成什么？为什么？如何修复？

```tsx
function Counter() {
  const countRef = useRef(0)
  return <>
    <p>数量：{countRef.current}</p>
    <button onClick={() => { countRef.current += 1 }}>加一</button>
  </>
}
```

**你的答案：**
数量：0


## 第 3 题：React 19 ref
把 `SearchInput` 写成 React 19 的函数组件，使父组件传入的 ref 最终指向原生 `<input>`。不要使用 `forwardRef`。

```tsx
function SearchInput(/* 补全 props */) {
  return <label>搜索 <input /* 补全 */ /></label>
}

function Page() {
  const inputRef = useRef<HTMLInputElement>(null)
  return <SearchInput ref={inputRef} />
}
```

**你的答案：**

function SearchInput({ ref }) {
  return <label>搜索 <input ref={ref} /></label>
}