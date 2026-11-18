# W3D2：并发渲染

> 以 React 19.3（npm 19.3.1）为准，`<Activity>` 自 19.2 起稳定导出。承接 [W3D1](W3D1-fiber-reconciliation.md) 的双缓冲与“render 可中断、commit 原子”，以及 [W2D2](W2D2-suspense-use.md) 的 transition/Suspense 语义。Lane 只讲概念和可观察行为，不背位掩码或源码行号；代码片段为节省篇幅省略了部分 import。

## 1. 一句话结论

并发渲染不是多线程，也不是让 DOM 渐进更新；它把 render 拆成有优先级的可中断工作单元，让点击/输入先 commit，耗时的 render 在后台重做或丢弃，而 commit 始终同步、原子地切换整棵树——`useTransition`、`useDeferredValue`、`<Activity>` 是把这个能力交给应用代码的三个入口。

## 2. 心智模型

```text
优先级（概念阶梯，不是线程优先级）
高 ↑
  Sync             click / keydown / input 等离散交互
  InputContinuous  scroll / mousemove / drag 等连续交互
  Default          首次挂载、网络回调、setTimeout 里的 setState
  Transition       startTransition / useDeferredValue 的后台 render
  Idle             内部空闲工作
  Offscreen        Activity hidden 子树的预渲染/更新
低 ↓

一次更新
  事件/回调 → update 打上 lane → 调度
                                ├─ 高 lane：先 render → commit
                                └─ 低 lane：render 可暂停/丢弃/重来 → commit

render：在 WIP 上算；可多次、可作废；不碰 DOM、不跑 Effect
commit：同步、原子；DOM 改完 → layout effect → 切换 current → paint → passive effect（交互更新可能例外，通常在 paint 前运行）
```

```tsx
function Search({ all }: { all: string[] }) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const rows = all.filter((x) => x.includes(deferredQuery))
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul style={{ opacity: query === deferredQuery ? 1 : 0.5 }}>
        {rows.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </>
  )
}
```

输入框用 `query` 同步更新，列表用 `deferredQuery` 落后一拍，所以不会出现“输入卡住等列表”。**紧急的小更新优先，昂贵的派生 render 让路**，这就是并发渲染要买的东西。

## 3. 要点

### 3.1 目标：保持响应，而不是“更快”

- 并发渲染优化的不是单次 render 的耗时，而是**等待体验**：紧急更新可以插队，低优先级 render 被中断后不会阻塞输入。
- render 可以执行多次、被丢弃；被丢弃的 render 不产生 DOM、不跑 Effect，已排队的 state update 不会丢，之后会以最新 state 重放。
- commit 仍然同步且原子：DOM 全部改完才切换 `root.current`，浏览器不会看到“半棵新树”；layout effect 在 paint 前，passive effect 通常在 paint 后（交互触发的更新可能在 paint 前运行）。
- React 仍在主线程跑 JS，没有 Worker 并行；并发的低优先级 render 只在 Fiber 之间让出主线程（约 5ms 一片），Sync lane 不让出。**单个组件函数体不能被打断**，所以一个耗时 200ms 的组件仍会卡。
- 因为 render 可能重做，render 必须纯：不发请求、不写 ref、不改全局变量；这些放事件或 Effect。

```tsx
function Demo() {
  const [text, setText] = useState('')
  console.log('render', text) // 可能多次；不要在这里发请求
  useLayoutEffect(() => {
    console.log('commit DOM:', document.querySelector('output')?.textContent)
  })
  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <output>{text}</output>
    </>
  )
}
```

日志顺序永远是 render 先、commit 后；首次 render 时 `<output>` 还不存在，commit 后才读到新值。这正是 W3D1 的薄弱点“render 读到上一次 commit 的 DOM”。把更新放进 transition 不会改变这个顺序，只改变何时开始 render、是否重做。

### 3.2 Lane：给每个 update 打优先级

- 每次 `setState` 生成一个 update，带一个 lane（位掩码）；root 记录 pending lanes，调度时先处理最高优先级，低优先级留在队列里。
- 高优先级 update 到达时，正在进行的低优先级 render 会被打断：WIP 作废（或部分复用），用最新 state 重做。这就是 transition 可被打断的原因。
- Sync（离散交互）不参与时间切片，会在事件结束时同步 flush；InputContinuous/Default/Transition 可以 yield。**优先级不等于“立即执行”**：同一事件里的多个 update 仍会批处理。
- 低优先级不会永远饿死：React 会给久未处理的 lane 记过期时间，过期后提升处理（实现细节，不背公式）。
- Lane 是内部实现，不是公开 API；应用代码通过事件类型、`startTransition`、`useDeferredValue`、`<Activity>` 间接影响它。当前多个 transition 会合并处理，不要依赖精确调度顺序。

| Lane | 触发 | 可观察行为 |
|---|---|---|
| Sync | click/keydown/input 等离散事件；`flushSync` | 输入/点击先提交；同一事件内批处理 |
| InputContinuous | scroll/mousemove/drag | 高于 default，低于离散；可让出 |
| Default | 首次挂载、网络回调、setTimeout | 常规优先级，可时间切片 |
| Transition | `startTransition`、`useDeferredValue` 后台 render | 可被输入打断；保留旧 UI；`isPending` 或旧值变暗 |
| Idle | React 内部空闲工作 | 应用代码通常接触不到 |
| Offscreen | Activity hidden 子树 | 不阻塞可见内容；预渲染/低优先级更新 |

```tsx
function PriorityDemo() {
  const [urgent, setUrgent] = useState(0)
  const [slow, setSlow] = useState(0)
  const [, startTransition] = useTransition()
  console.log('render', urgent, slow)
  return (
    <button onClick={() => {
      setUrgent((n) => n + 1)                      // Sync
      startTransition(() => setSlow((n) => n + 1)) // Transition
    }}>
      {urgent} / {slow}
    </button>
  )
}
```

快速连点：`urgent` 每次都先显示，`slow` 可能落后并重算；日志里 `slow` 的中间值不代表屏幕，因为对应的 render 可能被丢弃。

### 3.3 useTransition：把更新标记为“可以等”

- `const [isPending, startTransition] = useTransition()`；`startTransition` **立即同步执行**回调，只把回调执行期间同步调度的 state update 标记为 transition。
- transition update 是低优先级、可被打断；已经显示的 UI 会保留到新 render 完成（配合 Suspense 时尤其明显）。
- `isPending` 在第一次 `startTransition` 时变 true，直到所有 Action 完成且最终 state 显示才变 false；它只反映**这个 hook** 的 transition，不是全局 loading。
- 不能用于受控输入的值：输入必须同步更新；要延迟下游，用第二个 state 或 `useDeferredValue`。
- 异步 action：`await` 之后 React 丢失了同步上下文，之后的 setState 必须再包一层 `startTransition`；`setTimeout` 里的更新同理。
- hook 版本的 Action 抛错/拒绝可由最近 Error Boundary 接住；组件外的独立 `startTransition` 没有 `isPending`，错误也不会经过组件 Error Boundary。

```tsx
function Tabs() {
  const [tab, setTab] = useState('about')
  const [isPending, startTransition] = useTransition()
  return (
    <>
      <button onClick={() => startTransition(() => setTab('posts'))}>
        Posts {isPending ? '…' : ''}
      </button>
      <TabContent tab={tab} />
    </>
  )
}
```

点击后按钮的 pending 文案立即出现，而 `TabContent` 的旧内容会保留到新 tab 的 render 提交；如果新 tab 很重，期间继续点击别处也不会被它阻塞。

```tsx
function SaveButton({ next }: { next: string }) {
  const [saved, setSaved] = useState('')
  const [isPending, startTransition] = useTransition()
  function onSave() {
    startTransition(async () => {
      const result = await api.save(next)       // 请求立刻发出
      startTransition(() => setSaved(result))   // await 后要重新标记
    })
  }
  return <button disabled={isPending} onClick={onSave}>{isPending ? '保存中…' : `已保存 ${saved}`}</button>
}
```

请求不会被 transition 延迟；被延迟的只是结果 state 的 render。`isPending` 会跨 `await` 保持 true，因为整个 async Action 属于这个 transition；但 `await` 之后的 setState 不再自动属于它，所以必须再包一层。`disabled` 只是产品选择，不是 `isPending` 的必需用法。

### 3.4 useDeferredValue：让一个值“落后一拍”

- `const deferred = useDeferredValue(value, initialValue?)`。更新时先做一次紧急 render（deferred 仍是旧值），再在后台用新值 render；后台 render 可被新输入打断，最终总是采用最新值。
- `initialValue` 只在首次 render 生效：没有它，首次 render 不延迟（没有旧值可用）；传入后首屏先用它，再后台追上。适合首屏昂贵、或想先渲染轻量占位的场景。
- 通过 `value !== deferred` 判断“旧值仍在显示”，做变暗/“更新中”提示；否则用户会看到输入与结果不一致。
- 后台 render 因 Suspense 挂起时不会显示 fallback，旧 deferred 值继续显示，数据就绪后切换；它的 Effect 也只在 commit 后运行。
- 它只延迟**渲染**，不减少网络请求；要减少请求用 debounce/TanStack Query。没有固定延迟，会按设备速度自适应，这是与 debounce/throttle 的关键区别。
- 慢子组件必须 `memo`：否则父组件紧急 render 时，子组件即使收到相同的旧 deferred prop 也会重渲染，优化失效。
- 传入值应是原始值或 render 外创建的稳定对象；每次 render 新建对象会导致每次后台重渲染。transition 内部的 `useDeferredValue` 直接返回新值，不再另起后台 render。

```tsx
import { memo, useDeferredValue } from 'react'

const SlowChart = memo(function SlowChart({ data }: { data: number[] }) {
  return <canvas data-points={data.length} />
})

function Dashboard({ data }: { data: number[] }) {
  const deferredData = useDeferredValue(data)
  const stale = data !== deferredData
  return (
    <div style={{ opacity: stale ? 0.5 : 1 }}>
      <SlowChart data={deferredData} />
    </div>
  )
}
```

父组件因其他紧急更新重渲染时，`deferredData` 还是旧引用，`memo` 让图表跳过；等后台 render 用新值提交时才重算。没有 `memo`，图表会跟着父组件立即重渲染，deferred 就白用了。

```tsx
function Results({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query, '')
  return <HeavyList query={deferredQuery} />
}
```

首屏先用空串渲染轻量结果，再后台追上真实 `query`；适合首屏很贵、且能接受短暂占位的场景。

| | `useTransition` | `useDeferredValue` |
|---|---|---|
| 谁控制更新 | 你拥有 setter | 值来自 props/context/外部 |
| 显式 pending | `isPending` | 自己比较 `value !== deferred` |
| 能否包含 async action | 能 | 不能，只延迟值 |
| 典型场景 | tab/路由/提交后的状态 | 搜索列表/昂贵子树 |
| 受控输入 | 不能直接用于输入值 | 输入本身用原值，延迟派生值 |
| 关系 | 低优先级 update | 后台 render；在 transition 内直接返回新值 |

### 3.5 `<Activity>`：隐藏但保留，像“暂停的组件”

- `mode="visible" | "hidden"`，默认 visible。hidden 时 React 给子树的 host 节点加 `display: none`：DOM 保留、state 保留，但**所有 Effect 被销毁**（cleanup 执行），订阅/计时器应随之停止。
- 隐藏期间子树仍会因 props 变化而 render，但以更低优先级（Offscreen）进行，不阻塞可见内容；首次就以 hidden 挂载则是“预渲染”：render 但不挂 Effect，Suspense 数据源（`use` 读 promise）会提前加载，Effect 里的 fetch 不会。
- 重新 visible 时：state 恢复，Effect 重新 setup，DOM（如 textarea 草稿）还在；所以它适合 tabs/keep-alive/预渲染，而不是“卸载”。
- 概念上把 hidden 当作“已卸载”来想 Effect，但 state/DOM 不会丢；这是最容易记反的一点。
- DOM 自身的副作用不会自动停：`<video>`/`<audio>`/`<iframe>` 在 hidden 后仍可能存在；用 Effect cleanup 主动暂停/清理，视觉相关的清理优先 `useLayoutEffect`（避免被 Suspense/View Transition 延迟）。
- 注意：hidden 且只返回文本的组件不会产生 DOM 输出；隐藏内容仍在内存里，不要拿它代替真正的卸载；测试中 `display:none` 的元素要用 `{ hidden: true }` 或 `toBeVisible()` 处理。

```tsx
import { Activity, useState } from 'react'

function Tabs() {
  const [tab, setTab] = useState<'home' | 'contact'>('home')
  return (
    <>
      <button onClick={() => setTab('home')}>Home</button>
      <button onClick={() => setTab('contact')}>Contact</button>
      <Activity mode={tab === 'home' ? 'visible' : 'hidden'}><Home /></Activity>
      <Activity mode={tab === 'contact' ? 'visible' : 'hidden'}><Contact /></Activity>
    </>
  )
}
```

切到 Home 时 Contact 只是 `display:none`，textarea 草稿和组件 state 都还在；但 Contact 的订阅会被清理，切回来时重新建立。

```tsx
function VideoTab() {
  const ref = useRef<HTMLVideoElement>(null)
  useLayoutEffect(() => {
    const video = ref.current!
    return () => video.pause()
  }, [])
  return <video ref={ref} controls src="/demo.mp4" />
}
```

隐藏触发 cleanup → 暂停；重新显示会重新 setup。因为 DOM 没销毁，视频进度保留，不需要重新下载；文档建议这种“与视觉隐藏绑定”的清理用 `useLayoutEffect`。

### 3.6 与 Suspense：transition 保护“已显示的内容”

- transition 更新中，如果新 render 会挂起，React 不会把已经显示的内容换成 fallback；它保留旧 UI，等新内容就绪再切换，`isPending` 给你加载提示。
- 但 transition 只“等足够久以避免隐藏已显示内容”：新出现的 Suspense 边界仍会立即显示 fallback；嵌套边界也不会被统一等待。
- `useDeferredValue` 与 Suspense 深度集成：后台 render 挂起不显示 fallback，旧 deferred 值继续显示；数据就绪后再提交。
- transition 不会替你发请求或缓存。只有 Suspense-enabled 数据源（`use` + 稳定 promise、TanStack Query 的 suspense 模式、路由 loader）才能让它协调加载；Effect 里的 fetch 不会被感知，`isPending` 也不会跟踪它。
- Suspense-enabled 路由通常会把导航作为 transition 处理；应用层读 `useNavigation()` 的 `loading`/`submitting`（W2D4），不要自己再包一层。

```tsx
function ArtistPage() {
  const [artistId, setArtistId] = useState('a')
  const [isPending, startTransition] = useTransition()
  return (
    <>
      <button onClick={() => startTransition(() => setArtistId('b'))}>B</button>
      {isPending && <p role="status">加载中…</p>}
      <Suspense fallback={<BigSpinner />}>
        <Artist id={artistId} />
      </Suspense>
    </>
  )
}
```

`Artist` 已经显示过并因新 id 挂起时，transition 保留旧艺人内容，只显示 pending；如果给 Suspense 边界加 `key` 让它变成“新边界”，或新渲染出一个边界，fallback 仍会出现。需要“不同身份绝不显示旧数据”时，就用 key 重置边界。

### 3.7 场景选型

| 场景 | 首选 | 说明 |
|---|---|---|
| 受控输入值 | 普通 `setState` | 输入必须同步，绝不放 transition |
| 搜索框 → 结果列表 | `useDeferredValue` + Suspense | debounce 只减少请求，配合 TanStack Query |
| tab 切换（保留草稿/预加载） | `<Activity>` | 保留 state/DOM，清理 Effect |
| tab/路由切换（数据加载） | `useTransition` + Suspense + `isPending` | 路由场景读 `useNavigation` |
| 表单提交 | `<form action>` / `useActionState` / `useFormStatus` | 见 W2D1；自定义异步可用 transition |
| 昂贵图表/长列表 | `useDeferredValue` + `memo` | 你拥有 setter 时也可用 transition |
| 减少网络请求 | debounce/throttle 或 Query | deferred 不减少请求 |
| 全局 loading | 每个操作的 `isPending` + Query 状态 | 不要用一个全局 flag 代表所有 transition |
| 需要重置状态 | 条件渲染/换 key | Activity 会保留，不适合 |
| 后台预渲染下一 tab | `<Activity mode="hidden">` | 只对 Suspense-enabled 数据生效 |
| URL 状态/前进后退 | 路由 transition + URL | 见 W2D4 |
| 订阅/媒体播放 | Effect cleanup | Activity 隐藏会清理 Effect，DOM 媒体要手动 pause |

```tsx
function Panel({ all }: { all: string[] }) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'list' | 'stats'>('list')
  const deferredQ = useDeferredValue(q)
  const [isPending, startTransition] = useTransition()
  const rows = all.filter((x) => x.includes(deferredQ))
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} />
      <button onClick={() => startTransition(() => setTab((t) => t === 'list' ? 'stats' : 'list'))}>{isPending ? '切换中…' : '切换'}</button>
      <Activity mode={tab === 'list' ? 'visible' : 'hidden'}><List rows={rows} /></Activity>
      <Activity mode={tab === 'stats' ? 'visible' : 'hidden'}><Stats rows={rows} /></Activity>
    </>
  )
}
```

输入用紧急 state，列表用 deferred，tab 用 transition，两个 tab 用 Activity 保活；四种工具各司其职，不是互相替代。

### 3.8 怎么观察和测试：断言行为，不断言时序

- 记录 render 次数可以暴露“重复/丢弃”，但不要断言精确值：StrictMode 会双调用（还会主动模拟 Activity 的隐藏/显示），transition 可能重做，Suspense 会重试。更稳的断言是最终 DOM 和 Effect 调用。
- 日志顺序：render 日志先于 layout effect/commit；用 `useLayoutEffect` 读 DOM 可以验证 commit 原子性。
- `isPending` 对同步 transition 往往在 `act` 内瞬间完成，测试里看不到；要观察它，用 async action/可控 promise 或 Suspense 让 transition 持续一段时间。
- Testing Library：用 `findBy*`/`waitFor` 等待最终状态；不要用 `setTimeout`/fake timers 猜 React 调度（fake timers 只用于 debounce 等业务计时）。
- Activity 隐藏的 DOM 仍在：默认 `getByRole` 会排除 `display:none`，用 `{ hidden: true }` 找到它并 `not.toBeVisible()`；断言草稿保留、cleanup 被调用。

```tsx
test('Activity 隐藏保留草稿并清理 Effect', async () => {
  const cleanup = vi.fn()
  render(<TabsWithCleanup onCleanup={cleanup} />)
  await userEvent.type(screen.getByRole('textbox'), 'draft')
  await userEvent.click(screen.getByRole('button', { name: 'Home' }))
  expect(screen.getByRole('textbox', { hidden: true })).not.toBeVisible()
  expect(cleanup).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Contact' }))
  expect(screen.getByRole('textbox')).toHaveValue('draft')
})
```

```tsx
const renders = vi.fn()
function Slow({ value }: { value: string }) {
  renders(value)
  return <p>{value}</p>
}
// 断言最终 screen.getByText('最新')；不要把 renders.mock.calls.length 写死
```

`TabsWithCleanup` 假设把 `onCleanup` 接到某个子组件的 Effect cleanup；测试只验证“隐藏 → 不可见 + cleanup + 草稿仍在 → 显示”，不关心 React 内部用了几次 render。

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| `startTransition(() => setInput(e.target.value))` 控制输入框 | 输入值用普通 `setState`；下游派生值再 transition/deferred | transition 是非阻塞的，受控输入必须同步更新，否则输入会回退/丢字 |
| 把 `isPending` 当全局 loading | 每个操作用自己的 `useTransition`，或用 Query 的 `isFetching` | `isPending` 只反映这个 hook 启动的 transition；多个 transition 目前还会合并 |
| `startTransition(() => fetch(...))`，以为请求会延后 | 在事件/action 里发请求，只把结果 state 更新包进 transition | 回调会立即执行；transition 只改变 update 优先级，不延迟副作用 |
| `startTransition(async () => { await f(); setState(x) })` | `await` 后再包一层 `startTransition` | await 后 React 丢失同步上下文，更新不会自动标记为 transition |
| 把 `setTimeout(() => setState(), 0)` 包在 `startTransition` 里 | 把 `startTransition` 放进 timeout 回调 | 只有回调同步执行期间的 update 会被标记 |
| 认为 transition 让 render 变快 | 用 memo/拆分/Compiler 降低工作量；transition 只调整优先级 | 总工作量不变，只是不阻塞紧急更新 |
| 认为 transition 一定不显示 fallback | 用 key 控制边界身份；接受新边界的 fallback | transition 只保护已显示内容；新出现的 Suspense 边界仍显示 fallback |
| 认为 `useDeferredValue` 会减少请求 | 用 debounce/Query 控制请求；deferred 只延迟渲染 | 每次值变化仍可能发请求，deferred 只影响显示 |
| `useDeferredValue({ ...obj })` 或每次 render 新建对象 | 传原始值或 render 外创建的稳定对象 | 每次都是新引用，导致每次后台重渲染 |
| 对所有值都套 deferred，且不提示旧值 | 只对真正慢的子树用，并显示 stale 状态 | 输入与结果不一致，用户不知道内容还没更新；还会产生无谓后台 render |
| 慢子组件没包 `memo` 就用 deferred | 给慢子组件加 `memo`，让旧 deferred prop 命中缓存 | 父组件紧急 render 时，子组件仍会重渲染，优化失效 |
| 把 `<Activity>` 当卸载 | 需要重置 state 时用条件渲染/换 key；需要保留才用 Activity | hidden 保留 state/DOM，只销毁 Effect；visible 会恢复 |
| 认为 Activity hidden 后什么都不做 | 接受它仍以低优先级响应 props，并可能占内存 | Offscreen 预渲染/更新是特性，不是 bug |
| Effect 只 setup 不 cleanup，靠卸载停副作用 | 在 Effect 返回 cleanup；媒体/视觉清理用 `useLayoutEffect` | hidden 时 Effect 被销毁但 DOM 仍在，video/iframe/timer 可能继续 |
| 指望 hidden 时 Effect 继续跑 | 把需要持续运行的外部系统放到可见层，或明确在 cleanup 中暂停 | hidden 的语义是“概念上卸载”，订阅会被清理 |
| 测试断言 render 次数/耗时精确值 | 断言最终 DOM、`isPending` 出现、cleanup 调用；用 `findBy`/`waitFor` | StrictMode、中断、Suspense 重试都会改变次数和时序 |
| 在 render 里 fetch/写 ref/改全局 | 放事件/Effect/Query/loader | 并发 render 可能重复、被中断、被丢弃 |
| 认为并发渲染是多线程或 DOM 渐进更新 | 单线程时间切片 + 原子 commit | React 不并行跑组件，也不会把半成品 DOM 画到屏幕 |

## 5. 三句话自测

1. **并发渲染到底改变了什么？** 它把 render 变成按 Lane 调度、可中断/可丢弃的工作，紧急更新先 commit，低优先级工作在后台重做；它不加速单次 render，也不是多线程，commit 仍是同步原子的。
2. **`useTransition` 和 `useDeferredValue` 怎么选？** 你拥有 setter、需要 `isPending` 或 async action 时用 transition；值来自 props/context/外部、只需要让某棵子树落后时用 deferred；两者都不减少请求，受控输入本身永远用普通 `setState`。
3. **Activity 隐藏时 state、DOM、Effect 各怎样？** state 和 DOM 保留（`display:none`），Effect 被销毁并在重新可见时重建；隐藏子树仍以低优先级响应 props，首次 hidden 还会预渲染，但 DOM 媒体副作用要自己 cleanup。

## 6. 官方阅读

- https://react.dev/reference/react/useTransition
- https://react.dev/reference/react/useDeferredValue
- https://react.dev/reference/react/Activity
