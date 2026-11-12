# W1D2：State 是快照，不是可写变量

## 1. 一句话结论
每次 render 都拿到一份固定的 state 快照；`setState` 不会改动当前事件处理函数里的变量，它只是为下一次 render 排队。

## 2. 心智模型

```text
render #1: score = 0，创建的 onClick 也记住 score = 0
  ↓ 点击，事件处理函数运行完之前 React 先收集所有 setScore
setScore(score + 1)  → setScore(0 + 1) → 排队值 1
setScore(score + 1)  → setScore(0 + 1) → 排队值 1
  ↓
render #2: score = 1，创建一个读到 score = 1 的新 onClick
```

如果下一次值依赖前一个待处理值，给 setter 传更新函数：

```tsx
setScore((s) => s + 1) // React 按队列顺序：0 → 1 → 2 → 3
```

## 3. 要点

### 3.1 state 属于 React，不属于这次函数调用

```tsx
function Counter() {
  const [count, setCount] = useState(0)
  function handleClick() {
    setCount(count + 1)
    console.log(count) // 永远是本次 render 的快照，不会立刻变成新值
  }
  return <button onClick={handleClick}>{count}</button>
}
```

`setCount` 请求下一次 render。它不会改变已经创建好的事件处理函数闭包，也不会同步改 DOM。

### 3.2 React 会批处理同一事件里的 state 更新
React 会等点击处理函数中所有代码运行结束，再处理 state 队列和 render，避免中间状态的多次渲染。普通事件处理函数中连续调用多个 setter 会被批处理；不应该依赖“每调用一次 setter 就立刻 render 一次”。

同一个 state 的队列按顺序处理：

```tsx
setNumber(number + 5)     // 替换为 5
setNumber((n) => n + 1)   // 用 pending 值 5 计算，得到 6
setNumber(42)             // 最后替换为 42
// 下一次 render：42
```

当新值基于旧值时，一律选择更新函数 `(prev) => next`。只设置固定值时，直接 `setOpen(true)` 更清楚。

### 3.3 对象和数组 state 要替换，不要修改
state 快照应视为只读。复制最外层对象不够，修改嵌套值时要复制从 state 根到被改项的每一层。

```tsx
const [profile, setProfile] = useState({ name: 'Ada', prefs: { theme: 'light' } })

// ✗ profile.prefs.theme = 'dark'; setProfile(profile)
setProfile((p) => ({ ...p, prefs: { ...p.prefs, theme: 'dark' } })) // ✓
```

数组同理：添加用 `[...items, item]`；删除用 `filter`；修改某项用 `map` 并只复制被修改的对象。`push`、`splice`、`sort`、`reverse` 会改原数组，不能直接作用于 state。

### 3.4 设计 state：存最少且互不矛盾的数据
能从现有 props/state 在 render 时算出的值，不要再存一份 state：

```tsx
const total = items.reduce((sum, item) => sum + item.quantity, 0) // ✓ 派生值
// const [total, setTotal] = useState(0)                           // ✗ 易与 items 脱节
```

状态过于相关时，可合并为对象；独立变化时可拆开多个 `useState`。复杂更新逻辑到 W1D5 再用 `useReducer`。

## 4. 常见误区

| 误区 | 正确写法 | 原因 |
|---|---|---|
| 连续三次 `setN(n + 1)` | 三次 `setN(prev => prev + 1)` | 三次都读取同一个 `n` 快照 |
| `setN(n + 1); console.log(n + 1)` 当作新 state | 在下一次 render 使用 `n`，或计算 `const next = n + 1` 后同时使用 | 当前闭包中的 n 不变 |
| `user.name = name; setUser(user)` | `setUser(u => ({ ...u, name }))` | 同一引用可能被 React 跳过，也污染旧快照 |
| `[...list]` 后改 `next[0].seen` | `list.map(x => x.id === id ? {...x, seen: true} : x)` | 只复制数组，内部对象仍共享 |
| 把 `total` 也写入 state | render 中由 `items` 计算 `total` | 避免重复数据和不同步 |

## 5. 三句话自测
1. 每次 render 和它创建的事件处理函数都闭包在自己的 state 快照里，setter 不会同步改变这份快照。
2. 下一状态依赖前一状态时，用更新函数；React 会按顺序把它们作用于 pending state。
3. state 中的对象和数组按只读处理，更新时复制被修改路径，并只存不能由其他数据推导出的最小状态。

## 6. 延伸阅读
- https://react.dev/learn/state-as-a-snapshot
- https://react.dev/learn/queueing-a-series-of-state-updates
- https://react.dev/learn/updating-objects-in-state
