# W4D2：App Router（Next.js 16）

> 以 2026-11 的 Next.js 16 文档（v16.4.6）为准，练习环境为 React 19.3、TypeScript 7。承接 [W2D4](W2D4-react-router.md) 的路由树/`<Outlet />` 与 [W3D2](W3D2-concurrent-rendering.md) 的 Suspense/transition。**练习环境没有安装 Next.js 16**：W4D2 的三道题是纯 TS 语义模型，不启动 `next dev`，也不改共享依赖。版本敏感 API 以文末官方链接为准。

## 1. 一句话结论

App Router 用“文件夹是 URL 段、特殊文件是 UI 边界”的约定，把一次导航建模成：URL 匹配一棵 segment 树 → 保留祖先 layout、替换叶子 page → 用最近的 loading/error/not-found 包住可能失败的子树；服务端先把静态 shell 和 Suspense fallback 发给浏览器，再流式补全慢片段；缓存则是显式的——要么用 `fetch` 的 `no-store`/`force-cache`/`revalidate`/tags，要么在 Next.js 16 的 Cache Components 下用 `use cache` + `cacheLife`/`cacheTag`，并用 `revalidateTag`/`updateTag`/`revalidatePath` 在变更后失效。

## 2. 心智模型

```text
URL /dashboard/settings
        │
        ▼
app/                     segment 树（文件夹 = URL 段）
  layout.tsx             ← 根布局，包住所有路由
  dashboard/
    layout.tsx           ← /dashboard 及其子段共享；导航时保留 state
    loading.tsx          ← 包 page / not-found / 子 layout 的 Suspense
    error.tsx            ← 包 loading / not-found / page / 子 layout 的 Error Boundary
    page.tsx             ← /dashboard 的叶子 UI
    settings/
      page.tsx           ← /dashboard/settings 的叶子 UI
        │
        ▼
layout 链：root → dashboard        （保留、保持交互）
page：settings/page                （导航时替换）
边界：error > loading > not-found > page（越靠内越先接住）

首屏/导航
  静态 shell（layout、导航、fallback）──先发──► 浏览器立刻可交互
  Suspense 内的慢片段 ──数据就绪后分块补发──► 原地替换 fallback

缓存（两套模型，别混着背）
  未开 cacheComponents：fetch 默认不持久缓存；显式 force-cache / revalidate / tags
  开启 cacheComponents：数据默认按请求取；显式 'use cache' + cacheLife/cacheTag
```

三句话记住：**layout 是骨架，page 是内容；边界由组件层级决定，不由“谁看起来更近”决定；缓存默认不帮你，失效要靠 tag/path 精确表达。**

## 3. 要点

### 3.1 文件约定：URL、UI、边界各司其职

| 文件 | 作用 | 是否进入 URL | 关键语义 |
|---|---|---|---|
| `layout.tsx` | 共享 UI，接收 `children` | 所在文件夹进入 | 导航时保留 state、保持交互、默认不重渲染 |
| `page.tsx` | 某路由的叶子 UI | 是 | 一个 segment 只有加了 page/route 才公开可访问 |
| `loading.tsx` | 即时 loading UI | 否 | 自动把 page/not-found/子 layout 包进 Suspense |
| `error.tsx` | 运行时错误边界 | 否 | 必须是 Client Component；捕获本段 page/子 layout，不捕获同段 layout |
| `not-found.tsx` | 404 UI | 否 | 由 `notFound()` 触发；未匹配 URL 由根文件兜底 |
| `route.ts` | HTTP handler | 是 | 与 page 互斥，用于 API |
| `(group)` | 路由分组 | **否** | 只影响布局/组织，不影响 URL |
| `[id]` | 单段动态参数 | 是（一段） | `params.id` 为 `string` |
| `[...slug]` | catch-all | 是（一段或更多） | `params.slug` 为 `string[]`，至少一段 |
| `[[...slug]]` | optional catch-all | 是（零段或更多） | `/docs` 也能匹配，参数可为 `undefined` |
| `_folder` | 私有文件夹 | 否 | 整个子树退出路由 |

真实目录示例：

```text
app/
  layout.tsx                 // 根布局，必须有 html/body
  page.tsx                   // /
  (marketing)/
    layout.tsx               // 只包营销页；URL 中不出现 marketing
    about/page.tsx           // /about
  dashboard/
    layout.tsx               // /dashboard 及子路由共享
    page.tsx                 // /dashboard
    settings/page.tsx        // /dashboard/settings
  users/
    [id]/page.tsx            // /users/42 → params.id = '42'
  docs/
    [...slug]/page.tsx       // /docs/a、/docs/a/b → params.slug = ['a', ...]
```

`page.tsx` 是路由公开的必要条件：只有文件夹没有 page/route 时，它只是组织代码，不会生成 URL。页面之外的组件、工具函数可以安全地放在 `app` 里（colocation），不会自动变成路由。

### 3.2 URL 匹配：静态优先、动态捕获、参数是 Promise

- 路由段分三类：静态字面量、动态 `[name]`、catch-all `[...name]`。匹配时静态段优先于动态段，动态段优先于 catch-all；同一 URL 不应被两个 page 同时声明，否则是冲突。
- `[id]` 只消费一个非空段；`[...slug]` 消费剩余全部段且**至少一段**，所以 `app/docs/[...slug]/page.tsx` 不匹配 `/docs`。需要匹配 `/docs` 时用 `[[...slug]]`。
- route group `(marketing)` 不消费 URL 段，但组内 `layout.tsx` 会嵌套在根布局内。`app/(marketing)/about/page.tsx` 的 URL 是 `/about`，不是 `/marketing/about`。不同 group 不能解析到同一 URL。
- Next.js 15 起 `params` 是 Promise；Next.js 16 继续要求 `await`。Client Component 可用 React 的 `use(params)`。`searchParams` 同样不是“布局可读的全局状态”。

```tsx
// app/users/[id]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <h1>用户 {id}</h1>
}
```

```tsx
// app/docs/[...slug]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params // /docs/a/b → ['a', 'b']
  return <p>{slug.join(' / ')}</p>
}
```

- `generateStaticParams` 可在构建期为已知动态参数预渲染；未列出的参数在 Cache Components 下通常是运行时数据，需要 Suspense/流式处理。
- `layout` 也能收到 `params`，但布局**不会在导航时重渲染**，因此不要把会随 URL 变化的状态读进 layout 再期待它更新；需要变化的路径信息放在 Client Component 的 `usePathname` / page 的 `searchParams`。

### 3.3 嵌套布局：`children` 就是 Outlet，布局保留、page 替换

- 每层 `layout.tsx` 通过 `children` 接收下一层 layout 或 page。类比 React Router 的 `<Outlet />`：父布局只负责骨架，子路由从出口渲染。区别是 App Router 由文件系统自动组合，不需要手写路由配置。
- 导航到同一 layout 下的另一个 page 时，layout 实例保留：state、滚动位置、输入框内容、正在播放的媒体都不丢，也不会重新请求 layout 数据。page 被替换。
- 布局链只在目录层级变化时变化；从 `/dashboard` 到 `/dashboard/settings` 会复用根布局和 dashboard 布局，只替换 page。
- 布局不应该读取 `searchParams`，也不应该依赖会过期的 pathname；官方明确 layout 在导航时不会重渲染。需要随导航变化的部分放到 page 或 Client Component。

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <header>Kanban</header>
        <main>{children}</main>
      </body>
    </html>
  )
}
```

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <section className="dashboard">
      <nav>概览 / 设置</nav>
      {children}
    </section>
  )
}
```

```tsx
// app/dashboard/page.tsx
export default function Page() {
  return <p>概览</p>
}
```

从 `/dashboard` 导航到 `/dashboard/settings` 时，`RootLayout` 和 `DashboardLayout` 都复用，只有 `Page` 换成 settings 的 page。若在 dashboard layout 里放一个受控输入框，输入内容在子页面切换时会保留；这正是布局与 page 的分工。

**多个根布局**：删除顶层 `app/layout.tsx`，在每个 route group 里各放一个根布局，各自包含 `<html>`/`<body>`。在不同根布局之间导航会触发整页刷新（full page load），而不是客户端导航；只有在确实需要完全不同的应用外壳时才这么做。

### 3.4 loading：自动 Suspense，但包不住同段 layout

`loading.tsx` 是最简单的流式入口：同目录的 page（以及 not-found、子 layout）会自动被包进 `<Suspense fallback={<Loading />}>`。导航时 fallback 可被预取，页面骨架立刻出现，慢数据就绪后原地替换。

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <p>正在加载看板…</p>
}
```

官方组件层级（从外到内）：

```text
layout > template > error > loading > not-found > page / 子 layout
```

因此：

- `loading.tsx` **包裹**同段 page、not-found、嵌套 layout；
- `loading.tsx` **不包裹**同段 `layout.tsx`、`template.tsx`、`error.tsx`；
- 如果 dashboard layout 自己读取未缓存数据或 `cookies()/headers()` 而挂起，dashboard/loading.tsx 不会为它显示 fallback。没有 Cache Components 时导航会等 layout 渲染完；开启 Cache Components 时，layout 里这类运行时读取必须自己用 `<Suspense>` 包住，否则构建期会报错。
- 想让 loading 只作用于某个子路由，可把该路由放进独立 route group，并在组内放 `loading.tsx`；URL 不变。

```tsx
// app/dashboard/page.tsx —— 细粒度 Suspense 比整页 skeleton 更好
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <>
      <h1>看板</h1>
      <Suspense fallback={<p>加载收入…</p>}>
        <Revenue />
      </Suspense>
      <Suspense fallback={<p>加载订单…</p>}>
        <Orders />
      </Suspense>
    </>
  )
}
```

两个 Suspense 边界独立流式补全：收入慢不会阻塞订单，订单慢也不会阻塞收入。`loading.tsx` 是“整段 page”的粗粒度版本；需要更细的骨架时手写 Suspense。

### 3.5 error：最近边界向上冒泡，但不接同段 layout

`error.tsx` 必须是 Client Component，接收 `error` 和 `retry`（`retry` 在 Next.js 16.3 稳定；另有 `reset` 只清错误状态、不重新取数）。它把同段 page、loading、not-found、子 layout 包进 React Error Boundary；错误会冒泡到最近的父级 error 边界。

```tsx
// app/dashboard/error.tsx
'use client'

export default function DashboardError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div role="alert">
      <h2>看板出错了</h2>
      <p>{message}</p>
      <button onClick={() => retry()}>重试</button>
    </div>
  )
}
```

关键规则：

- `dashboard/error.tsx` 能接住 `dashboard/page.tsx`、`dashboard/settings/page.tsx`、settings layout 等**子段**的渲染错误；
- 它**接不住** `dashboard/layout.tsx` 的错误：同一个文件夹里，layout 在 error 边界之上。错误会继续冒泡到 `app/error.tsx`；父 layout 抛错时，子段 error 边界根本不会渲染；
- 根 `app/layout.tsx` 的错误普通 `error.tsx` 接不住，需要根目录的 `global-error.tsx`（必须自带 `<html>`/`<body>`，也是 Client Component）；
- `retry()` 会重新取数并重渲染边界子树；`reset()` 只清除错误状态、不重新取数。多数场景优先 `retry`；
- 生产环境里 Server Component 的错误信息会被隐藏，只保留通用 message + `digest`，用 digest 对照服务端日志；
- Event Handler 和 `setTimeout` 里的错误不会被 Error Boundary 捕获，要自己 `try/catch` 或存进 state；`startTransition` 内未处理的错误会冒泡到最近边界；
- 预期错误（表单校验、404）不要靠 throw 到 error 边界，应该建模成返回值或用 `notFound()`。

### 3.6 not-found：`notFound()` 是抛出，未匹配 URL 由根文件兜底

```tsx
// app/users/[id]/page.tsx
import { notFound } from 'next/navigation'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUser(id)
  if (!user) notFound() // 抛出 NEXT_HTTP_ERROR_FALLBACK;404，后面的代码不执行
  return <h1>{user.name}</h1>
}
```

```tsx
// app/users/[id]/not-found.tsx
export default function NotFound() {
  return <p>用户不存在</p>
}
```

- `notFound()` 会终止当前 segment 的渲染，异常传播到最近的 `not-found` 边界；没有同段文件时用最近的父级 `not-found`，再到根 `app/not-found.tsx`。
- 完全匹配不到任何路由的 URL，由根 `app/not-found.tsx` 处理（Next.js 13.3+）。`global-not-found.js` 可绕过根布局直接返回全局 404，但截至 Next.js 16 仍是 **experimental**（`experimental.globalNotFound`）。
- 不要在 `try/catch` 里吞掉 `notFound()`；需要局部捕获时先让框架的中断错误透传（如 `unstable_rethrow`）。
- 流式响应开始前，`notFound()` 能返回 404 状态；开始流式后状态码已经是 200，Next.js 会注入 `<meta name="robots" content="noindex">`，避免软 404 被索引。
- `not-found.tsx` 不接收 props；需要展示当前路径时，在 Client Component 里用 `usePathname`，或让 page 把数据传给子组件。

### 3.7 流式渲染：先 shell，后慢片段

React 的服务端渲染器按 `<Suspense>` 边界把 HTML 分块。Next.js 把“任何异步工作完成前就能渲染的部分”称为 **static shell**：布局、导航、Suspense fallback。shell 先发送，浏览器先绘制并可交互；慢片段完成后，React 流式发送新 HTML 和一小段脚本，原地替换 fallback。

```tsx
// app/blog/page.tsx
import { Suspense } from 'react'

async function LatestPosts() {
  const posts = await getPosts() // 慢
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}

export default function BlogPage() {
  return (
    <>
      <h1>博客</h1>
      <Suspense fallback={<p>加载文章…</p>}>
        <LatestPosts />
      </Suspense>
    </>
  )
}
```

- 每个 Suspense 边界是独立流式点；不同边界按完成顺序补发，互不阻塞。
- `loading.tsx` 是 page 级 Suspense；手写 Suspense 可把 fallback 下沉，让更多真实内容进入 shell。
- 开启 Cache Components 后，Partial Prerendering（PPR）是默认行为：静态/缓存部分进入构建期 shell，运行时数据在 Suspense 中流式补全。未开启时，`loading.tsx` 或 Suspense fallback 开始渲染也会启动流式响应。
- 流式响应的初始状态码是 200；不要在流开始后才期待 404/403。需要准确状态码时，在流开始前完成检查（例如在 page 顶层或 Proxy 中）。
- 流式不损害 SEO：Next.js 会为爬虫决定 metadata 的阻塞/流式策略；404 页面会带 noindex。

### 3.8 缓存模型：先分清“哪套模型”，再谈 API

Next.js 16 同时存在两套缓存叙事，面试时最容易被追问“fetch 默认缓存吗”。先问一句：**有没有开启 `cacheComponents`？**

#### A. 未开启 Cache Components（上一代模型）

`fetch` 默认 **不是跨请求持久缓存**（`auto no cache`）：

- 如果路由在构建期可静态预渲染，`fetch` 可能在 `next build` 时执行一次，结果进入静态输出；
- 如果路由包含 Request-time API 或动态渲染，默认 fetch 会在每次请求执行；
- 想跨请求缓存，显式 `cache: 'force-cache'` 或 `next: { revalidate: n }`。

```ts
// 每次请求都取；即使路由本来可静态化
await fetch('https://api.example.com/stock', { cache: 'no-store' })

// 命中服务端缓存；只有 200 响应会被存储
await fetch('https://api.example.com/posts', { cache: 'force-cache' })

// 缓存 60 秒；到期后重新取
await fetch('https://api.example.com/posts', {
  next: { revalidate: 60, tags: ['posts'] },
})
```

- `cache: 'force-cache'`：按 URL/method/headers/body 匹配服务端缓存；没有或过期就重新取并写入。它是 opt-in 的，连 POST、带 authorization/cookie 的请求都可以显式缓存。
- `next.revalidate`：秒；`false` 表示 indefinite，`0` 表示不缓存；与 `cache: 'no-store'` 冲突时两者都会被忽略（开发环境有警告）。
- `next.tags`：给缓存项打标签，供 `revalidateTag` 使用；单个 tag 最长 256 字符，最多 128 个。
- 同一 render pass 内，相同 URL + options 的 GET fetch 会自动 **memoize**（请求去重），这只持续一次渲染，和跨请求的 Data Cache 不同；传 `AbortController.signal` 可退出。
- 路由段配置 `dynamic`、`revalidate`、`fetchCache` 可改默认行为，但优先在具体 fetch 上表达，不要全局乱设。

**按需失效**（只能在 Server Action 或 Route Handler 调用，不能在 Client Component/Proxy 调用）：

```ts
// app/actions.ts
'use server'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function updatePost() {
  await db.post.update(/* ... */)
  revalidateTag('posts', 'max') // Next.js 16 必填第二个参数；SWR
  revalidatePath('/blog')       // 只让该路径下次访问时重新取
}
```

- `revalidateTag(tag, profile)`：把带该 tag 的数据标记为 stale，下一次请求触发后台刷新，默认推荐 `'max'`（stale-while-revalidate）。Next.js 16 起第二个参数必填，单参数形式已废弃。
- `updateTag(tag)`：只能在 Server Action 中用，立即过期并刷新当前 UI，适合“用户刚改完，必须立刻看到自己的写入”。
- `revalidatePath(path, type?)`：按路由失效；`'page'` 只影响该路径，`'layout'` 会影响该布局及其下所有页面。路径是**路由文件结构**（rewrite 时要传 destination）。tag 更精确，path 更省心但容易过度失效。
- 这些调用只标记失效，真正重新取数发生在下一次访问；不要期待调用瞬间所有页面都重建。

#### B. 开启 Cache Components（Next.js 16 的当前模型）

Next.js **16.0.0 起 Cache Components 稳定**，从 `experimental.cacheComponents` 移到顶层 `cacheComponents: true`；`use cache`、`cacheLife`、`cacheTag` 也随之稳定（不再是 `unstable_` 前缀）。它仍是**显式开启**的模型：16 的 `create-next-app` 默认开启，旧项目需要手动配置并迁移。

配置：`cacheComponents: true`，并显式设置 `partialPrefetching`（不设会有警告）。开启后：

- 数据默认按请求处理；要缓存就在函数/组件级别显式声明 `'use cache'`；
- 路由段配置 `dynamic`、`revalidate`、`fetchCache` 会报错，改用 `use cache` + `cacheLife`；
- 未缓存的异步读取和 `cookies()/headers()/searchParams/params` 必须放在 `<Suspense>` 中，否则开发覆盖层/构建会提示 blocking-route；
- PPR 成为默认：静态 shell 先发，动态部分流式补全。

```tsx
// app/lib/data.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')
  return db.post.findMany()
}
```

```tsx
// app/blog/page.tsx —— 缓存数据进 shell，运行时数据流式补全
import { Suspense } from 'react'
import { cookies } from 'next/headers'

async function Posts() {
  const posts = await getPosts()
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}

async function UserGreeting() {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <p>主题：{theme}</p>
}

export default function BlogPage() {
  return (
    <>
      <h1>博客</h1>
      <Posts />
      <Suspense fallback={<p>加载偏好…</p>}>
        <UserGreeting />
      </Suspense>
    </>
  )
}
```

`use cache` 的关键约束：

- 被缓存的函数/组件必须是 `async`；可放在函数体第一行，也可放在文件顶部缓存所有导出；
- 缓存键包含 build ID、函数 ID、可序列化参数，以及从外层闭包捕获的变量；不同参数/闭包值产生不同缓存项；
- 不能读取 `cookies()`、`headers()`、`searchParams` 等请求期 API；应在缓存作用域外读取，再把值作为参数传入（参数会成为缓存键）；
- 参数和返回值必须可序列化；`children`、Server Action 只能透传，不能在缓存函数里读取/修改；
- 默认存储在**进程内存**：serverless 多实例/部署之间不保证共享；需要持久共享用 `'use cache: remote'`，需要按用户隔离/读取运行时数据用 `'use cache: private'`；
- 新部署会因 build ID 变化而清空缓存；`fetch` Data Cache 的持久性与 `use cache` 不同，迁移时不要假设等价；
- `cacheLife` 提供 `seconds`/`minutes`/`hours`/`days`/`weeks`/`max` 等 profile；`cacheTag` 打标签后用 `revalidateTag`/`updateTag` 失效；
- 开启 flag 后，既有 `fetch`/`unstable_cache` 缓存仍可工作，但官方迁移路径是把需要缓存的 fetch 包进 `use cache`，并用 `cacheLife`/`cacheTag` 替代 `revalidate`/`tags`。

**一句话选型**：没有 Cache Components 时，用 `fetch` 选项 + `revalidateTag`/`revalidatePath`；开启后，用 `use cache` 描述“什么可以缓存、缓存多久、属于哪个 tag”，用 `updateTag`/`revalidateTag` 处理写后一致性。两者都不要和“浏览器 HTTP 缓存”混为一谈。

### 3.9 组合示例：一个看板的边界与缓存

```text
app/
  layout.tsx                 // 根布局（根 layout 错误仍需 global-error）
  error.tsx
  loading.tsx
  dashboard/
    layout.tsx
    loading.tsx
    error.tsx
    page.tsx
    settings/
      page.tsx
      loading.tsx            // 只给设置页的更细 skeleton
      not-found.tsx
      error.tsx
```

- 设置页的错误由 `settings/error.tsx` 接住，看板侧边栏还在；settings layout（如果有）抛错则冒泡到 `dashboard/error.tsx`；dashboard layout 抛错冒泡到 `app/error.tsx`。
- 设置页的数据慢，显示 `settings/loading.tsx`；看板整体数据慢，显示 `dashboard/loading.tsx`；根 layout 慢，任何 loading 都帮不上，应该把慢数据下沉到 page 或自己包 Suspense。
- `settings/page.tsx` 里 `notFound()` 用 `settings/not-found.tsx`；没有则用 `dashboard/not-found.tsx`，再退到根。
- 设置页保存后：若是“立即看到自己的修改”，用 `updateTag('settings')`；若可接受短暂 stale，用 `revalidateTag('settings', 'max')`；若只知道路径、没有 tag，用 `revalidatePath('/dashboard/settings')`。

## 4. 常见误区

| 错误理解 | 正确理解 | 原因 |
|---|---|---|
| route group `(shop)` 会出现在 URL 里 | 不出现，只影响布局/组织 | 括号文件夹不映射 URL segment |
| layout 每次导航都会重新渲染 | layout 保留 state、保持交互、默认不重渲染 | 只有 page 替换；需要变化的值放 page/Client Component |
| `error.tsx` 能接住同段 `layout.tsx` 的错误 | 不能，向父级 error 冒泡 | 组件层级 layout > error；根 layout 用 global-error |
| 所有错误都能被 error boundary 接住 | Event Handler、setTimeout、已捕获的 Promise 错误不行 | Error Boundary 只处理渲染期错误 |
| `loading.tsx` 能包住同段 layout 的慢数据 | 不能，layout 在 loading 之上 | 把慢取数下沉到 page，或给 layout 自己包 Suspense |
| 未匹配 URL 会找最近的 not-found | 由根 `app/not-found.tsx` 兜底 | 未匹配路由没有“当前 segment” |
| `params` 可以直接同步读取 | Next.js 16 里是 Promise，要 await/use | 15 起异步化；16 不再接受同步访问 |
| layout 可以读 searchParams 并随导航更新 | layout 不重渲染，会拿到旧值 | 用 page 的 searchParams 或 Client Component 的 useSearchParams |
| Next.js 16 的 fetch 默认永久缓存 | 默认不跨请求持久缓存 | 缓存是 opt-in；构建期可能执行一次，不等于永久缓存 |
| `revalidateTag('posts')` 在 Next.js 16 仍可用 | 需要第二个 profile 参数 | 16 起单参数废弃；推荐 `'max'` |
| `revalidateTag` 会立刻让所有页面重新请求 | 只标记 stale，下次访问触发 | 想立即读到自己写入用 `updateTag`（Server Action） |
| `use cache` 可以读 cookies/headers | 不能；在作用域外读，作为参数传入 | 缓存键需要可序列化、可确定 |
| `use cache` 与 `fetch` Data Cache 完全等价 | 存储/持久性/键都不同 | use cache 默认内存；fetch Data Cache 可跨部署持久 |
| 开启 `cacheComponents` 只是改个 flag | 会改变渲染模型并让旧 route config 报错 | 需要迁移 dynamic/revalidate/fetchCache，并补 Suspense |
| 流式响应一定返回 404 | 流开始后状态码已固定为 200 | 用 not-found 的 noindex；需要真 404 要在流开始前判断 |

## 5. 面试口径

**问：App Router 一次导航发生了什么？**
答：URL 按文件夹匹配出一棵 segment 树；祖先 layout 保留（state 和交互都不丢），叶子 page 替换；目标段的 `loading.tsx` 提供 Suspense fallback，`error.tsx`/`not-found.tsx` 在组件层级中包住 page 和子 layout。首次加载/流式响应时，服务端先发 layout、导航和 fallback 组成的 static shell，慢片段按 Suspense 边界分块补发并原地替换。

**问：error.tsx 的边界范围是什么？**
答：`error.tsx` 是 Client Component，包住同段的 loading/not-found/page 和所有子 layout，错误冒泡到最近的父级 error 边界。它不包同段 layout/template（layout 在它上面），也不接父 layout 的错误；根 layout 的错误用 global-error。Event Handler 和异步回调里的错误不归它管。

**问：loading.tsx 和手写 Suspense 的关系？**
答：`loading.tsx` 就是 Next.js 自动加在同段 page/not-found/子 layout 外面的 Suspense 边界，适合整页 skeleton。它不包同段 layout/error；布局自己的慢数据要么下沉到 page，要么在 layout 内手写 Suspense。更细的骨架用多个手写 Suspense，各边界独立流式补全。

**问：Next.js 16 的缓存怎么讲清楚？**
答：先分模型。未开 `cacheComponents` 时，`fetch` 默认不跨请求持久缓存；显式 `cache: 'force-cache'` 或 `next: { revalidate, tags }` 才缓存，变更后用 `revalidateTag(tag, 'max')` 或 `revalidatePath(path, type)` 失效（只能在 Server Action/Route Handler）。开启 `cacheComponents`（16.0 稳定，但需显式开启）后，数据默认按请求处理，用 `use cache` + `cacheLife`/`cacheTag` 显式缓存；不能读 cookies/headers/searchParams，运行时值作为参数进入缓存键；默认内存存储，跨实例持久要用 remote。立即读自己写入用 `updateTag`，可接受短暂 stale 用 `revalidateTag`，只知道路径用 `revalidatePath`。

**问：route group 有什么用？**
答：不影响 URL，只用来组织路由和 opt-in 布局：同一 URL 层级可以有不同的 layout（如 `(shop)` 与 `(marketing)`），也可以把 loading/error 只作用于组内路由；多个根布局也靠它实现。代价是跨根布局导航会整页刷新，且不同组不能解析到同一个 URL。

**问：layout 为什么不能读 searchParams？**
答：layout 在导航时不会重渲染，只保留实例；如果它读了 searchParams，切查询参数后会一直显示旧值。需要随 URL 变化的内容放 page 的 searchParams 或 Client Component 的 `useSearchParams`/`usePathname`。

## 6. 官方阅读

- 项目结构：https://nextjs.org/docs/app/getting-started/project-structure；布局与页面：https://nextjs.org/docs/app/getting-started/layouts-and-pages
- Route Groups：https://nextjs.org/docs/app/api-reference/file-conventions/route-groups；动态段：https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes
- loading.js：https://nextjs.org/docs/app/api-reference/file-conventions/loading；error.js：https://nextjs.org/docs/app/api-reference/file-conventions/error
- not-found.js：https://nextjs.org/docs/app/api-reference/file-conventions/not-found；错误处理：https://nextjs.org/docs/app/getting-started/error-handling
- 流式渲染：https://nextjs.org/docs/app/guides/streaming；缓存：https://nextjs.org/docs/app/getting-started/caching
- 上一代 fetch 缓存：https://nextjs.org/docs/app/guides/caching-without-cache-components；revalidateTag：https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- revalidatePath：https://nextjs.org/docs/app/api-reference/functions/revalidatePath；use cache：https://nextjs.org/docs/app/api-reference/directives/use-cache
- cacheComponents：https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents；Next.js 16 升级：https://nextjs.org/docs/app/guides/upgrading/version-16
