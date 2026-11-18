# W2D4：React Router 8

> 以 `react-router@8.5.1` 的 data mode 为准。承接 [W2D3](W2D3-tanstack-query.md)：上一讲把服务端状态交给 Query 缓存；本讲把“路由渲染所必需的取数”交给 loader，把筛选等 UI 状态交给 URL。v8 三个高频差异：`json` 已移除；浏览器里 `RouterProvider` 从 `react-router/dom` 导入；`useNavigation().state` 有 `idle` / `loading` / `submitting` 三态。

## 1. 一句话结论

在 data mode 里，URL 先匹配一棵布局树，router 在渲染前并行执行匹配链上的 loader，提交时先执行 action 再自动 revalidate；组件只渲染 loaderData，筛选/分页/tab 放 search params，路由关键数据不放进 `useEffect` 手动 fetch。

## 2. 心智模型

```text
用户点击链接 / 提交表单
          │
          ▼
URL ──match──► 路由匹配链（父布局 → 子路由）
          │
          ├─ GET：并行执行各层 loader ──► 渲染父布局 + <Outlet/> 子路由
          │        │
          │        └─ 抛错 ──► 最近的 errorElement
          │
          └─ POST：执行 action
                   ├─ 返回 data(errors, { status: 400 }) ──► useActionData，不 revalidate
                   ├─ 返回 redirect(...) ──► 新 URL，跑新页面的 loader
                   └─ 成功返回 ──► 自动 revalidate 当前页所有 loader

待定：navigation.state = idle | loading（跑 loader）| submitting（跑 action）
```

三句话记住：**父路由是布局，`<Outlet/>` 是子路由出口；loader 负责“渲染前取数”，action 负责“提交后改数并触发 revalidate”；URL 是筛选条件的真相，不是 `useState` 的副本。**

## 3. 要点

### 3.1 路由树：URL 匹配一棵布局树

```tsx
const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,                 // 必须渲染 <Outlet />
    errorElement: <RouteError />,
    children: [
      { index: true, Component: Home },    // GET /
      { path: 'tasks', Component: TasksLayout, 
        children: [
          { index: true, Component: TaskList },      // GET /tasks
          { path: ':taskId', Component: TaskDetail }, // GET /tasks/42
        ]
      },
      { path: '*', Component: NotFound },  // 未匹配的 URL → 404 页面
    ],
  },
])
```

```tsx
// main.tsx
import { RouterProvider } from 'react-router/dom'
createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />,
)
```

```tsx
function RootLayout() {
  return (
    <div>
      <nav>
        <NavLink to="/">首页</NavLink>
        <NavLink to="/tasks" end>任务</NavLink>
      </nav>
      <main><Outlet /></main>
    </div>
  )
}
```

**为什么这样组织？**

- 路由配置在模块顶层创建一次，不能放进组件 render 或 React state；否则每次 render 都是新 router，历史栈、loader 数据、订阅全部重建。
- 子路由的 `path` 写相对值（`tasks`、`:taskId`），最终 URL 由父路径拼接；写成 `/tasks/:taskId` 这种绝对路径时必须与父路径完全一致，容易出错。
- `index: true` 是“父 URL 的默认子页”，`/` 和 `/tasks` 都靠它渲染；它不是 `path: '/'`，也不需要单独 URL 段。
- 没有 `path` 的路由是纯布局路由（如 `{ Component: AuthLayout, children: [...] }`），只加嵌套、不加 URL 段。
- `path: '*'` 是兜底页面，属于正常路由匹配；它和“loader 找不到资源时抛 404”不是一回事，见 3.6。
- `<Link>` 是声明式导航；`<NavLink>` 在激活时自动加 `active` class 和 `aria-current="page"`。`<NavLink to="/">` 是特殊情况：React Router 默认只在根路径激活，不需要 `end`。非根链接默认前缀匹配，例如 `/tasks` 在 `/tasks/42` 也会激活；若只想在 `/tasks` 本身激活，需要加 `end`。需要自定义样式时用 `className={({ isActive, isPending }) => ...}`。

### 3.2 Loader：渲染前取数，不碰 Effect

```tsx
import { data, useLoaderData, type LoaderFunctionArgs } from 'react-router'

export async function taskLoader({ params, request }: LoaderFunctionArgs) {
  const tab = new URL(request.url).searchParams.get('tab') ?? 'detail'
  const task = await api.getTask(params.taskId!)
  if (!task) throw data('任务不存在', { status: 404 }) // → errorElement
  return { task, tab }
}

function TaskDetail() {
  const { task, tab } = useLoaderData<typeof taskLoader>()
  return <h1>{task.title} / {tab}</h1>
}
```

**为什么用 loader？** 导航发生时，router 先并行跑匹配链上的 loader，全部完成后再渲染新页面。它避免了“先渲染空页 → Effect 里 fetch → 再 setState”的闪烁和水瀑布，也让首屏、刷新、直接访问深链走同一条取数路径。loader 的参数是 `{ request, params, context }`；`request.url` 可以用来读 search params，`params` 是路径参数。

v8 中 loader 直接返回普通对象即可；**`json()` 已从包中移除**，不要再 `import { json }`。需要自定义 HTTP 状态或响应头时才用 `data(payload, { status, headers })`。loader 返回的是“这次渲染的数据快照”，不是 state：不要在组件里再复制进 `useState`，否则刷新、后退和 action 后的 revalidate 都会与本地副本脱节。

### 3.3 Action 与表单：提交 → 校验 → redirect 或返回错误

```tsx
import { data, redirect, type ActionFunctionArgs } from 'react-router'

// route: { path: 'tasks/new', action: createTaskAction, Component: NewTask }
export async function createTaskAction({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const title = String(form.get('title') ?? '').trim()
  if (!title) {
    return data({ errors: { title: '标题不能为空' } }, { status: 400 })
  }
  const task = await api.createTask({ title })
  return redirect(`/tasks/${task.id}`)
}
```

```tsx
function NewTask() {
  const errors = useActionData<typeof createTaskAction>()?.errors
  const navigation = useNavigation()
  return (
    <Form method="post">
      <input name="title" aria-invalid={!!errors?.title} />
      {errors?.title && <p role="alert">{errors.title}</p>}
      <button disabled={navigation.state === 'submitting'}>
        {navigation.state === 'submitting' ? '保存中…' : '创建'}
      </button>
    </Form>
  )
}
```

**为什么用 `<Form>` 而不是原生 `<form>`？** `<Form method="post">` 会阻止整页刷新，把 FormData 交给最近匹配路由的 action（在 index 路由里省略 `action` 时会自动带 `?index`，用来区分父/子 action）。action 成功后 router 自动 revalidate 当前页所有 loader，列表和详情不需要手动刷新；因此成功路径通常直接 `return redirect(...)`。

校验失败要 `return data(errors, { status: 400 })`，而不是返回普通对象：只有 2xx 会触发 revalidate，400 既表达“请求有误”，也避免无意义地重跑 loader。错误通过 `useActionData` 读回。W2D1 的 `useActionState` 适合组件内表单；当提交要改变路由数据/URL 时，用路由 action。

| API | 是否产生导航 | 待定状态 | 典型场景 |
|---|---|---|---|
| `<Form>` | 是 | `useNavigation().state` | 页面级创建/编辑 |
| `useSubmit` | 是 | `useNavigation().state` | 定时器、快捷键触发整页提交 |
| `useFetcher` | 否 | `fetcher.state` | 行内勾选、自动保存、非导航加载 |

`useSubmit` 和 `<Form>` 一样会写历史、跑 action、revalidate；`useFetcher` 不导航、状态彼此隔离，适合一个页面里多个独立的小提交。只需要简要记住这个边界，细节留到练习。

### 3.4 URL 作为状态：筛选/分页/tab 的唯一真相

```tsx
function StatusFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? 'all' // 默认值在读处给
  const setStatus = (next: string) =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev) // setSearchParams 会整体替换，先复制
      if (next === 'all') p.delete('status')
      else p.set('status', next)
      p.set('page', '1') // 换筛选回到第一页
      return p
    })
  return <button aria-pressed={status === 'done'} onClick={() => setStatus('done')}>已完成</button>
}
```

```tsx
// route: { index: true, loader: tasksLoader, Component: TaskList }
function tasksLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? 'all'
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  return { tasks: await api.listTasks({ status, page }), status, page }
}
```

**为什么放 URL？** 可分享、刷新保留、前进/后退可复现、深链首屏 loader 能直接读到；而 `useState` 在刷新和分享后丢失，还要写 Effect 与 URL 同步，最终出现两份真相。路径参数（`/tasks/:id`）表达“这是哪个资源”，search params（`?status=done&page=2`）表达“同一资源的哪种视图”，不要混用。

默认值在读取处给（`?? 'all'`、页码下限 1），不要在挂载时立刻写回 URL，否则多一次导航；`useSearchParams({ status: 'all' })` 的默认初始化只影响返回值，不会改写 URL，在读处 `??` 更直接。确实要规范化 URL 时用 `setSearchParams(next, { replace: true })`，避免污染历史。URL 变化默认会重跑匹配的 loader，所以筛选参数必须由 loader 读；如果只是纯客户端过滤，才在组件里读同一份 URL。**不要** `const [status, setStatus] = useState(searchParams.get('status'))`，那是把 URL 状态复制成第二份真相。

### 3.5 导航：声明式优先，命令式补位

```tsx
function TaskActions({ id }: { id: string }) {
  const navigate = useNavigate()
  return (
    <div>
      <Link to={`/tasks/${id}/edit`}>编辑</Link>
      <Link to="?tab=activity" preventScrollReset>活动</Link>
      <button onClick={() => navigate('..')}>返回列表</button>
      <button onClick={() => navigate(-1)}>后退一步</button>
      <button onClick={() => navigate('/', { replace: true })}>首页</button>
    </div>
  )
}
```

- 用户可点击的导航优先用 `<Link>` / `<NavLink>`：它是真正的 `<a>`，可右键新标签、可访问性更好。`useNavigate` 用于事件回调、异步完成后的跳转、键盘逻辑，**不能在 render 中调用**。
- `navigate(-1)` 等价于浏览器后退；`navigate('..')` 是路由相对导航，默认 `relative: 'route'` 按路由层级上升，`relative: 'path'` 才按 URL 段上升。
- `replace: true` 替换当前历史条目，适合登录后跳转、规范化 URL；普通用户导航保持 push。
- `preventScrollReset` 用于 search/tab 变化时不要滚回顶部（需要配合 `ScrollRestoration`）。
- loader/action 里不能用 `useNavigate`，要在渲染前跳转就 `return redirect('/login')`；它不会闪现旧页面。事件处理函数里则用 `navigate`。

### 3.6 错误处理：路由错误边界

```tsx
import { isRouteErrorResponse, useRouteError } from 'react-router'

function RouteError() {
  const error = useRouteError()
  if (isRouteErrorResponse(error)) {
    return <h1>{error.status} {error.statusText}</h1>
  }
  return <p role="alert">{error instanceof Error ? error.message : '未知错误'}</p>
}
// route: { ..., errorElement: <RouteError /> }
```

**为什么需要 `isRouteErrorResponse`？** loader/action 里 `throw data('任务不存在', { status: 404 })` 抛的是一个带 `status` / `statusText` / `data` 的错误响应；程序员 bug 抛的是 `Error`；也可能有人抛字符串。先判断响应，再判断 `Error`，最后兜底，才能给出正确 UI。`errorElement` 是最近的错误边界：子路由出错时，它替换出错路由的 UI，但祖先布局（导航栏等）仍然保留；根路由应至少有一个，防止白屏。

两种 404 要分清：

- URL 根本没匹配：`{ path: '*', Component: NotFound }`，这是正常页面，不进 `errorElement`。
- URL 匹配了，但资源不存在：loader 里 `throw data(..., { status: 404 })`，进最近的 `errorElement`。

与普通 React Error Boundary 的区别：React 边界只能捕获其子树在渲染阶段的错误，碰不到 loader/action（它们发生在渲染之外）；route `errorElement` 由 router 驱动，额外接管数据阶段的错误。但它也不是万能的：**不捕获事件处理函数、定时器、普通 Promise 回调里的错误**，那些仍要自己 `try/catch`。它也不是“业务校验”的工具，表单错误用 3.3 的 `useActionData`。data mode 里用 `errorElement`（元素）；v8 也支持 `ErrorBoundary`（组件）属性，二者互斥、等价。

### 3.7 待定状态与数据边界：loader 还是 Query

```tsx
function GlobalPending() {
  const navigation = useNavigation()
  if (navigation.state === 'idle') return null
  return (
    <p role="status">
      {navigation.state === 'submitting' ? '保存中…' : '加载中…'}
    </p>
  )
}
```

`loading` 表示正在跑下一路由的 loader（包括 action 成功后的 revalidate），`submitting` 表示 action 正在执行；用 `navigation.location.pathname` / `formAction` 可以把 spinner 限定到某次导航/表单。首次进入应用时 loader 还没完成，`RouterProvider` 没有内容可渲染，应在根路由配置 `HydrateFallback`（v8 的 data router 不再用旧的 `fallbackElement`）显示启动骨架。`<NavLink>` 的 `isPending` 还能把待定状态放到具体链接上。

**不要在 Effect 里手动 fetch 路由关键数据。** 那会绕开 loader 的并行、导航取消、action 后 revalidate 和错误边界，回到 W2D2 处理过的竞态与闪烁。与 TanStack Query 的分工只有一条原则：**同一份数据只设一个 owner，绝不双写。**

| 数据 | 归属 |
|---|---|
| 页面渲染必需的列表/详情（首屏、深链） | 路由 loader |
| 跨页面共享、缓存、后台刷新、乐观更新 | TanStack Query（W2D3） |
| 既要 loader 阻塞首屏，又要组件后续共享 | loader 用 `ensureQueryData` 预热 Query 缓存，组件读同一 key |

```tsx
const taskQuery = (id: string) => queryOptions({
  queryKey: ['task', id],
  queryFn: () => api.getTask(id),
})
export const loader = ({ params }: LoaderFunctionArgs) =>
  queryClient.ensureQueryData(taskQuery(params.taskId!))
// 组件：const { data } = useQuery(taskQuery(id)) —— 同一个缓存条目，不重复请求
```

这只是“loader 负责首屏、Query 负责后续缓存”的桥接；不要把 `useLoaderData()` 再 `setQueryData` 一份，也不要把 Query 数据复制进 `useState`。

### 3.8 测试与模式选择

```tsx
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

test('URL 里的筛选生效', async () => {
  const router = createMemoryRouter(routes, {
    initialEntries: ['/tasks?status=done'],
  })
  render(<RouterProvider router={router} />)
  expect(await screen.findByText('已完成')).toBeInTheDocument()
})
```

把 `routes` 数组单独导出，生产用 `createBrowserRouter(routes)`，测试用 `createMemoryRouter(routes, { initialEntries })`；每个测试新建 router，避免历史栈和 loader 数据串场。loader 请求可用 MSW（W3D4）或直接换成 stub loader。只测依赖路由上下文的单个组件时，官方还提供 `createRoutesStub`，它比整棵路由更轻。

| 模式 | 入口 | 能力 | 适用 |
|---|---|---|---|
| declarative | `<BrowserRouter><Routes>` | 只做路由渲染 | 静态页、渐进接入 |
| data | `createBrowserRouter` + `RouterProvider` | loader/action/error/pending | 本项目 |
| framework | `@react-router/dev` 文件路由 + SSR | 全栈、服务端数据 | 本讲只点边界 |

声明式 `<BrowserRouter>` 更简单，但没有 loader/action/路由错误边界；需要这些能力就升级到 data mode。framework mode 是另一套构建与部署模型（文件路由、服务端 loader/action），本项目使用 data mode，不在这里展开。

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| 浏览器里 `import { RouterProvider } from 'react-router'` | 从 `react-router/dom` 导入 | DOM 版内置 `flushSync`；根导出面向非 DOM 渲染环境 |
| 在组件里 `createBrowserRouter(...)` 或放进 state | 模块顶层创建一次，传给 `RouterProvider` | 每次 render 新 router，历史、loader 数据、订阅全部重建 |
| 子路由 `path: '/tasks/:taskId'` | 子路由写相对路径 `':taskId'` | 绝对子路径必须与父路径完全一致，易错且难重组 |
| 父路由组件忘记渲染 `<Outlet/>` | 在布局中放 `<Outlet/>` | 子路由匹配成功但没有任何出口可渲染 |
| `{ path: '/', Component: Home }` 当默认子页 | `{ index: true, Component: Home }` | index 路由共享父 URL，不额外增加路径段 |
| 继续 `import { json } from 'react-router'` | 直接返回普通对象；需要状态/头时用 `data()` | v8 已移除 `json` |
| 用 `useEffect + fetch + useState` 取页面数据 | 放到 route `loader`，组件用 `useLoaderData` | 避免闪烁、竞态，并接入导航取消、错误边界和 action 后 revalidate |
| action 校验失败 `return { errors }` | `return data({ errors }, { status: 400 })` | 2xx 会触发 revalidate；400 同时表达错误语义并阻止重跑 loader |
| 只判断 `navigation.state === 'loading'` 做提交按钮 | 同时处理 `'submitting'`（或判断 `formAction`） | action 执行期间是 submitting，之后 revalidate 才是 loading |
| 把 `searchParams.get('status')` 复制进 `useState` | 每次渲染从 URL 派生 | 两份真相；刷新、分享、后退都会与 URL 脱节 |
| `setSearchParams({ status })` 更新一个参数 | 先复制 `new URLSearchParams(prev)` 再改 | setter 整体替换参数，其他参数会被清掉 |
| 在 render 中调用 `navigate()` | 放进事件处理函数或 Effect | render 必须纯；会触发循环导航 |
| 在 loader/action 里调用 `useNavigate` | `return redirect(...)` | Hooks 只能在组件中调用；redirect 在渲染前完成跳转 |
| 用 `errorElement` 捕获 onClick 里的异步错误 | 事件内 `try/catch` | 路由错误边界只覆盖 loader/action 和路由渲染错误 |
| 把 loader 数据再复制到 Query 缓存或本地 state | 选定一个 owner，其他读取同一来源 | 双写会造成刷新、失效和回滚不同步 |

## 5. 三句话自测

1. 父路由为什么必须渲染 `<Outlet/>`？`index` 路由和 `path: '*'` 分别解决什么问题？——父路由是布局，`Outlet` 是子路由出口；`index` 渲染父 URL 的默认子页，`path: '*'` 兜住未匹配的 URL。
2. v8 里 loader 直接返回对象和 `data()` 有什么区别？`json` 还能用吗？——普通对象就是 200 数据，需要 status/headers 才用 `data()`，`json` 已被移除。
3. 筛选/分页为什么放 URL、loader 里怎么读、什么时候该用 Query？——放 URL 才能分享、刷新保留和支持前进后退；loader 用 `new URL(request.url).searchParams` 读；路由关键数据用 loader，跨页缓存和乐观更新用 Query，同一份数据不要双写。

## 6. 官方阅读

- https://reactrouter.com/start/data/installation
- https://reactrouter.com/start/data/route-object
- https://reactrouter.com/how-to/error-boundary
