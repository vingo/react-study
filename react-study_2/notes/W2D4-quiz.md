# W2D4 课前测验：React Router 8

先独立作答，不查资料、不运行代码。把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W2D4.md`，做完前不要打开。

本次总分 9 分：复习题 1 分（0.5 + 0.5），新主题题 8 分（2.5 + 3 + 2.5）。

## 复习 1：Effect 的 cleanup 与 setup 时序（0.5 分｜来自 W1D3 第 2 题）

```tsx
function ChatRoom({ roomId, theme }: { roomId: string; theme: string }) {
  useEffect(() => {
    const conn = connect(roomId)
    conn.onMessage(handleMessage)
    console.log(`connect ${roomId}`)

    return () => {
      conn.offMessage(handleMessage)
      conn.close()
      console.log(`disconnect ${roomId}`)
    }
  }, [roomId])

  return <h1>{roomId}</h1>
}
```

`roomId` 从 `"general"` 变为 `"random"`，之后整个组件卸载。按时间顺序写出所有 `connect` / `disconnect` 日志（按非 StrictMode 的挂载语义作答）。`theme` 变化时会不会重连？如果连接成功的回调里需要读取最新的 `theme`，但又不能让 `theme` 变化触发重连，应该用什么，依赖数组怎么写？

**你的答案：**
connect general-> disconnect general -> connect random -> disconnect random
theme变化不影响重链

const onConnected = useEffectEvent(() => {
  showToast(`已连接，当前主题：${theme}`)
})

useEffect(() => {
  const conn = connect(roomId)
  conn.onConnected(onConnected)
  return () => conn.close()
}, [roomId])

## 复习 2：Error Boundary 重试与请求竞态（0.5 分｜来自 W2D2 第 3 题）

```tsx
function Comments({ postId }: { postId: string }) {
  const [attempt, setAttempt] = useState(0)
  const commentsPromise = useMemo(
    () => fetchComments(postId),
    [postId]
  )

  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <button
          onClick={() => {
            resetErrorBoundary()
            setAttempt(a => a + 1)
          }}
        >
          重试
        </button>
      )}
    >
      <Suspense fallback={<p>加载中…</p>}>
        <CommentsList promise={commentsPromise} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

1. 第一次加载失败后点击“重试”，为什么很可能立刻又回到错误 UI？`resetErrorBoundary()` 和 `setAttempt` 各自改变了什么？`useMemo` 的依赖应怎样调整？只改其中一处够吗？
2. 当前 `ErrorBoundary` 没有 `key`。在错误 UI 显示时把 `postId` 从 A 改成 B，用户会看到什么？为什么？`key` 应加在哪一层？
3. 假设 `CommentsList` 改成在 Effect 里 fetch 并在成功后 `setComments`，从 A 切到 B 时 A 的响应后到。最终显示谁的数据？如何用 cleanup 修复？

**你的答案：**
1:  失败后，点击重试会直接取引用的 commentsPromise 的 `useMemo` 依赖只有 `[postId]`。
 `setAttempt` 让组件重渲染， resetErrorBoundary 执行后会重新渲染 children，读取到同一个rejected promise，又立刻抛出同一个错误，fallback 再次出现。
 2个一起做： 重置边界：`resetErrorBoundary()`； 把attemp添加到依赖里，useMemo(
    () => fetchComments(postId),
    [postId， attempt])
2: 用户会看到 A的fallback信息，  postId更新会让父组件重新渲染，但是Error Boundary 自身的错误状态还在，不会重新渲染b到children。 key应该添加到ErrorBoundary上,如：`<ErrorBoundary key={postId} ...>`，只给 `Suspense` 或 `CommentsList` 加 key 不够，因为错误状态在边界自身。
3: 显示A，因为A的响应会覆盖掉B的数据。
`useEffect(() => {
  let ignore = false

  fetchComments(postId)
    .then(data => {
      if (!ignore) setComments(data)
    })
    .catch(err => {
      if (!ignore) setError(err)
    })

  return () => {
    ignore = true
  }
}, [postId])`



## 第 1 题：嵌套路由、布局与 404（2.5 分）

```tsx
const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    errorElement: <RootError />,
    children: [
      { index: true, Component: Dashboard },
      {
        path: 'projects/:projectId',
        Component: ProjectLayout,
        children: [
          { index: true, Component: ProjectOverview },
          { path: 'tasks', Component: TaskList },
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
  const { projectId } = useParams()
  return (
    <section>
      <h2>项目 {projectId}</h2>
    </section>
  )
}

function RootError() {
  const error = useRouteError()
  if (isRouteErrorResponse(error)) {
    return (
      <h1>
        {error.status} {error.statusText}
      </h1>
    )
  }
  return <h1>出错了</h1>
}
```

1. 访问 `/` 时，`RootLayout`、`Dashboard` 哪些会出现在页面上？`Dashboard` 的内容会显示在哪里？为什么？
2. 访问 `/projects/42/tasks` 时，`TaskList` 会渲染吗？页面实际显示什么？用最小改动让 `/`、`/projects/42`、`/projects/42/tasks` 都按预期显示。
3. 假设 `ProjectOverview` 的 loader 在项目不存在时执行 `throw new Response('Project not found', { status: 404 })`。访问 `/projects/42` 时，`RootError` 会渲染吗？`RootLayout` 的 `<Header />` 还在吗？`useRouteError()` 返回的对象有哪些关键字段？`isRouteErrorResponse(error)` 是 `true` 吗？
4. 访问完全不存在的 `/nope` 时，哪个组件会渲染？`useRouteError()` 得到的 `status` / `statusText` 是什么？如果根路由没有 `errorElement`，用户会看到什么？

**你的答案：**
1: 显示RootLayout，页面上有 `<Header />` 和一个空的 `<main />`，
2: `TaskList` **不会**渲染， 只有RootLayout组件里的内容，因为：`RootLayout` 没有 `<Outlet />`，所以 `ProjectLayout` 根本不会渲染。
最小修复：在 `RootLayout` 的 `<main>` 里放 `<Outlet />`，并在 `ProjectLayout` 的 `<section>` 里也放 `<Outlet />`：
3:  会渲染rootError；
<Header />不在了，rootLayout被rootError组件替换掉了；
返回的对象有： status：400，data： 'Project not found'；
`isRouteErrorResponse(error)` 为 `true`；
4: 会渲染rootError组件， 获取到的对象信息：- `status: 404`；
   - `statusText: 'Not Found'`；
   - `data` 是包含 `No route matches URL "/nope"` 的错误字符串/错误对象；
   - `isRouteErrorResponse(error)` 为 `true`。
   如果没有errorElement设置，React Router 会显示内置的默认错误页面

## 第 2 题：loader / action 的数据流（3 分）

```tsx
// 路由配置
{
  path: '/projects/:projectId/tasks/new',
  loader: async ({ params }) => {
    const project = await getProject(params.projectId)
    return { project }
  },
  action: async ({ request, params }) => {
    const formData = await request.formData()
    const title = String(formData.get('title') ?? '').trim()

    if (!title) {
      return { error: '标题不能为空' }
    }

    await createTask(params.projectId, title)
    redirect(`/projects/${params.projectId}/tasks`)
    return { error: null }
  },
  Component: NewTask,
}
```

```tsx
function NewTask() {
  const { project } = useLoaderData()
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSaving = navigation.state === 'loading'

  return (
    <Form>
      <h1>{project.name}</h1>
      {actionData?.error ? <p role="alert">{actionData.error}</p> : null}
      <input name="title" />
      <button type="submit" disabled={isSaving}>
        {isSaving ? '保存中…' : '创建任务'}
      </button>
    </Form>
  )
}
```

1. 首次渲染 `NewTask` 时，`useLoaderData()`、`useActionData()`、`navigation.state` 分别是什么？用户填了标题后直接点击“创建任务”，实际执行的是 loader 还是 action？URL 和 `actionData` 会发生什么？
2. 给 `<Form>` 补上 `method="post"` 后：
   - 标题为空时，从点击到界面稳定，`navigation.state` 如何变化？action 返回什么？页面会跳转吗？`useActionData()` 是什么？loader 还会执行吗？
   - 标题合法时，`redirect(...)` 这一行会让页面跳到任务列表吗？为什么？action 最终返回什么？怎样改才能跳转？
3. 补上 `method="post"` 后，这段代码的 pending UI 有一个 bug：提交期间按钮通常不会显示“保存中…”也不会被禁用。指出原因并给出至少一种修法。若把路由 path 里的 `:projectId` 改成 `:id`，这段代码还有哪些地方会坏？
4. `await request.formData()` 和 `formData.get('title')` 各自得到什么？如果漏掉 `await`，会在什么时候、以什么形式暴露问题？

**你的答案：**
1: useLoaderData 返回loader对象， useactionData 返回undefined，navigation.state = 'idel'；
实际执行的是loader，因为Form表单没有设置method，URL 会变成类似 `/projects/42/tasks/new?title=...`； actionData的值不变；
2: 标题为空，`navigation.state` 变为 `'submitting'`
action 返回 {error: '标题不能为空'}，页面不会跳转；
标题合法时：不会跳到tasks页面，返回 {error: null}， 直接return `redirect(...)`
3: 提交后执行action，根据`navigation.state` = `'submitting'` 来判断 isSaving
4:  `await request.formData()` 得到表单的信息实例，`formData.get('title')` 获取到 表单里的 name为title 的元素的值。 没有await，`request.formData()` 返回的就是promise对象。

## 第 3 题：URL 作为状态（2.5 分）

```tsx
// /tasks 路由
{
  path: 'tasks',
  loader: async ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') ?? ''
    const page = Number(url.searchParams.get('page') ?? '1')
    return { tasks: await searchTasks(q, page), q, page }
  },
  Component: TaskList,
}
```

```tsx
function TaskList() {
  const { tasks, q, page } = useLoaderData()
  const [search, setSearch] = useState(q)
  const [, setParams] = useSearchParams()

  useEffect(() => {
    setSearch(q)
  }, [q])

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      <button onClick={() => setParams({ q: search, page: '1' })}>
        搜索
      </button>
      <p>第 {page} 页</p>
      <button onClick={() => setParams({ q, page: String(page + 1) })}>
        下一页
      </button>
      <ul>
        {tasks.map(t => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

1. 当前 URL 是 `/tasks?q=react&page=1`。用户在输入框输入 `router`（还没点搜索）时，loader 会执行吗？为什么？输入框显示什么？接着点击“搜索”，URL 会变成什么？loader 会执行吗？`TaskList` 会重新挂载吗？`q`、`page`、`search` 分别是什么？
2. 假设当前 URL 是 `/tasks?q=react&page=2&sort=due`，点击“下一页”后 URL 是什么？`sort` 还在吗？为什么？如果希望保留 `sort` 和其他现有参数，应该怎么写？
3. 用户依次搜索 `react`（第 1 页）、搜索 `vue`（第 1 页）、点“下一页”（第 2 页），然后连续点两次浏览器后退。每次后退 loader 会执行吗？`useNavigationType()` 返回什么？第二次后退后输入框显示什么？
4. 用户输入 `vue` 但没点“搜索”，直接点“下一页”。URL、列表和输入框分别是什么？为什么会出现不一致？给出两种避免这种不一致的设计。

**你的答案：**
1: 不会执行loader，search的state变化不会触发loader，输入框显示 router，url不变。
点击搜索后，search params 发生变化，会触发loader，返回新的url更新为 q=router&page=1,taskList不会重新挂载，q=router,page=1,search=router
2: url= `/tasks?q=react&page=3` ;
sort不在了，由于setParams({ q, page: String(page + 1) })会重写原有的值；
保留原参数：
  `setParams(prev => {
     const next = new URLSearchParams(prev)
     next.set('q', q)
     next.set('page', String(page + 1))
     return next
   })`
3: 会执行loader， url为`?q=react&page=1`；
`useNavigationType()` 返回 POP；
输入框显示：react
4： 因为点击下一页代码：setParams({ q, page: String(page + 1) })，只更新了page，q读取的是loader里的值还是上一次的 react， 就会出现页面显示的 vue，但是tasks是 react的内容。
统一q的来源，全部从url中读取， 
const [search, setSearch] = useState(q)
const {params } =useSearchParams();
<input value={params.q} onChange={e => setSearch(e.target.value)} />
<button onClick={() => setParams({ q: search, page: '1' })}>
  搜索
</button>
 <button onClick={() => setParams({ q: search, page: String(page + 1) })}>
        下一页
  </button>
