# W2D2：Suspense 与 use()

> 以 React 19.3 为准。Suspense 只负责“渲染期等待”，不负责发请求、缓存、取消或重试。客户端手写数据层用于理解和小项目；生产优先 TanStack Query（W2D3）。与 [W2D1](W2D1-actions-forms.md) 的分工：Suspense 处理“渲染时要读的数据”，表单提交的 pending 用 `useFormStatus` / `useActionState`。

## 1. 一句话结论

组件在 render 中用 `use(缓存好的 promise)` 读取异步数据；promise 未就绪时把它抛给最近的 `<Suspense>` 显示 fallback，resolve 后 React 从头重试渲染，reject 则抛给最近的 Error Boundary 而不是 fallback。

## 2. 心智模型

```text
                      render 期间
用户 / 路由 / 父组件 ──► <Albums />
                          │ const data = use(promise)
                          │
                ┌─────────┴──────────┐
                │ pending            │ fulfilled
                ▼                    ▼
          抛出 promise          返回 data，继续 render
                │
                ▼
   最近的 <Suspense fallback> 显示 fallback
                │ promise resolve
                ▼
  React 从头重试这棵挂起的子树（不是“恢复现场”）
                │
                └─ reject → 最近的 <ErrorBoundary> 显示错误 UI
```

三个关键词：**抛**（`use` 在 pending 时抛 promise）、**接**（最近边界显示 fallback）、**重试**（resolve 后从头 render）。Suspense 是 render 的“等待 / 捕获”机制，不是请求库；`use` 像 render 里的 `await`，但组件本身不是 async 函数。

## 3. 要点

### 3.1 Suspense 的机制：抛 promise、边界接住、resolve 后重试

```tsx
import { Suspense, use } from 'react'

function Albums({ albumsPromise }: { albumsPromise: Promise<Album[]> }) {
  const albums = use(albumsPromise) // 未就绪：抛出 promise
  return <ul>{albums.map(a => <li key={a.id}>{a.title}</li>)}</ul>
}

export default function App({ albumsPromise }: Props) {
  return (
    <Suspense fallback={<p role="status">加载中…</p>}>
      <Albums albumsPromise={albumsPromise} />
    </Suspense>
  )
}
```

**为什么 fallback 不是普通 loading 分支？** 因为这次 render 被中断了，没有 commit；React 不会先渲染一个“loading 组件”再替换，而是直接丢弃这次 render，显示边界自己的 fallback。promise resolve 后，React 重新执行被挂起的子树，而不是从 `use` 那一行继续执行。因此 render 必须纯：挂起前不能做请求、写 storage 等副作用（见 [W1D1 渲染模型](W1D1-render-model.md)）。

首次挂载与更新的差异：

- **首次挂载**：边界内子树尚未 commit，挂起前创建的 state 不会保留；重试时重新初始化。边界外已挂载的祖先 state 不受影响。
- **更新**：如果边界已经在显示内容，新的 render 又挂起，**默认会再次显示 fallback**；如果这次更新由 `startTransition` 或 `useDeferredValue` 触发，React 会保留旧内容，等新内容就绪再切换。
- **批量揭示**：React 对已就绪内容的揭示最多每 300ms 一次，同一窗口内就绪的多个边界会一起出现。
- **fallback 自己挂起**：交给最近的父级 Suspense 边界。
- **感知范围**：Suspense 不会感知 Effect 或事件处理函数里的 `fetch`；只有 `use`、`lazy`、流式数据等 **render 期**挂起会激活它（见 [W1D3 Effect](W1D3-effects.md)）。

### 3.2 `use(promise)`：render 期读取，可条件调用，但不是 Hook

```tsx
function Profile({ userPromise, showBio }: Props) {
  const user = use(userPromise)
  if (!showBio) return <h1>{user.name}</h1>
  const bio = use(user.bioPromise) // ✓ 条件调用：use 不是 Hook
  return <><h1>{user.name}</h1><p>{bio}</p></>
}
```

**为什么可以条件调用？** `use` 不依赖 Hook 的调用顺序，所以能放在 `if`、循环和提前 return 之后；“只有展开详情才加载详情”因此很自然。但它仍然是 **render 期 API**：

- 只能在组件或 Hook 的渲染期间调用。事件处理函数里不允许，因为那时没有正在进行、可被 Suspense 接住的 render；应该在事件里取得 / 创建并缓存 promise，让下一次 render 的 `use` 去读。
- 不能包在 `try/catch` 里。`use` 内部靠抛异常来挂起，`try/catch` 会吞掉 Suspense 信号，开发期常见报错是 “Suspense Exception: This is not a real error!”。错误应交给 Error Boundary。
- `use` 不会替你发请求、去重或缓存；它只读取你给的 promise。它也能读 Context，这里只讲 promise 用法。

### 3.3 promise 必须稳定：在 render 中新建会反复挂起

```tsx
// ✗ 每次 render 都新建 promise
function BadAlbums({ query }: { query: string }) {
  const albums = use(fetch(`/api/albums?q=${query}`).then(r => r.json()))
  return <List albums={albums} />
}

// ✓ promise 来自按参数缓存的函数（见 3.4）
function GoodAlbums({ query }: { query: string }) {
  const albums = use(getAlbums(query))
  return <List albums={albums} />
}
```

**为什么会反复挂起甚至死循环？** 时序是：

```text
render → fetch() 新 P1 → use(P1) 挂起 → P1 resolve → React 从头 render
       → fetch() 又新 P2 → use(P2) 挂起 → P2 resolve → 又新 P3 → …
```

每次重试都是“从头 render”，所以 render 里的 `fetch()`、`async () => ...`、`.then()` 都会产生新 promise。官方文档明确：在 render 中新建 promise 会导致 fallback 反复出现、内容永远显示不出来；开发期还可能看到 “A component was suspended by an uncached promise” 警告。React 不会跨 render 比较或缓存 promise，**缓存是你或数据层的责任**。

正确做法：promise 在 render 外创建（事件处理函数、路由 loader、Server Component、模块级缓存），或从按参数缓存的函数取得。`Promise.resolve(data)` 也是每次新建 promise，仍有额外挂起 / 闪烁风险，不要用它绕过缓存。

### 3.4 按参数缓存 promise：React 不替你缓存

```tsx
const cache = new Map<string, Promise<Album[]>>()
const keyFor = (q: string) => `/api/albums?q=${encodeURIComponent(q)}`
export function getAlbums(query: string) {
  const key = keyFor(query)
  const hit = cache.get(key)
  if (hit) return hit
  const p = fetch(key).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Album[]>
  })
  cache.set(key, p)
  return p
}
export const clearAlbums = (query: string) => cache.delete(keyFor(query))
```

**为什么缓存 promise 而不是只缓存已解析的数据？** 同一 key 的并发 render 会共享同一个 in-flight promise，天然去重；只缓存数据则每个调用者仍可能各发一次请求。同一个 promise 再次传入时，如果已经 fulfilled，`use` 可以同步读取，不再挂起。

几个关键点：

- key 必须包含所有影响结果的参数：query、page、sort、userId、locale 等；对象参数要稳定序列化，避免 key 抖动。
- 进阶：给 promise 标上 `status` / `value`（或 `reason`）字段，React 可据此同步读取已完成的 promise。但**不要自己读 `status` 来决定是否调用 `use`**；始终把 promise 交给 `use`，让 React 处理。
- 缓存了 rejected promise 时，后续读取会一直抛同一个错误；重试前必须 `clearAlbums(key)` 或换 key。
- 模块级 Map 的代价：只在当前标签页内、无 TTL / 淘汰、刷新即失、错误也会被缓存。示例省略了清理，生产应使用带 `gcTime` 的查询库。

**关于 React 的 `cache`**：React 19.3 文档把 `cache` 限定为 **Server Components only**，并按 server request 失效；每次调用 `cache(fn)` 还会生成独立的缓存函数。不要在客户端把它当跨 render 的 promise 缓存。客户端手写就用模块级 Map，生产用 TanStack Query 的 `useSuspenseQuery`（W2D3）或框架 / 路由的 loader。

### 3.5 错误处理：reject 去 Error Boundary，不是 fallback

```tsx
import { ErrorBoundary } from 'react-error-boundary'

<ErrorBoundary
  resetKeys={[query]}
  fallbackRender={({ error, resetErrorBoundary }) => (
    <div role="alert">
      <p>加载失败：{error.message}</p>
      <button onClick={() => { clearAlbums(query); resetErrorBoundary() }}>重试</button>
    </div>
  )}
>
  <Suspense fallback={<p role="status">加载中…</p>}>
    <Albums query={query} />
  </Suspense>
</ErrorBoundary>
```

**为什么 reject 不走 fallback？** fallback 的语义是“还在等”，错误是另一种终态。promise reject 后，React 重新渲染并让 `use` 在 render 中抛出 rejection reason，最近的 Error Boundary 接住并显示错误 UI；没有边界则错误冒泡到根，可能卸载整棵应用。

- Error Boundary 在 React 19 中仍然是 **class 组件**（`static getDerivedStateFromError` / `componentDidCatch`），没有函数组件等价物；`react-error-boundary` 只是把它封装成更易用的组件。它不捕获事件处理函数里的错误，但能捕获 `use` 在 render 中抛出的错误。
- 常见结构是把 Error Boundary 包在 Suspense **外层**：错误 UI 替换整个加载区域。反过来也能工作，但错误 UI 会作为 Suspense 的内容出现。
- **重置边界**：`resetErrorBoundary()` 会清空边界错误状态并重新挂载子组件；`resetKeys={[query]}` 在 query 变化时自动重置；也可以用 `key={query}` 或递增的 `key={attempt}`。从错误 fallback 重置会重新挂载子树，state 丢失。
- **只重置边界不够**：如果 rejected promise 还在缓存里，重置后 `use(getAlbums(query))` 会立刻再次抛错。必须同时让缓存失效（`clearAlbums`）或换一个 promise / cache key。这是“点重试没反应”的最常见原因。
- 对确定性错误（如 404、无权限），重试不会成功；应提供返回 / 切换入口，而不是只放一个重试按钮。

### 3.6 请求竞态与切换：UI 只反映当前参数

```tsx
function Search() {
  const [draft, setDraft] = useState('react')
  const [query, setQuery] = useState('react')
  const [isPending, startTransition] = useTransition()
  return <>
    <input value={draft} onChange={e => {
      setDraft(e.target.value)                        // 紧急：输入立即响应
      startTransition(() => setQuery(e.target.value)) // 非紧急：旧结果先留着
    }} />
    <Suspense key={query} fallback={<ListSkeleton />}>
      <Results query={query} />
    </Suspense>
    {isPending && <span role="status">更新中…</span>}
  </>
}
```

**为什么不会出现“旧请求晚到覆盖新结果”？** 因为数据不是由 promise 的回调 `setState` 驱动的：UI 是当前 props / state 的纯函数，render 只读取“当前 query 对应的 promise”。旧 promise 晚 resolve 只会让它自己的缓存条目变成 fulfilled，不会触发当前 UI 更新；React 也可能丢弃被新更新打断的旧 render，旧结果不会 commit。这正是相对 `useEffect + fetch + setData` 的结构性优势（后者需要 `AbortController` 或忽略标志来防竞态）。

切换时的选择：

- **保留旧内容**：不用 key，配合 `startTransition` / `useDeferredValue`。旧结果先留着，`isPending` 或变暗的旧列表提示正在更新；适合同一视图的刷新、搜索联想。
- **显示 fallback**：给 Suspense 边界加 `key={query}`（或给上层组件加 key）。key 变化会重置边界，即使更新在 transition 中也会显示 fallback；适合切换到“不同身份”的内容，例如从用户 A 的资料页切到用户 B，继续显示 A 的数据会误导。
- **过渡的边界**：transition 只等待“足够避免隐藏已显示内容”的数据；**新渲染出来的 Suspense 边界仍会立即显示 fallback**。它不会等所有嵌套内容都加载完。
- `useDeferredValue` 是另一条路：输入保持紧急，结果用延迟值渲染，旧结果可以变暗（W3D2 展开）。生产环境还应做 debounce；缓存能防竞态，但不能防请求数量过多。

### 3.7 加载状态设计：嵌套边界、骨架屏、别抖

```tsx
function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Header />
      <div className="grid">
        <Suspense fallback={<ListSkeleton rows={5} />}>
          <Albums />
        </Suspense>
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      </div>
    </Suspense>
  )
}
```

- **边界放在独立数据区域附近**，不要整页一个 spinner。嵌套边界让各区域各自就绪、各自揭示；外层 fallback 只覆盖“不在内层边界里的内容”。也不要切得太碎，十几个小 spinner 同样吵闹。
- **骨架屏与最终布局同尺寸**：固定 `min-height`、`aspect-ratio`、相同的网格轨道，避免 fallback 切换成内容时布局抖动（CLS）。spinner 通常比内容矮，最容易造成跳动。
- **首次加载 vs 更新**：首次加载可以用骨架屏；更新时应保留旧 UI，用 `isPending` 做内联提示，或用 `useDeferredValue` 把旧结果变暗，而不是把整块内容换成 fallback。输入框尤其不能被卸载。
- **避免闪烁**：紧急更新中 fallback 会在挂起时立即出现，React 没有“延迟 N 毫秒再显示 fallback”的公开 API；不要用 `setTimeout` 人为拖延。用稳定的骨架、transition 处理更新，并利用 300ms 的批量揭示窗口。可以用 CSS 让 spinner 延迟淡入，但占位空间要一直保留。
- **可访问性**：加载文本加 `role="status"` / `aria-live="polite"`，区域可加 `aria-busy`；fallback 不应抢焦点。空数据、错误是另外两种状态：空列表由组件自己渲染，错误由 Error Boundary 处理。
- 表单提交的 pending 不要用 Suspense 表达，继续用 [W2D1](W2D1-actions-forms.md) 的 `useFormStatus` / `useActionState`。

### 3.8 `lazy` + Suspense：代码分割

```tsx
import { lazy, Suspense } from 'react'
const MarkdownPreview = lazy(() => import('./MarkdownPreview'))

export default function Editor() {
  return (
    <Suspense fallback={<p role="status">加载编辑器…</p>}>
      <MarkdownPreview />
    </Suspense>
  )
}
```

`lazy(() => import('./X'))` 返回一个组件类型；第一次渲染它时开始加载模块，模块未就绪就挂起，由最近的 Suspense 显示 fallback。**必须在模块顶层声明**：在组件内部调用 `lazy()` 会每次 render 创建一个新组件类型，导致子树卸载重建、state 丢失。`lazy` 会缓存自己的加载 promise，普通重渲染不会重复下载；但 chunk 加载失败会 reject，交给 Error Boundary。路由级代码分割通常由 React Router 8（W2D4）或框架的懒加载路由完成。

### 3.9 SSR / 流式渲染边界，以及手写数据层的适用边界

```tsx
// Server Component（第 4 周展开，示意）
const albumsPromise = getAlbums()
return <Albums albumsPromise={albumsPromise} />

// Client Component，文件顶部写 'use client'
function Albums({ albumsPromise }: Props) {
  const albums = use(albumsPromise) // 解析值必须可序列化
  return <List albums={albums} />
}
```

- **服务端流式**：`renderToPipeableStream` 先发送 HTML shell 和各个 Suspense 边界的 fallback，边界数据就绪后再把真实 HTML 和替换脚本流给浏览器；客户端水合时可以做选择性水合。Next.js App Router 的 `loading.tsx` 就是一个 Suspense 边界，RSC 的数据流式传输在第 4 周展开（W4D2）。
- **跨边界传 promise**：Server Component 可以把 promise 作为 prop 传给 Client Component，由客户端 `use` 读取；**解析后的值必须可序列化**，不能是函数、类实例等。
- **客户端手写数据层的边界**：模块 Map + `use` 适合学习、演示、只读的小型内部工具。它不提供 TTL / 淘汰、跨组件失效、重试退避、聚焦重取、分页、mutation 后的失效、乐观更新、devtools、SSR 缓存传递等能力。生产建议 TanStack Query 的 Suspense 模式（W2D3）、路由 loader（W2D4）或框架自带缓存；Reac t 文档也建议优先使用框架 / Suspense-enabled 数据源，而不是自己造通用缓存。

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| `use(fetch(url).then(...))` 写在 render 里 | `use(getCached(url))`，promise 在 render 外创建或按参数缓存 | 每次重试都新建 promise，反复挂起、请求风暴，内容可能永远不出现 |
| `onClick={() => use(promise)}` | 事件里取得 / 缓存 promise，放进 state 或缓存，由下一次 render 的 `use` 读取 | `use` 只能在组件 / Hook 的 render 期间调用；事件处理器不在 render 中，也没有可接住它的 Suspense |
| `try { use(p) } catch (e) {}` | 用 Error Boundary 包住组件 | `use` 靠抛异常挂起，`try/catch` 会吞掉 Suspense 信号，报 “Suspense Exception: This is not a real error!” |

| 把“加载失败”写在 Suspense fallback 里 | fallback 只表示 pending；错误交给 Error Boundary | promise reject 不会走 fallback，而是作为 render 错误传播 |

| 只调用 `resetErrorBoundary()` 就重试 | 同时清掉 rejected 缓存或换 promise / key | 缓存里还是同一个 rejected promise，重置后会立刻再次抛错 |

| 整个页面只包一个 Suspense | 按独立数据区域嵌套边界，配合骨架屏 | 一个慢请求阻塞整页，加载体验和布局都更差 |

| 更新参数时默认让 fallback 替换旧内容 | 用 `startTransition` 保留旧 UI + `isPending`，或 `useDeferredValue` 变暗旧结果 | 已显示内容被替换会闪烁、丢失上下文；过渡更新可避免不必要的 fallback |

| 用 `key={Math.random()}` 强制刷新 | 稳定 key；重试时用递增的 attempt 或 `resetKeys` | 随机 key 每次 render 都重建子树，state 丢失、可能重复请求（见 [W1D5](W1D5-composition-context.md)） |

| 认为 `startTransition` 会等所有内容加载完 | 它只等到“不会隐藏已显示内容”为止；新边界仍立即显示 fallback | transition 不是全屏 loading，嵌套的新内容可以继续流式出现 |

| 在 Effect 里 fetch 后 `setData`，指望 Suspense 接住 | 用缓存 promise + `use`，或用 TanStack Query | Suspense 不感知 Effect 里的请求；`setData` 还会引入旧响应覆盖新结果的竞态 |

| 在客户端用 React 的 `cache` 做跨 render 缓存 | 客户端用模块 Map 或 TanStack Query；`cache` 留给 Server Components | React 19.3 文档把 `cache` 限定为 Server Components only，按 server request 失效 |
| 在组件内部写 `const Lazy = lazy(...)` | 在模块顶层声明 | 每次 render 都是新组件类型，导致子树重建、state 丢失、重复加载 |

## 5. 三句话自测

1. Suspense 接住 render 期间 `use` 抛出的 promise，显示最近边界的 fallback，resolve 后从头重试；首次挂载不保留未提交的 state，更新时默认用 fallback 替换旧内容，除非更新处于 transition 或 deferred 中。
2. `use(promise)` 是渲染期读取，可以条件调用但不是 Hook，不能在事件处理函数或 `try/catch` 中调用，且 promise 必须按参数缓存为稳定实例，否则每次重试都会新建 promise 并反复挂起。
3. promise reject 交给最近 Error Boundary 而不是 fallback；重置边界时还要让 rejected 缓存失效或更换 key 才会真正重试，生产环境优先用 TanStack Query 等带缓存、失效与竞态处理的数据层。

## 6. 官方阅读

- https://react.dev/reference/react/use
- https://react.dev/reference/react/Suspense
- https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
