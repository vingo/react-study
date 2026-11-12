# W1D3：Effect 只用于同步外部系统

## 一句话结论
`useEffect` 在 React 把 UI 提交到 DOM 后运行，用于使组件与 React 外部的系统保持同步；如果逻辑只是计算 UI 或由用户操作触发，通常不需要 Effect。

## 心智模型

```text
props/state → render（纯计算 JSX） → commit（更新 DOM） → Effect setup（同步外部系统）
                                                     ↑ 依赖变化或卸载时，先 cleanup
```

外部系统指 React 不控制的东西：浏览器 API（`document`、`window`、`localStorage`）、`setInterval`、WebSocket、第三方地图/图表，以及服务端连接。Effect 不是“组件挂载时要做的代码”的同义词。

## 三种代码该放哪里

| 问题 | 放置位置 | 例子 |
|---|---|---|
| 由现有 props/state 得到 UI 值？ | render | `const total = items.reduce(...)` |
| 由用户的具体动作触发？ | 事件处理函数 | 点击购买后 `post('/buy')` |
| 需要使 UI 与外部系统一致？ | Effect | 订阅 WebSocket、同步 `document.title` |

```tsx
// ✗ 多一次 render，fullName 还可能短暂落后
useEffect(() => setFullName(first + ' ' + last), [first, last])
// ✓ 当前 render 直接派生
const fullName = `${first} ${last}`
```

## Effect 的 setup、cleanup 与依赖

```tsx
useEffect(() => {
  const connection = createConnection(serverUrl, roomId)
  connection.connect()                 // setup
  return () => connection.disconnect() // cleanup：切换依赖和卸载时执行
}, [serverUrl, roomId])
```

运行顺序：首次 commit 后 setup；依赖变化时，先用旧值 cleanup，再用新值 setup；卸载时 cleanup。开发环境根级 StrictMode 会额外 setup → cleanup → setup，以暴露忘记清理的 Effect。

依赖数组不是执行次数开关，而是“这个同步逻辑使用哪些响应式值”的完整清单：Effect 内读到的 props、state 和组件内定义的变量/函数都应被包含。不要通过删依赖或禁用 lint 来躲循环，应改变代码结构。

```tsx
// ✓ 订阅外部 window，cleanup 使用同一个监听函数
useEffect(() => {
  function onResize() { setWidth(window.innerWidth) }
  window.addEventListener('resize', onResize)
  onResize()
  return () => window.removeEventListener('resize', onResize)
}, [])
```

## 过期闭包与 useEffectEvent
Effect 中的回调会读到建立它的那次 render 的值。若连接只应在 `roomId` 改变时重连，但收到消息时要使用最新主题，可用 React 19.2 稳定的 `useEffectEvent`：

```tsx
const onConnected = useEffectEvent(() => showNotification('Connected!', theme))
useEffect(() => {
  const connection = createConnection(roomId)
  connection.on('connected', onConnected)
  connection.connect()
  return () => connection.disconnect()
}, [roomId]) // Effect Event 不写进依赖
```

Effect Event 只应从 Effect 内调用，不能用来逃避真正应当响应的依赖。

## 常见误区

| 误区 | 修改方向 |
|---|---|
| Effect 中同步 `setState` 来计算 `filteredItems` | render 中直接 `items.filter(...)` |
| Effect 中请求由点击触发的提交 | 放到 `onClick` / form action；它描述的是一次交互，不是“页面显示” |
| 监听器、timer、连接没有 cleanup | 返回撤销函数；依赖变化和卸载都会调用 |
| `[]` 用来“只执行一次”而忽略读到的 props/state | 写齐依赖，或重构，使 Effect 只依赖真正的同步输入 |
| 为最新值把 `theme` 加到连接依赖，导致换主题重连 | 对非响应式回调使用 `useEffectEvent` |

## 三句话自测
1. Effect 在 commit 后运行，职责是同步外部系统，不是计算普通 UI 数据或代替事件处理函数。
2. 依赖变化时 React 先使用旧依赖执行 cleanup，再使用新依赖执行 setup；卸载时也 cleanup。
3. Effect 内使用的响应式值必须反映在依赖中；想避免多余重连时，应分离事件逻辑，而不是遗漏依赖。

## 官方阅读
- https://react.dev/learn/synchronizing-with-effects
- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/reference/react/useEffect
- https://react.dev/reference/react/useEffectEvent
