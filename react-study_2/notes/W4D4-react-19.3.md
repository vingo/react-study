# W4D4：React 19.3 新特性与排查

> 以本机 React 19.3.1、react-dom 19.3.1、@types/react 19.3.0、@types/react-dom 19.3.0 为准。承接 [W3D2](W3D2-concurrent-rendering.md) 的 Transition、[W3D3](W3D3-performance-compiler.md) 的测量习惯和 [W3D4](W3D4-testing.md) 的真实渲染测试。React 19.3 把 View Transitions 与 Fragment Refs 转为稳定 API，并新增 `browser()`；本课也复习 hydration 报错的定位方式。

## 1. 一句话结论

React 19.3 把“浏览器原生的过渡与 DOM 组操作”包成了声明式 API：`<ViewTransition>` 只在 Transition 提交时让浏览器拍快照并播放 enter/exit/update/share，`<Fragment ref>` 用一个 `FragmentInstance` 操作一组没有共同父节点的兄弟 DOM；而 hydration 的第一原则仍是“服务端 HTML 与客户端首次 render 必须一致”，React 19 的单条 `+/-` diff 是定位不一致节点的入口，不是可以靠 `suppressHydrationWarning` 绕过的警告。

## 2. 心智模型

```text
一次交互的三种“时间尺度”
  紧急更新（普通 setState / flushSync）
    → 立即提交，DOM 马上变；ViewTransition 主动退出，不拍快照
  Transition（startTransition / useDeferredValue / Suspense reveal / Activity）
    → 可中断、可延后；提交时 React 才调用 document.startViewTransition
    → 浏览器拍旧/新快照，React 在 updateCallback 里改 DOM、测量、触发事件
  动画本身
    → 浏览器 View Transition API 负责伪元素与插值；JS 只提供 class / 事件钩子

ViewTransition 的四个触发面
  enter   边界从无到有（且它必须是所在子树里第一个节点）
  exit    边界从有到无
  update  边界内部 DOM 变化，或相邻兄弟导致边界尺寸/位置变化
  share   同一个 name 在一个 Transition 里“这边卸载、那边挂载”，优先于 enter/exit

Fragment ref 的视角
  <Fragment ref> 不是 Element，而是一个“组句柄”：
    第一级 DOM 子节点  ← addEventListener / observeUsing / getClientRects
    所有嵌套可聚焦节点 ← focus / focusLast（深度优先）
  它补的是“没有单一父节点可挂 ref”的空缺，不是新的 DOM 容器

hydration 的视角
  server:  renderToString / renderToPipeableStream → HTML 字符串
  browser: HTML 先被浏览器解析（可能修正非法嵌套）
  client:  hydrateRoot 用同一棵 React 树“认领”现有 DOM
           一致 → 只绑定事件、恢复状态
           不一致 → 开发环境打印 +/- diff；生产环境整棵子树客户端重渲染
```

## 3. 要点

### 3.1 `<ViewTransition>`：声明式边界，不是 CSS 动画库

- React 19.3 已从 `react` 正式导出 `ViewTransition`。它包住一棵组件树，由 React 决定何时让这棵树的 DOM 参与浏览器 View Transition。
- 它不改变 DOM 结构，也不是给每个子元素做 Layout Animation；浏览器把边界当成一张可移动、缩放、交叉淡入的“图”。内部元素不会各自补间，必要时你要自己加更多 `<ViewTransition>` 边界。
- `name` 只用于共享元素过渡；普通 enter/exit/update 不要手写 name，React 会自动生成唯一 name，避免意外的跨边界动画。
- 目前只在 DOM 渲染器生效，不支持 React Native。

```tsx
import { ViewTransition, useState, startTransition } from 'react'

function Panel({ id }: { id: string }) {
  return (
    <ViewTransition
      default="none"
      enter="panel-enter"
      exit="panel-exit"
      update="panel-update"
    >
      <article data-id={id}>面板 {id}</article>
    </ViewTransition>
  )
}

function App() {
  const [id, setId] = useState('a')
  return (
    <>
      <button
        onClick={() =>
          startTransition(() => setId((current) => (current === 'a' ? 'b' : 'a')))
        }
      >
        切换
      </button>
      <Panel id={id} />
    </>
  )
}
```

上面的 `update` 会在 `id` 变化时生效；如果把 `setId` 写成普通同步调用，React 会把这次更新当作紧急更新，DOM 立即提交，`<ViewTransition>` 不激活。

### 3.2 触发条件、生命周期与浏览器降级

**只有 Transition 语义的提交才会动画。** 官方列出的触发源包括：

- `startTransition` 内的 state 更新；
- `useDeferredValue` 引发的延迟更新；
- `<Suspense>` 从 fallback 揭示内容；
- `<Activity>` 在 Transition 中切换 visible/hidden；
- Action / 导航等同属 Transition 的更新。

普通 `setState`、`flushSync`、同步事件里的更新不会动画。`flushSync` 如果插进正在准备的 View Transition，React 会跳过这次动画以保住同步语义。

React 的内部顺序大致是：

1. 在 `getSnapshotBeforeUpdate` 前后准备 `view-transition-name`；
2. 调用 `document.startViewTransition({ update, types })`；
3. 在 `update` 回调里改 DOM、跑 `useInsertionEffect`、等字体、跑 layout effect 与 ref、等导航、测量布局；
4. `ready` 之后恢复 `view-transition-name`，再调用 `onEnter` / `onExit` / `onUpdate` / `onShare`；
5. `finished` 之后再跑普通 `useEffect`，避免 Effect 干扰动画。

**不要自己调用 `document.startViewTransition`。** React 会在内部协调多个过渡：前一个没结束就来的更新会被合并，React 还会中断页面上其它非 React 发起的过渡。手写会与 React 的协调打架。

**降级：** 浏览器没有 `document.startViewTransition` 时，React 19.3.1 的运行时会捕获调用异常并继续提交 DOM，只是没有动画（本机 jsdom 实测；官方文档只说明底层使用浏览器 View Transition API）。因此功能不能依赖动画回调是否执行；`prefers-reduced-motion` 也要自己用 CSS 处理，React 不会自动关闭动画。

### 3.3 name、class、事件，以及与 Suspense / Activity 的配合

**class props**：`default`、`enter`、`exit`、`update`、`share` 都可以是：

- `"auto"`：浏览器默认交叉淡入；
- `"none"`：关闭该类动画；
- 一个 class 字符串：React 在边界参与动画时把它写进子元素的 `view-transition-class`；
- 一个对象：按 `addTransitionType` 的类型选择，`{ next: 'slide-left', default: 'fade' }`。

`default="none"` 会关闭没有显式列出的触发类型，适合“只给 enter 做动画”的精确场景。样式用 `::view-transition-group(.slide-left)`、`::view-transition-old(...)`、`::view-transition-new(...)` 等伪元素选择器来写。

```tsx
import { addTransitionType, startTransition, ViewTransition } from 'react'

function next() {
  startTransition(() => {
    addTransitionType('next')
    setIndex((i) => i + 1)
  })
}

<ViewTransition
  name="cover"
  default="none"
  enter={{ next: 'from-right', previous: 'from-left', default: 'fade' }}
  exit={{ next: 'to-left', previous: 'to-right', default: 'fade' }}
  update="cross-fade"
>
  <Cover index={index} />
</ViewTransition>
```

`addTransitionType` 必须在同一个 Transition 作用域内、setState 之前调用。类型会进入事件参数的 `types` 数组，也会成为浏览器 view transition type，可在 CSS 中用 `:active-view-transition-type(next)` 限定。

**name 与 share：** 当一个 Transition 里同一 name 的边界一边卸载、另一边挂载，React 触发 share，并从旧位置动到新位置。share 优先于 enter/exit。name 必须在同一时刻全局唯一；重复挂载会报 “There are two `<ViewTransition name=...>` components with the same name mounted at the same time”。列表项要用 `item-${id}` 这类带 id 的 name。

**事件：** `onEnter` / `onExit` / `onUpdate` / `onShare` 接收 `(instance, types)`。`instance` 提供 `name`、`group`、`imagePair`、`old`、`new`；伪元素对象有 `animate` / `getAnimations` / `getComputedStyle`，可用 Web Animations API 手动控制。每个事件应返回 cleanup，在过渡结束时取消动画。

```tsx
<ViewTransition
  onEnter={(instance, types) => {
    const animation = instance.new.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'ease-out' },
    )
    return () => animation.cancel()
  }}
>
  <Card />
</ViewTransition>
```

**Suspense：** `<ViewTransition>` 包在 `<Suspense>` 外面时，fallback → 内容的切换通常算 update；包在 fallback/内容内部时，进入/离开的边界可能算 enter/exit。React 会等数据、样式、字体与可见图片（最多 500ms）再开始动画，避免内容在动画中途闪现。若一个 Transition 先卸载旧内容、再显示 fallback、最后才挂载同名新内容，则不会形成 share。

**Activity：** `<Activity mode="hidden">` 会保留 state、销毁 Effect、用 `display:none` 隐藏；在 Transition 中切到 visible/hidden，会分别触发内部 `<ViewTransition>` 的 enter/exit。隐藏的 Activity 中通过 FragmentInstance 添加的监听器不会生效，恢复可见时 React 会自动补上。

**嵌套与位置：** 内层 `<ViewTransition>` 的 DOM 变化优先归内层；只有位于任何 DOM 节点之前、且是所在子树第一个节点的边界，才在挂载/卸载时触发 enter/exit。把 `<ViewTransition>` 放在一个 `<div>` 后面，enter/exit 不会触发。

### 3.4 Fragment refs：没有包裹节点的“组句柄”

问题场景：一个组件返回三个兄弟按钮、一个列表的多个标题，或第三方组件不转发 ref。为了拿 ref 而加 `<div>` 可能破坏 flex/grid 布局、语义或样式；改第三方组件又不现实。

React 19.3 允许把 ref 传给显式的 `<Fragment>`：

```tsx
import { Fragment, useRef } from 'react'
import type { FragmentInstance } from 'react'

function Actions() {
  const actionsRef = useRef<FragmentInstance | null>(null)

  return (
    <>
      <button onClick={() => actionsRef.current?.focus()}>聚焦第一个</button>
      <button onClick={() => actionsRef.current?.focusLast()}>聚焦最后一个</button>
      <button onClick={() => actionsRef.current?.blur()}>清除焦点</button>

      <Fragment ref={actionsRef}>
        <button>保存</button>
        <button>发布</button>
        <button>取消</button>
      </Fragment>
    </>
  )
}
```

`<>...</>` 简写不接受 ref，必须 `import { Fragment }` 后写 `<Fragment ref={...}>`。ref 可以是对象 ref，也可以是 callback ref。

本机 19.3.1 运行时与类型（`@types/react-dom` 增强 `FragmentInstance`）提供：

| 能力 | 方法 | 作用范围 |
|---|---|---|
| 焦点 | `focus(options?)`、`focusLast(options?)`、`blur()` | 所有嵌套可聚焦节点，深度优先 |
| 事件 | `addEventListener`、`removeEventListener`、`dispatchEvent` | 第一级 DOM 子节点 |
| 观察 | `observeUsing(observer)`、`unobserveUsing(observer)` | 第一级 DOM 子节点 |
| 几何 | `getClientRects()`、`getRootNode()`、`scrollIntoView(alignToTop?)` | 第一级 DOM 子节点 / 父根节点 |
| 位置 | `compareDocumentPosition(other)`（运行时存在） | 片段与另一个节点 |

注意：`compareDocumentPosition` 在 react-dom 19.3.1 运行时存在，但本机 `@types/react-dom@19.3.0` 的 `FragmentInstance` 接口尚未声明它；写代码时以类型为准，或自行做最小声明并注明版本差异。`scrollIntoView` 只接受布尔值，传 `{ behavior: 'smooth' }` 会抛错，这与 Element 的同名方法不同。

`focus()` 会穿透嵌套 DOM，找到第一个可聚焦元素；`focusLast()` 反向找最后一个；`blur()` 只在当前 activeElement 位于片段内时才清除焦点。`addEventListener` / `observeUsing` 不会把监听器加到嵌套 DOM 的每一层，而是加到“第一层宿主节点”上：组件边界会被穿透，但遇到第一个真实 DOM 元素就停。

```tsx
<Fragment ref={ref}>
  <div id="A"><button>A 内部按钮</button></div> {/* 第一级：div#A */}
  <Wrapper><div id="B" /></Wrapper>             {/* 第一级：div#B */}
  <div id="D" />                                 {/* 第一级：div#D */}
</Fragment>
```

`ref.current.addEventListener('click', fn)` 监听 A、B、D；点击“A 内部按钮”会冒泡到 A 上的原生监听器。`focus()` 则能直接聚焦“A 内部按钮”。这就是“事件/观察看第一级、焦点看整棵嵌套树”的差别。

**适用场景：**

- 一组没有共同父节点的控件统一聚焦、失焦、滚动；
- 给第三方组件的多个根节点加原生事件，而不改它的 API；
- 用 IntersectionObserver / ResizeObserver 观察一组兄弟节点；
- 测量一组节点的 client rects、判断片段与其它节点的文档位置。

**限制与陷阱：**

- 它不是 Element：没有 `style`、`className`、完整 `querySelector`；能力就是上表这些。
- `getClientRects` 在 jsdom 没有布局，通常返回空数组；测试只验证可调用性。
- 纯文本子节点不能 `observeUsing`，开发环境会警告；`getClientRects` 等几何方法依赖真实布局。
- 隐藏的 `<Activity>` 中监听器不会挂载，恢复可见后才生效。
- 第一级子节点动态增删时 React 会自动维护监听器/observer，不需要你手动重挂。

### 3.5 hydration mismatch：先读 React 19 的 diff

`hydrateRoot(domNode, reactNode, options?)` 用客户端的 React 树“认领”服务端已经输出的 HTML。它期望两棵树一致；一致时只绑定事件、恢复状态，不重建 DOM；不一致时开发环境会警告，生产环境则可能把整棵子树退化成客户端渲染。

React 19 把过去多条模糊警告合并成一条带 diff 的错误，形如：

```text
Hydration failed because the server rendered text didn't match the client.
...
https://react.dev/link/hydration-mismatch

  <TicketBadge>
    <span data-testid="ticket">
+     client-value
-     server-value
```

`+` 是客户端首次 render 的内容，`-` 是服务端 HTML 的内容；组件栈指出最近的边界。生产环境只保留 minified error #418，完整 diff 只在开发构建出现。

常见原因可以按“服务端与客户端看到了什么不同”分类：

1. **非法 HTML 嵌套**：`<p><div>`、`<a><button>`、`<tr>` 不在 table section 里、`<ul>` 直接放非 `li`。`renderToString` 可能原样输出，但浏览器解析时会重排，hydrate 必然对不上。
2. **服务端/客户端分支**：`typeof window !== 'undefined'`、`matchMedia`、`localStorage`、`navigator`、时区/语言格式在两边不同。
3. **每次调用都变化的值**：`Date.now()`、`new Date()`、`Math.random()`、随机 id、递增模块计数器。
4. **外部可变数据**：服务端读取数据库/缓存，客户端又读了一次，快照没有随 HTML 传下来。
5. **扩展或第三方脚本注入**：浏览器扩展往 DOM 里塞属性/节点；React 19 对 `<head>` / `<body>` 中意外标签更宽容，但组件树内部被改仍会 mismatch。
6. **`useId` 前缀不一致**：多个 root 或 SSR/hydration 的 `identifierPrefix` 不一致。
7. **客户端首屏读取浏览器 API**：窗口宽度、在线状态、主题偏好等。

### 3.6 定位与修复：让“首次客户端 render”与 HTML 一致

排查顺序：

1. 在开发构建复现，读完整的 `+/-` diff 和组件栈，先锁定最近的组件，不要从页面根开始猜。
2. 把该组件的 `renderToString` 输出与客户端首次 render 的 JSX 对照；必要时临时打印服务端 HTML。
3. 检查非法嵌套：用浏览器的 Elements 面板看解析后的真实 DOM，而不是只看 React 源码。
4. 检查 render 期间是否读了时间、随机数、`window` / `matchMedia` / `localStorage`。
5. 检查服务端与客户端是否用了不同的数据快照、locale、timezone、feature flag。
6. 修复根因，再用真实 `hydrateRoot` 回归；不要先加 `suppressHydrationWarning`。

**修法一：稳定标识用 `useId`。**

```tsx
import { useId } from 'react'

function Field() {
  const id = useId()
  return (
    <>
      <label htmlFor={id}>邮箱</label>
      <input id={id} />
    </>
  )
}
```

`useId` 在服务端与客户端首次 render 生成一致的值；它不是业务随机 ID 生成器，也不应该用来给列表当 key。

**修法二：浏览器专属内容延后到 Effect。**

```tsx
function DateStamp() {
  const [today, setToday] = useState<string | null>(null)

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10))
  }, [])

  return <time dateTime={today ?? undefined}>{today ?? '加载中'}</time>
}
```

服务端和客户端首次 render 都是 `加载中`，hydration 后再显示日期；代价是多一次客户端 render，慢网络下可能看到占位闪烁。

**修法三：外部 store 提供 server snapshot。** 用 `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`，让服务端和 hydration 首屏使用 `getServerSnapshot` 的稳定值，订阅后再切到客户端值。

**修法四：把组件排除出 SSR。** React 19.3 新增 `browser()`：

```tsx
import { use } from 'react'
import { browser } from 'react-dom'

function TimeZone() {
  use(browser())
  return <p>{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
}
```

服务端渲染时它会在最近的 `<Suspense>` 边界挂起，输出 fallback；客户端 hydration 时不挂起，直接渲染。它适合确实无法在服务端产出有意义 UI 的组件，不是所有浏览器 API 的通用免死金牌。

**修法五：只对真正不可避免的单元素差异用 `suppressHydrationWarning`。** 例如服务端时间戳文本；它只静默一层属性/文本差异，React 不会 patch 文本，也不能修复非法嵌套或树结构差异。

**修复非法嵌套：**

```tsx
// ❌ 浏览器会把 div 移出 p，服务端字符串与解析后 DOM 不一致
<p><strong>优惠</strong><div>立减 20 元</div></p>

// ✅ 外层改成 div，或把内层改成 span
<div><strong>优惠</strong><div>立减 20 元</div></div>
```

### 3.7 `onRecoverableError`：把“恢复了”记录下来

`hydrateRoot` 的错误回调有三类：`onCaughtError`（Error Boundary 捕获）、`onUncaughtError`（未捕获）、`onRecoverableError`（React 自动恢复）。hydration mismatch 通常走 `onRecoverableError`：

```tsx
import { hydrateRoot } from 'react-dom/client'

hydrateRoot(container, <App />, {
  onRecoverableError(error, errorInfo) {
    reportToMonitoring({
      type: 'recoverable',
      error,
      componentStack: errorInfo.componentStack,
      cause: (error as Error & { cause?: unknown }).cause,
    })
  },
})
```

要点：

- 它表示 React 已经“兜底”了（例如客户端重新渲染），不代表用户可以忽略；hydration mismatch 往往意味着首屏状态、表单光标或动画起点被重置。
- `errorInfo.componentStack` 是定位组件的主要线索；部分错误的原始原因在 `error.cause`。
- 生产环境默认也会把错误打到 console；接监控时应同时配置 `onCaughtError` / `onUncaughtError`，不要只收 recoverable。
- `hydrateRoot` 还有 `identifierPrefix`（多 root 的 `useId` 前缀，必须与服务端一致）和 `formState`（Server Function 表单回填）等选项。
- 如果在 hydration 完成前调用 `root.render`，React 会清掉服务端 HTML，整棵树转客户端渲染；这不是修复 mismatch 的手段。

### 3.8 简要回顾：Activity 与 useEffectEvent

**`<Activity mode="visible" | "hidden">`**：隐藏时保留 state、销毁 Effect、`display:none`；恢复时用旧 state 重新挂载 Effect。隐藏树仍可能以较低优先级响应 props 更新。它适合侧边栏、预渲染即将出现的内容、保留表单草稿；不要用它代替真正的卸载语义，也不要指望隐藏树的 Effect/订阅继续工作。

**`useEffectEvent(callback)`**：把“只应由 Effect 触发的逻辑”从 Effect 依赖中拆出来。Effect Event 总是读到最新 props/state，但只能从 Effect 或另一个 Effect Event 中调用；它的身份每次 render 都变，不能放进依赖数组、不能传给子组件。它不是“省略依赖”的借口：真正应触发 Effect 的值仍要写进依赖。

这两者与 ViewTransition 的交集是：Activity 的 visible/hidden 若由 Transition 驱动，会激活内部边界的 enter/exit；Effect Event 则常用于过渡结束后的通知/埋点，避免因回调身份变化重跑 Effect。

### 3.9 测试口径：真实 API 与模拟要分清

- **ViewTransition：** jsdom 没有 `document.startViewTransition`。可以 mock 它来观察 React 是否发起过渡、`types` 是什么、`update` 是否被调用；不要断言动画时长、CSS 伪元素或像素结果。React 在缺少 API 时会降级提交，所以“DOM 更新了”不能证明动画生效。
- **Fragment ref：** jsdom 支持 focus/blur/原生事件/受控 observer，可稳定断言 activeElement、监听器目标、observe/unobserve 参数；`getClientRects` 因无布局通常为空，不要断言尺寸。
- **hydration：** 用真实 `renderToString` + `hydrateRoot` + `onRecoverableError`，不要只测一个“诊断函数”。制造可复现差异时，可以 mock 时间/随机数或让非法嵌套自然产生解析差异；断言 recoverable error 与最终 DOM，而不是错误字符串的完整措辞（React 版本会改文案）。
- 测试环境不包 `<StrictMode>` 时，Effect 不会双调用；真实应用仍要按 StrictMode 思考。

## 4. 常见误区

| 错误写法 / 认知 | 正确写法 / 认知 | 原因 |
|---|---|---|
| 用普通 `setState` 包 `<ViewTransition>` 就期待动画 | 把更新放进 `startTransition` / `useDeferredValue` / Suspense reveal | 紧急更新立即提交，ViewTransition 主动退出 |
| 自己调用 `document.startViewTransition` 控制 React 动画 | 让 React 调用；只写 `<ViewTransition>` 和 class/事件 | 手写会打断 React 的过渡协调与合并 |
| 给每个 `<ViewTransition>` 都写 `name` | 只有共享元素过渡才写唯一 name，其余自动生成 | 重复 name 会报错；手写 name 容易产生意外动画 |
| `<div><ViewTransition>...</ViewTransition></div>` | `<ViewTransition>` 放在子树最前面 | 前面有 DOM 节点时 enter/exit 不触发 |
| 认为 `default="none"` 会关闭全部动画 | 它关闭未显式列出的类型；显式 enter/exit/update 仍生效 | 文档明确的 class 组合语义 |
| 认为 ViewTransition 会逐个子元素补间 | 边界整体作为一张图移动/缩放/交叉淡入 | 需要更细的动效就加更多边界 |
| 依赖动画回调更新业务状态 | 业务状态在事件/Effect 中更新；动画回调只做表现层 | 不支持 API、`prefers-reduced-motion`、跳过动画时回调不会按预期执行 |
| 用 `<Fragment ref>` 的 `<>...</>` 简写 | `import { Fragment }` 后写 `<Fragment ref>` | 简写不接受 ref |
| 认为 `FragmentInstance` 是 Element | 只用它声明的方法；需要样式/查询就改用真实 DOM 或重构 | 它是受限句柄，不是 DOM 节点 |
| 认为 `addEventListener` 会监听所有嵌套节点 | 只作用于第一级 DOM 子节点；嵌套点击靠冒泡 | `focus` 才是深度优先 |
| 给 `scrollIntoView({ behavior: 'smooth' })` | 传 `true` / `false` | FragmentInstance 的实现不接受 options 对象 |
| 用 `Math.random()` / `new Date()` 生成首屏内容 | `useId`、服务端快照、Effect 后更新、`browser()` | 服务端与客户端首次 render 必然可能不同 |
| 用 `suppressHydrationWarning` 压掉结构 mismatch | 修非法嵌套/分支/数据快照 | 它只静默单层文本/属性，不 patch，也不修树结构 |
| 认为 `renderToString` 没报错就没有 hydration 问题 | 用真实浏览器解析 + `hydrateRoot` 验证 | 浏览器会修正非法 HTML，字符串本身可能“看起来正常” |
| 只接 `onRecoverableError` 就以为覆盖所有错误 | 同时配置 `onCaughtError` / `onUncaughtError` | 三类错误走不同路径 |
| 用 `root.render` 抢在 hydration 前“修复”内容 | 让首屏一致，hydration 后再更新 | 会清空服务端 HTML，退化为整树客户端渲染 |
| 在测试里断言动画毫秒数/伪元素样式 | 断言 DOM、调用参数、types、class/name 内联样式 | jsdom 无布局与 View Transition 渲染 |

## 5. 面试口径

**问：`<ViewTransition>` 什么时候会动？为什么我包了却没动画？**

答：它只对 Transition 语义的提交生效，例如 `startTransition`、`useDeferredValue`、Suspense reveal、Activity 在 Transition 中切换。普通 `setState` 是紧急更新，不会动画。还要检查边界是否位于子树最前面、是否真的发生了 enter/exit/update/share，以及浏览器是否支持 View Transition API；不支持时 React 会降级为普通提交。不要手写 `startViewTransition`。

**问：enter、exit、update、share 的区别？name 和 class props 怎么用？**

答：enter 是边界挂载，exit 是卸载，update 是边界内部 DOM 或尺寸/位置变化，share 是同一 Transition 里同 name 的旧边界卸载、新边界挂载，share 优先于 enter/exit。name 只用于 share，必须全局唯一，否则报重复 name。class props 接受 `auto`、`none`、class 字符串或按 transition type 映射的对象；React 在动画期间把 class 写到子元素的 `view-transition-class`，用 `::view-transition-*` 伪元素选择器写 CSS。

**问：Fragment ref 解决什么问题？它和给 div 加 ref 有什么不同？**

答：它给“一组没有共同父节点的兄弟 DOM”一个 `FragmentInstance`，不引入包裹节点，也不要求子组件转发 ref。`focus`/`focusLast`/`blur` 深度优先管理嵌套焦点；`addEventListener`/`observeUsing`/`getClientRects` 只作用于第一级 DOM 子节点。它不是 Element，没有完整 DOM API；`scrollIntoView` 只收布尔值。用 `<Fragment ref>` 时必须显式导入，不能用 `<>` 简写。

**问：线上报 hydration mismatch，你怎么定位？**

答：先在开发构建读 React 19 的单条 diff：`+` 是客户端、`-` 是服务端，组件栈指向最近边界；生产只有 #418，所以要用 `onRecoverableError` 上报 `componentStack`。然后检查非法 HTML 嵌套、服务端/客户端分支、Date/random/locale、外部数据快照、扩展注入、useId 前缀。修复原则是让客户端首次 render 与服务端 HTML 一致：useId、服务端快照、Effect 后更新、`useSyncExternalStore` 的 server snapshot，必要时 `use(browser())`。`suppressHydrationWarning` 只用于确实无法避免的单元素差异，不是结构修复。

## 6. 延伸阅读

- https://react.dev/reference/react/ViewTransition
- https://react.dev/reference/react/addTransitionType
- https://react.dev/reference/react/Fragment
- https://react.dev/reference/react/Activity
- https://react.dev/reference/react/useEffectEvent
- https://react.dev/reference/react-dom/client/hydrateRoot
- https://react.dev/errors/418
- https://react.dev/blog/2026/09/09/react-19-3
- https://react.dev/blog/2024/12/05/react-19#diffs-for-hydration-errors
- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
