# W4D4 课前测验：React 19.3 新特性与排查

先独立作答，不查资料、不运行代码；把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W4D4.md`，做完前不要打开。

本卷共 9 分：2 道复习题（各 0.5 分），3 道新主题题（3 + 2.5 + 2.5 分）。以 React 19.3.1 为准；`<ViewTransition>`、`<Fragment ref>`、`addTransitionType` 都从 `react` 导入，`FragmentInstance` 的 DOM 能力由 react-dom 提供。jsdom 没有 `document.startViewTransition`，测试题不要假设真实动画会执行。

## 复习 1：Transition 与输入响应性（0.5 分｜来自 W3D2）

```tsx
function Search() {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const deferredQuery = useDeferredValue(query)

  function onChange(next: string) {
    setQuery(next) // 紧急更新输入框
    startTransition(() => {
      // 假设这里触发一个昂贵的远程搜索
    })
  }

  return (
    <>
      <input value={query} onChange={(e) => onChange(e.target.value)} />
      {isPending ? <p>搜索中…</p> : null}
      <Results query={deferredQuery} />
    </>
  )
}
```

1. 用户每敲一个字符时，哪些更新是紧急的、哪些是 Transition？为什么输入框不会被慢搜索卡住？
2. `deferredQuery` 和 `isPending` 分别表达什么？如果结果列表读取的是 `query` 而不是 `deferredQuery`，会发生什么？
3. `useDeferredValue` 与 debounce 的区别是什么？这道题里是否还需要 debounce？

**你的答案：**

## 复习 2：Profiler 数字与 memo 边界（0.5 分｜来自 W3D3）

`Chart` 已用 `memo` 包裹。用户在同一个页面里输入备注时，Profiler 记录：

```text
{ id: 'chart', phase: 'update', actualDuration: 118.4, baseDuration: 121.0 }
```

1. `actualDuration` 与 `baseDuration` 分别是什么？这组数字说明 `Chart` 这次是否被 memo 跳过？为什么？
2. 父组件里 `Chart` 的 props 是 `data={data}`、`options={{ animate: true }}`、`onSelect={id => ...}`。请指出至少一个击穿 memo 的 prop，并给出两种不同层级的修法。

**你的答案：**

## 第 1 题：ViewTransition 的触发、语义与降级（3 分）

### A. 为什么没有动画

```tsx
import { ViewTransition, useState } from 'react'

function Panel() {
  const [tab, setTab] = useState<'a' | 'b'>('a')
  const [show, setShow] = useState(true)

  return (
    <section>
      <button onClick={() => setTab(tab === 'a' ? 'b' : 'a')}>切换内容</button>
      <button onClick={() => setShow(!show)}>切换显示</button>

      {show && (
        <div>
          <ViewTransition name="panel" default="none" enter="panel-in" exit="panel-out">
            <article>{tab === 'a' ? 'A 面板' : 'B 面板'}</article>
          </ViewTransition>
        </div>
      )}
    </section>
  )
}
```

1. “切换内容”和“切换显示”分别会触发哪种 View Transition 类型？在真实浏览器里，这段代码为什么可能一个动画都看不到？至少指出三个原因（提示：更新语义、DOM 位置、class props）。
2. 给出修复后的关键代码：如何让“切换内容”走 update 动画、让“切换显示”走 enter/exit，并保证 `<ViewTransition>` 的位置允许 enter/exit 激活。

### B. 类型、name 与 class

1. 分别解释 enter、exit、update、share 的触发条件；share 与 enter/exit 谁优先？
2. 为什么普通场景不应该随手给 `name` 赋值？什么场景必须用 `name`？同一个 name 同时挂载两份会怎样？
3. `enter`、`exit`、`update`、`share`、`default` 这些 class prop 接受哪些值？写出一个按 `addTransitionType('next' | 'previous')` 选择不同 class 的 `<ViewTransition>`；`addTransitionType` 应该在哪里调用？

### C. 生命周期、Suspense / Activity 与浏览器降级

1. 描述 React 从提交到动画大致做了什么：何时调用 `document.startViewTransition`、update 回调里做什么、`onEnter` 等事件在什么时机触发。为什么业务代码不应该自己调用 `document.startViewTransition`？
2. `<ViewTransition>` 包在 `<Suspense>` 外和包在 Suspense 内部，fallback → 内容时分别更可能触发 update 还是 enter/exit？React 会等待字体/图片多久？
3. `<Activity>` 在 Transition 中从 hidden 变 visible / 从 visible 变 hidden 时，内部 `<ViewTransition>` 分别触发什么？隐藏期间 FragmentInstance 加的事件监听器会怎样？
4. 浏览器没有 View Transition API 时，React 19.3 的行为是什么？`prefers-reduced-motion` 需要谁处理？

### D. 测试

在 jsdom 中测试一个使用 `<ViewTransition>` 的切换组件时，为什么不能断言动画时长或伪元素样式？可以稳定断言哪些东西？如果 mock `document.startViewTransition`，mock 至少需要提供哪些字段/行为？

**你的答案：**

## 第 2 题：Fragment ref 与 FragmentInstance（2.5 分）

### A. 去掉包裹节点

```tsx
import { useRef } from 'react'

function Toolbar() {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} className="toolbar">
      <button>保存</button>
      <div className="primary">
        <button>发布</button>
      </div>
      <button>取消</button>
    </div>
  )
}
```

1. 改用 `<Fragment ref>` 重写，使 DOM 中不再有 `.toolbar` 包裹层。写出关键代码，并说明 `ref.current` 的类型是什么、为什么不能用 `<>...</>` 简写。
2. 重写后，`ref.current.focus()`、`ref.current.focusLast()`、`ref.current.blur()` 分别会作用于哪个按钮？它们搜索的是第一级子节点还是所有嵌套节点？
3. `ref.current.addEventListener('click', handler)` 会监听哪些元素？点击“发布”会触发吗？`ref.current.getClientRects()` 返回什么范围？在 jsdom 里为什么不能依赖它的长度？
4. 写出一个在 Fragment 上使用 `IntersectionObserver` 的 Effect 骨架（包括 cleanup），并说明 `observeUsing` 与 `unobserveUsing` 的目标范围。

### B. 能力与边界

1. 列出 `FragmentInstance` 至少六个真实方法/能力，并说明哪些是第一级 DOM 子节点范围、哪些是深度优先。
2. 下面说法哪些错误？分别说明原因：
   - “FragmentInstance 是 Element，可以用 `ref.current.style`。”
   - “`focusLast()` 会聚焦 Fragment 里最后一个 DOM 节点，哪怕它不可聚焦。”
   - “`scrollIntoView({ behavior: 'smooth' })` 和 Element 的同名方法一样。”
   - “在隐藏的 `<Activity>` 里通过 FragmentInstance 加的监听器仍然立即生效。”
   - “`compareDocumentPosition` 在本机类型和运行时都完整可用。”
3. 什么场景适合用 Fragment ref，而不是加一个 `display: contents` 的 wrapper？Fragment ref 不能替代哪些 DOM 能力？

**你的答案：**

## 第 3 题：Hydration mismatch 的定位与修复（2.5 分）

### A. 读 diff

项目使用 `renderToString` + `hydrateRoot`。开发环境出现：

```text
Hydration failed because the server rendered text didn't match the client.
...
  <TicketBadge>
    <span data-testid="ticket">
+     k3x9qa
-     p2m8fd
```

1. `+` 和 `-` 分别代表什么？最可能出问题的组件是哪个？
2. 给出这段代码最可能的一种错误实现，并说明为什么服务端和客户端会得到不同文本。
3. 用 React 19.3 中合适的 API 修复它；这个 API 是否适合生成业务订单号/数据库 id？为什么？
4. 生产环境看不到这段 diff 时，你会从哪里拿到可观测信息？给出 `hydrateRoot` 的错误回调配置。

### B. 原因与修法

下面四个片段都会导致或可能导致 hydration mismatch。分别指出原因，并给出一个正确修法：

```tsx
// B1
function Banner() {
  return <p><strong>限时优惠</strong><div>立减 20 元</div></p>
}

// B2
function Clock() {
  return <time>{new Date().toLocaleTimeString()}</time>
}

// B3
function Width() {
  const [width, setWidth] = useState(window.innerWidth)
  return <span>{width}</span>
}

// B4
function Ticket() {
  const [id] = useState(() => Math.random().toString(36).slice(2))
  return <span>{id}</span>
}
```

1. 对每个片段说明 mismatch 的直接原因；B1 为什么即使 `renderToString` 没报错也可能失败？
2. 分别给出修法；B2/B3 至少给出两种不同层级的方案（例如服务端快照、Effect 后更新、`useSyncExternalStore`、`use(browser())`）。
3. `suppressHydrationWarning={true}` 能修 B1 吗？它到底静默了什么、不能做什么？

### C. 工具与取舍

1. `onRecoverableError`、`onCaughtError`、`onUncaughtError` 的区别是什么？hydration mismatch 通常走哪条？React “恢复”后用户可能观察到什么？
2. 页面只在客户端显示时区，且该组件必须在服务端输出 fallback。React 19.3 的 `browser()` 怎么用？它和“Effect 后显示”有什么区别？
3. 排查 hydration 问题时，为什么不能只看 `renderToString` 的字符串是否“看起来合法”？给出你的排查顺序。

**你的答案：**
