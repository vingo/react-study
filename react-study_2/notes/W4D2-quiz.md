# W4D2 课前测验：App Router（Next.js 16）

先独立作答，不查资料、不运行代码；把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W4D2.md`，做完前不要打开。

本卷共 9 分：2 道复习题（各 0.5 分），3 道新主题题（3 + 2.5 + 2.5 分）。以 Next.js 16（文档 v16.4.6）为准。练习环境没有安装 Next.js 16；涉及运行行为时按官方文档的语义作答，不要假设本机能启动 `next dev`。

## 复习 1：嵌套路由、`<Outlet />` 与错误边界（0.5 分｜来自 W2D4 第 1 题）

```tsx
const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    errorElement: <RootError />,
    children: [
      {
        path: 'projects/:projectId',
        Component: ProjectLayout,
        errorElement: <ProjectError />,
        children: [
          { index: true, Component: Overview },
          { path: 'tasks', Component: Tasks },
        ],
      },
    ],
  },
])

function RootLayout() {
  return (
    <div>
      <Header />
      <main />
    </div>
  )
}

function ProjectLayout() {
  return (
    <section>
      <h2>项目</h2>
    </section>
  )
}
```

1. 访问 `/projects/42/tasks` 时，页面上会显示哪些内容？`Tasks` 为什么没有出现？最小改动是什么？
2. 假设 `Overview` 的 loader 抛出一个 404 `Response`，访问 `/projects/42` 时哪个 `errorElement` 会渲染？`<Header />` 还在吗？为什么？

**你的答案：**

## 复习 2：`useDeferredValue`、Suspense 与旧内容（0.5 分｜来自 W3D2 第 2 题）

```tsx
function Search({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query)
  const stale = query !== deferredQuery

  return (
    <>
      <p>{stale ? '更新中…' : ''}</p>
      <Suspense fallback={<Spinner />}>
        <Results query={deferredQuery} />
      </Suspense>
    </>
  )
}
```

`Results` 用 `use()` 读取一个按 `deferredQuery` 缓存的、可能挂起的 promise。用户把 `query` 从一个值改成另一个值。

1. 如果这次后台 render 因新 `deferredQuery` 挂起，用户会看到 `Spinner` 还是旧结果？为什么？Suspense fallback 在什么情况下才会立刻出现？
2. `stale` 为 `true` 表示什么？它和“网络请求正在进行”是一回事吗？
3. 把这里换成 App Router 的一次路由导航，`loading.tsx` 的 fallback 是否也一定不出现？简要说明差异。

**你的答案：**

## 第 1 题：文件约定、布局链与 route group（3 分）

```text
app/
  layout.tsx
  page.tsx
  (shop)/
    layout.tsx
    cart/page.tsx
    products/[id]/page.tsx
  (marketing)/
    about/page.tsx
  docs/
    layout.tsx
    [...slug]/page.tsx
```

1. 分别写出 `/cart`、`/products/42`、`/about`、`/docs/a/b` 命中的 page、layout 链（从根到叶子）、动态 `params`，以及路径上经过的 route group。`/marketing/about` 和 `/docs` 会命中吗？为什么？（1 分）
2. 从 `/cart` 导航到 `/products/42` 时，哪些 layout 会保留 state、哪些内容被替换？`(shop)` 会不会出现在 URL 里？如果应用改成 `(shop)` 和 `(marketing)` 各有一个根布局（删除顶层 `app/layout.tsx`），跨这两个区域导航会发生什么？（1 分）
3. 只想让 `/cart` 显示自己的 skeleton，而 `/products/42` 继续用 shop 级 skeleton，`loading.tsx` 应放在哪里？为什么 `(shop)/loading.tsx` 接不住 `(shop)/layout.tsx` 自己读取慢数据时的等待？在 Next.js 16 中，page 的 `params` 应该怎样读取？（1 分）

**你的答案：**

## 第 2 题：loading / error / not-found 的边界选择（2.5 分）

```text
app/
  layout.tsx
  error.tsx
  not-found.tsx
  dashboard/
    layout.tsx
    error.tsx
    loading.tsx
    not-found.tsx
    page.tsx
    settings/
      page.tsx
      error.tsx
      loading.tsx
      not-found.tsx
    reports/
      page.tsx
```

1. 以下三种错误分别由哪个文件接住？对应的 layout/页面还显示什么？
   - `dashboard/settings/page.tsx` 渲染时抛错；
   - `dashboard/layout.tsx` 渲染时抛错；
   - `app/layout.tsx` 渲染时抛错。（1 分）
2. 以下三种“找不到”分别渲染哪个 `not-found.tsx`？为什么？
   - `dashboard/settings/page.tsx` 调用 `notFound()`；
   - `dashboard/reports/page.tsx` 调用 `notFound()`；
   - 用户访问一个完全未匹配的 `/nope`。（0.75 分）
3. 为什么 `error.tsx` 必须是 Client Component？`retry()` 和 `reset()` 的区别是什么？Event Handler 里的错误会被它捕获吗？如果 404 是在流式响应开始后才触发，HTTP 状态码和 SEO 处理分别是什么？（0.75 分）

**你的答案：**

## 第 3 题：流式渲染与 Next.js 16 缓存（2.5 分）

```tsx
// app/blog/page.tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'

async function getPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')
  return db.post.findMany()
}

async function Posts() {
  const posts = await getPosts()
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}

async function UserPreferences() {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <p>主题：{theme}</p>
}

export default function BlogPage() {
  return (
    <>
      <h1>博客</h1>
      <Posts />
      <Suspense fallback={<p>加载偏好…</p>}>
        <UserPreferences />
      </Suspense>
    </>
  )
}
```

项目已开启 `cacheComponents: true`。假设 `getPosts` 较慢，`cookies()` 读取很快。

1. 首次请求时，static shell 里有什么？哪些内容会流式补全？如果慢数据在 `app/blog/layout.tsx` 而不是 page 里，`app/blog/loading.tsx` 能显示 fallback 吗？为什么？两个 Suspense 边界之间是什么关系？（0.75 分）
2. 分别解释未开启 `cacheComponents` 时的 `fetch` 默认行为、`cache: 'no-store'`、`cache: 'force-cache'`、`next: { revalidate, tags }`。Next.js 16 的 `use cache` / `cacheComponents` 是实验特性还是稳定特性？开启后 `use cache` 的缓存键、序列化限制、运行时 API 限制分别是什么？（1 分）
3. 发帖成功后，团队要在三种失效方式中选一个：`revalidateTag('posts', 'max')`、`updateTag('posts')`、`revalidatePath('/blog')`。分别说明语义、适用场景和调用位置；Next.js 16 对 `revalidateTag` 的参数有什么要求？为什么 `use cache` 函数里不能直接读 `cookies()`/`searchParams`？（0.75 分）

**你的答案：**
