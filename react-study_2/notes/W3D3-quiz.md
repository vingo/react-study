# W3D3 课前测验：性能与 React Compiler

先独立作答，不查资料、不运行代码；把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W3D3.md`，做完前不要打开。

本卷共 9 分：2 道复习题（各 0.5 分），3 道新主题题（3 + 2.5 + 2.5 分）。以 React 19.3 与 React Compiler 1.0 为准。练习环境未启用 React Compiler；涉及编译器的题目只考心智模型与规则，不要假设实际编译产物，也不要假设本机运行结果。

## 复习 1：条件渲染与草稿 state（0.5 分｜来自 W1D1 第 3 题）

```tsx
function Editor() {
  const [draft, setDraft] = useState('')
  return (
    <textarea
      value={draft}
      onChange={e => setDraft(e.target.value)}
    />
  )
}

function App() {
  const [wide, setWide] = useState(false)
  return (
    <>
      <button onClick={() => setWide(w => !w)}>切换布局</button>

      {/* 写法 A */}
      {wide ? <Editor /> : <Editor />}

      {/* 写法 B 把上面这一行换成：
          {wide ? <div><Editor /></div> : <section><Editor /></section>}
      */}
    </>
  )
}
```

先在 textarea 输入 `hello`，再点“切换布局”。

1. 写法 A 中草稿是否保留？
2. 写法 B 中草稿是否保留？
3. 如果把 B 的两侧都换成同一个组件 `<Panel>`（里面仍是 `<Editor />`），结果又如何？

分别解释 React 判断“是否复用同一个组件实例”的依据。

**你的答案：**
1: 会保留，都是<Editor />组件，key， type都一致
2: 不会
3: 会保留
组件实例是否一致： 比较 key，type。

## 复习 2：reducer 找 bug（0.5 分｜来自 W1D5 第 3 题）

```tsx
type Task = { id: string; text: string; done: boolean }
type Action =
  | { type: 'toggled'; id: string }
  | { type: 'added'; text: string }

function tasksReducer(tasks: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'toggled': {
      const next = tasks
      const task = next.find(t => t.id === action.id)!
      task.done = !task.done
      return next
    }
    case 'added':
      return [
        ...tasks,
        { id: crypto.randomUUID(), text: action.text, done: false },
      ]
    default:
      return tasks
  }
}
```

点击某个任务的切换按钮后，界面有时不更新；开发环境开启 StrictMode 时现象更奇怪。

1. 找出 reducer 中至少两处问题，并说明各自会导致什么问题。
2. 写出 `toggled` 分支的正确实现；`added` 的 `id` 应该在哪里生成？

     
**你的答案：**
1: toggled类型场景： 需要返回新的task对象,代码中返回同一个引用可能跳过更新
2: added类型： id不能放在reduce函数中，只能是纯函数， id可以放在时间函数中生成
更新代码：
 case 'toggled': {
    return tasks.map(t => t.id === action.id ? { t.done !t.done} : t)
  }
  case 'added':{
      return [...tasks, { id: action.id, text: action.text, done: false }]
  }


## 第 1 题：主题切换、Profiler 与 memo（3 分）

`Chart` 已经用 `memo` 包裹，但每次切换主题仍然会卡顿。

```tsx
const rows = loadRows() // 模块级常量，引用稳定

const Chart = memo(function Chart({ data, options, onSelect }) {
  // 绘制 5000 个点，约 120ms
  return <canvas width={800} height={400} />
})

function Dashboard() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const data = useMemo(() => buildSeries(rows), [rows])

  return (
    <div className={theme}>
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        切换主题
      </button>
      <Profiler id="chart" onRender={onRender}>
        <Chart
          data={data}
          options={{ animate: true }}
          onSelect={id => console.log('picked', id)}
        />
      </Profiler>
    </div>
  )
}
```

某次交互的 `onRender` 日志：

```text
{ id: 'chart', phase: 'mount',  actualDuration: 142.3, baseDuration: 139.8 }
{ id: 'chart', phase: 'update', actualDuration: 131.1, baseDuration: 138.9 }
```

1. 解释 `actualDuration`、`baseDuration`、`phase` 的含义。结合两组数字判断：这次 update 中 `memo` 是否让 `Chart` 跳过了渲染？这些数字不能说明哪些事情？至少说出两点。
2. 点击“切换主题”时 `Chart` 会不会重新渲染？逐个检查三个 props。给出至少两种不同层级的修法，并说明哪种更彻底、为什么。
3. 团队打算给这个页面里所有对象和函数都套 `useMemo` / `useCallback`。请给出你认为合理的优化顺序，说明每一步做什么、为什么；最后说明 `memo` 真正有价值的条件。

**你的答案：**
1: `phase`： 这次提交属于 mount（首次挂载），update， nested-update;
`actualDuration`: 本次更新中，渲染 profiler以及其后代实际化掉的毫秒数；
`baseDuration`：  没有做任何优化，整个组件重新渲染需要的估算时间；memoization优化前的时间（最坏的情况）
2；会渲染chart组件， options属性值每次都是新的引用，所以memo包裹的chart每次props都不同，会重新渲染；
修改： options常量化， onSelect 用useCallback包裹
const CHART_OPTIONS = {animate: true};
const handleSelect = useCallback((id: string) => {
  console.log('picked', id)
}, []);
<Chart data={data} options={CHART_OPTIONS} onSelect={handleSelect} />
3: 顺序：先测量、再结构、后 memo, 
3.1 测量：  用devtools profiler 确认再次提交是否满，具体的commit是啥，
3.2: 结构优化： 减少需要render的工作，状态下沉，用children组合避免父组件state变化波及子树，移除非必要的effect和派生state
3.3: memo化：
3.4: 并发：如果输入/交互被慢渲染阻塞，可以考虑 useDeferredValue/useTrasition


## 第 2 题：useMemo / useCallback 的语义与误用（2.5 分）

### A. 报告筛选

```tsx
function Report({ rows, status }: { rows: Row[]; status: string }) {
  const visible = useMemo(() => {
    analytics.track('report-render')
    return rows.filter(row => row.status === status)
  }, [rows])

  return <List rows={visible} />
}
```

用户把 `status` 从 `open` 切到 `done` 后，`List` 会显示哪一批数据？这个 `useMemo` 至少有两个问题。指出并修复（写出修正后的依赖数组，以及 `analytics` 应该放在哪里）。

**你的答案：**
1: 返回open类型的数据
2: 问题1: 依赖缺少status
useMemo(()=>{}, [rows,sttaus])
问题2: usememo 发生在render阶段，会多次触发，可能被重做/丢弃，不保证只执行一次，analytics.track 就不准确了

useEffect(() => {
    analytics.track('report-render', { status })
  }, [status])




### B. 列表项的回调

```tsx
const Row = memo(function Row({ item, onPick }) {
  return <button onClick={() => onPick(item.id)}>{item.name}</button>
})

function List({ items, onSelect }) {
  const handlePick = useCallback((id: string) => onSelect(id), [onSelect])

  return (
    <ul>
      {items.map(item => (
        <Row
          key={item.id}
          item={item}
          onPick={() => handlePick(item.id)}
        />
      ))}
    </ul>
  )
}
```

`handlePick` 已经用 `useCallback` 缓存了，为什么每次 `List` 渲染时 `Row` 仍可能全部重渲染？在不改变 `Row` 的 props 契约（仍然接收 `item` 和 `onPick`）的前提下，怎样改才能让 `memo` 生效？如果启用 React Compiler，这段源码还会不会出现同样的问题？

**你的答案：**
1: onpick的值不对
<Row key={item.id}  item={item} onPick={handlePick}  />
const Row = memo(funtion Row({item, onPick}){
  return <button onClick= {() => onPick(item.id)}>
  {item.name} </button>
});


### C. 哪些 memo 化值得

下面三处 memo 化，哪些值得、哪些不值得？各用一句话说明理由（可以指出需要先测量）。

```tsx
// C1
const total = useMemo(() => price * quantity, [price, quantity])

// C2
<button onClick={useCallback(() => submit(form), [form])}>提交</button>

// C3
const sorted = useMemo(() => [...items].sort(compare), [items])
```

**你的答案：**
c1 不值得
c2 不需要
c3: 值得,需要先看下profiler，

## 第 3 题：React Compiler 1.0 的心智模型（2.5 分）

练习环境没有启用 React Compiler，下面只讨论编译器的心智模型与规则。默认配置是 `compilationMode: 'infer'`。

```tsx
type CartItem = { price: number; quantity: number; seen?: boolean }

function Cart({ items, coupon }: { items: CartItem[]; coupon: string }) {
  const total = items.reduce((sum, item) => {
    item.seen = true
    return sum + item.price * item.quantity
  }, 0)

  return (
    <section>
      <strong>{total}</strong>
      <Coupon code={coupon} />
    </section>
  )
}

function PriceTag({ value }: { value: number }) {
  return <em>{formatPrice(value)}</em>
}

function formatPrice(value: number) {
  return `¥${value.toFixed(2)}`
}
```

1. `Cart`、`PriceTag`、`formatPrice` 三者中，哪些会被编译器自动 memo 化？为什么？编译器主要想消除哪两类开销？它的 memo 结果会在不同组件之间共享吗？团队想先只在一个组件上试用，并且线上怀疑某个组件被编译坏了时只排除那个组件；分别说明配置和代码层面要怎么做。
2. `item.seen = true` 这行会怎样影响编译器对 `Cart` 的处理？说明编译器与 Rules of React、ESLint 的关系；`"use no memo"` 在这里能起什么作用？它是否足以解决问题？
3. 团队说：“Compiler 1.0 已经自动 memo 了，可以把现有 `useMemo` / `useCallback` / `memo` 全删掉，并且以后写代码可以依赖 memo 来保证正确性。” 这个说法哪里不对？至少从三个方面反驳。

**你的答案：**
1: cart和prieTag会被自动memo化，
2: 在render内执行的`item.seen = true`，直接修改props对象，违反了 纯函数的规则。编译器的策略是： 遇到可能违反规则的代码时，会跳过优化baiout
