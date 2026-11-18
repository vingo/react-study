# W3D2 课前测验：并发渲染

先独立作答，不查资料、不运行代码；把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W3D2.md`，做完前不要打开。

本卷共 9 分：2 道复习题（各 0.5 分），3 道新主题题（3 + 2.5 + 2.5 分）。

## 复习 1：共享数组与渲染结果（0.5 分｜来自 W1D1 第 2 题）

```tsx
function Feed({ items }: { items: string[] }) {
  const newestFirst = items.reverse()
  return (
    <ul>
      {newestFirst.map(m => <li key={m}>{m}</li>)}
    </ul>
  )
}
```

父组件把 `items` 存在 state 中，初始值为 `['周一', '周二', '周三']`。页面上有一个“刷新”按钮，点击只是让父组件重新渲染，传入的仍是同一个数组引用。

开发环境（开启 StrictMode）下，列表始终是“周一、周二、周三”；上线后，每点一次“刷新”，列表顺序就翻转一次。

1. 分别解释这两个现象。
2. 写出正确写法，并说明原写法违反了什么规则、为什么在并发渲染下更危险。

**你的答案：**


## 复习 2：组件身份与草稿保留（0.5 分｜来自 W1D5 第 2 题）

```tsx
function Messenger({ recipient }: { recipient: Contact }) {
  return <Chat recipient={recipient} />
}
```

`Chat` 内部有草稿 `useState`。从 Ada 切换到 Grace 时，草稿仍然保留。

1. 为什么草稿会保留？怎样让每位收件人都得到空白草稿？
2. 为什么不能写 `key={Math.random()}`？至少说出两个具体后果。

**你的答案：**


## 第 1 题：transition 与搜索页（3 分）

```tsx
import { Suspense, useState, useTransition, type ChangeEvent } from 'react'

function ResultList({ items }: { items: Result[] }) {
  return (
    <ul>
      {items.map(item => <li key={item.id}>{item.title}</li>)}
    </ul>
  )
}

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [isPending, startTransition] = useTransition()

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    startTransition(() => {
      setQuery(e.target.value)
      setResults(search(e.target.value))
    })
  }

  async function handleLoadMore() {
    startTransition(async () => {
      const next = await fetchNextPage(query)
      setResults(prev => [...prev, ...next])
    })
  }

  return (
    <section>
      <input value={query} onChange={handleChange} />
      <button onClick={handleLoadMore}>
        {isPending ? '加载中…' : '加载更多'}
      </button>
      <ResultList items={results} />
    </section>
  )
}
```

`search` 是同步但很慢的函数；`fetchNextPage` 返回 Promise。忽略 StrictMode 的额外调用。

1. 用户快速输入 `abc`。输入框能否可靠地显示 `abc`？`handleChange` 有什么问题？给出两种修法：一种保留 `useTransition`，一种改用 `useDeferredValue`。分别说明两种修法里哪些 state 更新是紧急的、哪些是非紧急的。
2. 在保留 `useTransition` 的修法里，把 `setQuery` 移出 transition 后，用户连续输入时 `isPending` 何时变为 `true`、何时变回 `false`？正在后台进行的 results 渲染遇到新的按键会怎样？输入框会不会被阻塞？
3. `handleLoadMore` 中 `await fetchNextPage(...)` 之后的 `setResults` 是否仍是非紧急更新？为什么？这会带来什么具体风险？如何改写？
4. 假设另有一个不在输入框上的按钮，把 `query` 从 `a` 切到 `b`，并且这个更新被包在 `startTransition` 中。结果区写成 `<Suspense key={query} fallback={<Spinner />}><ResultsByQuery query={query} /></Suspense>`，其中 `ResultsByQuery` 用 `use()` 读取按 query 缓存的、可能挂起的 promise。key 加与不加，用户分别会看到什么？为什么？

**你的答案：**


## 第 2 题：useDeferredValue 与慢列表（2.5 分）

```tsx
function App() {
  const [text, setText] = useState('')
  const deferredText = useDeferredValue(text)

  return (
    <>
      <input value={text} onChange={e => setText(e.target.value)} />
      <p>{text !== deferredText ? '更新中…' : ''}</p>
      <SlowList text={deferredText} />
    </>
  )
}

function SlowList({ text }: { text: string }) {
  // 渲染 2000 个条目，计算量很大
  return <ul>{/* ... */}</ul>
}
```

1. 用户输入 `a`，紧接着又输入 `b`。描述从第一次按键到界面稳定的渲染过程：紧急 render 中 `text` 和 `deferredText` 各是什么？`SlowList` 收到什么值？后台 render 何时开始、用什么值？如果用户继续输入，后台 render 会怎样？`text !== deferredText` 在这期间表示什么？
2. 当前 `SlowList` 的写法下，`useDeferredValue` 还能让输入保持流畅吗？为什么？正确做法是什么？如果 `SlowList` 内部直接读取 `text`，或者写成 `useDeferredValue({ q: text })`，分别会发生什么？
3. 把 `SlowList` 放进 `<Suspense fallback={<Spinner />}>`。后台 render 因新值挂起时，用户会看到 Spinner 还是旧列表？为什么？`useDeferredValue` 会减少网络请求次数吗？它和 debounce/throttle 的核心区别是什么？在哪些情况下不适合用它？

**你的答案：**


## 第 3 题：Activity 与标签页（2.5 分）

```tsx
import { Activity, useEffect, useState } from 'react'

function App() {
  const [tab, setTab] = useState<'home' | 'video'>('home')

  return (
    <>
      <button onClick={() => setTab('home')}>Home</button>
      <button onClick={() => setTab('video')}>Video</button>

      <Activity mode={tab === 'home' ? 'visible' : 'hidden'}>
        <Home />
      </Activity>
      <Activity mode={tab === 'video' ? 'visible' : 'hidden'}>
        <Video />
      </Activity>
    </>
  )
}

function Home() {
  const [draft, setDraft] = useState('')
  useEffect(() => {
    const sub = subscribeFeed()
    console.log('subscribe')
    return () => {
      sub.unsubscribe()
      console.log('unsubscribe')
    }
  }, [])

  return (
    <textarea
      value={draft}
      onChange={e => setDraft(e.target.value)}
      placeholder="草稿"
    />
  )
}

function Video() {
  return <video src="/cat.mp4" autoPlay loop controls />
}
```

忽略 StrictMode 的额外 setup/cleanup 演练。

1. 首次渲染时 `tab = 'home'`。`Video` 的子树会不会被 render？它的 DOM 会不会存在？`Home` 和 `Video` 的 Effects 分别会不会执行？如果 `Video` 用 `use()` 读取一个按组件缓存的 `fetchVideo()` promise（假设外层有 Suspense 边界），或者用 `useEffect` 取数，隐藏预渲染期间哪一个会提前发请求？之后切到 `video` 时，`Video` 的 state、DOM 和 Effects 分别怎样？
2. 在 Home 的 textarea 输入 `hello`，切到 video，再切回 home。textarea 显示什么？按时间顺序写出 `subscribe` / `unsubscribe` 日志。DOM 节点是否被销毁重建？与 `{tab === 'home' && <Home />}` 的条件渲染相比，state 和 Effects 的行为有什么不同？
3. 在 Video 播放时切回 Home（Video 被隐藏），视频/音频是否继续播放？为什么？如何修复？Activity 隐藏时，React 对子组件的 Effects 做了什么？如果组件把清理逻辑写在 Effect 的 setup 里而不是返回的 cleanup 里，会出什么问题？
4. 如果 hidden 的 Activity 子树只返回字符串 `Hello`，DOM 里会有什么？为什么？隐藏期间子组件还会不会因为父组件传入新 props 而重新渲染？优先级如何？

**你的答案：**
