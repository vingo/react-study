# W2D3：TanStack Query 5

> 以 `@tanstack/react-query` 5.107.1 为准。承接 [W2D2](W2D2-suspense-use.md)：Suspense 只负责“渲染期等待”，不负责缓存、去重、重试、失效；本讲补齐服务端状态层。v5 的三个高频差异：`gcTime`（不是 `cacheTime`）、`isPending`（无数据）与 `isLoading`（首次请求中）的区分、`placeholderData: keepPreviousData`。

## 1. 一句话结论

TanStack Query 把服务端状态从组件 `useState` 提升为应用级缓存：`queryKey` 是缓存地址和依赖，`queryFn` 是取数方式，`staleTime` / `gcTime` 决定何时后台重取与何时回收；写入用 `useMutation`，再用失效或乐观更新让缓存与服务器重新对齐。

## 2. 心智模型

```text
组件 render
  useQuery({ queryKey, queryFn })
        │ 订阅
        ▼
  QueryClient（应用级单例）
  Query Cache: hash(queryKey) → Query {
    data, status, fetchStatus, dataUpdatedAt, observers
  }
        │
        ├─ 有缓存且 fresh ──► 直接返回，不发请求
        │
        └─ 无缓存 / stale
              │
              ▼
        queryFn({ queryKey, signal }) ──► 服务器
              ├─ 成功：写缓存 → 通知所有同 key 组件
              └─ 失败：按 retry 重试 → 耗尽后 isError

写：useMutation → mutationFn(variables)
      └─ onSuccess / onSettled
            ├─ invalidateQueries(key)：标 stale，active 查询后台重取
            └─ setQueryData(key, data)：立即改缓存（含乐观更新）
```

三句话记住：**key 决定“这是哪份数据”，cache 决定“现在能不能直接用”，mutation 决定“写完以后怎么让缓存重新可信”。**

## 3. 要点

### 3.1 服务端状态：为什么用 useQuery 取代 useEffect + useState

客户端状态是本地 UI 的真相（开关、表单草稿）；服务端状态只是远端数据在本地的缓存副本，存在远端、只能异步读写、可能被别人修改、随时会过期。手写 `useEffect + useState` 要自己补缓存、并发去重、重试、竞态、后台刷新和失效，而且每个组件各存一份副本。

```tsx
// ✗ 手写：缓存、去重、重试、竞态都要自己处理
function TodosBad() {
  const [todos, setTodos] = useState<Todo[] | null>(null)
  useEffect(() => {
    let ignore = false
    fetch('/api/todos').then((r) => r.json()).then((d) => {
      if (!ignore) setTodos(d)
    })
    return () => { ignore = true }
  }, [])
  if (!todos) return <p>加载中…</p>
  return <List todos={todos} />
}
```

```tsx
function Todos() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['todos'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/todos', { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<Todo[]>
    },
  })
  if (isPending) return <p>加载中…</p>
  if (isError) return <p role="alert">{error.message}</p>
  return <List todos={data} />
}
```

**为什么更好？** 同一 `queryKey` 的多个组件共享一个缓存和一个 in-flight 请求；组件卸载再挂载可以直接复用数据；后台刷新时旧数据仍在；失效、重试、取消都有统一入口。注意 `fetch` 不会因 4xx/5xx 自动抛错，`queryFn` 要自己检查 `res.ok`，并且不能返回 `undefined`。也不要再把 `data` 复制进 `useState`，否则又变成两份真相。

### 3.2 QueryClient 与 QueryClientProvider：一个应用一个缓存

```tsx
// queryClient.ts
import { QueryClient } from '@tanstack/react-query'
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 2 },
    mutations: { retry: 0 },
  },
})

// main.tsx
import { QueryClientProvider } from '@tanstack/react-query'
createRoot(el).render(
  <QueryClientProvider client={queryClient}><App /></QueryClientProvider>,
)
```

`QueryClient` 持有 query cache、mutation cache 和默认 options；`QueryClientProvider` 通过 context 把它下发给 `useQuery` / `useMutation` / `useQueryClient`。默认值只是兜底，单个查询可以覆盖。**不要**在组件函数体里 `new QueryClient()`：每次 render 都会得到新缓存，旧数据全部丢失，Provider 的 value 变化还会让整棵查询树重新挂载和请求。SPA 用模块级单例；SSR 或测试则每个请求 / 每个测试新建，绝不能跨请求共享缓存。

### 3.3 Query Key：缓存地址，也是 queryFn 的依赖

```ts
import { queryOptions } from '@tanstack/react-query'
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (status: string, page: number) =>
    [...todoKeys.lists(), { status, page }] as const,
  detail: (id: number) => [...todoKeys.all, 'detail', id] as const,
}
export const todosOptions = (status: string, page: number) =>
  queryOptions({
    queryKey: todoKeys.list(status, page),
    queryFn: () => fetchTodos({ status, page }),
    staleTime: 30_000,
  })
```

Query key 顶层必须是数组，内容必须能被 `JSON.stringify` 序列化，并且唯一描述这份数据。默认 hash 是确定性的：对象字段顺序不影响结果（`{ status, page }` 与 `{ page, status }` 相同），但**数组顺序会影响**（`['todos', 1, 2]` 不等于 `['todos', 2, 1]`）。前缀匹配让 `['todos']` 命中所有以它开头的 key，所以工厂里把 `detail` 也放在 `all` 下面，之后一次失效就能覆盖列表和详情。

**key 必须包含 queryFn 里所有会变化的参数**：`status`、`page`、`userId`、`locale` 等。key 是依赖，漏掉就会出现“参数变了但还读旧缓存”或“该重取却不重取”。反过来，不要把不影响结果的参数塞进 key：函数、类实例不可序列化；随机数或 `Date.now()` 每次都会产生新缓存条目，导致无限请求；内容会变的临时对象同样会让 key 抖动。对象引用可以是新的，只要内容稳定；默认按内容 hash，不需要为了“稳定”强行 memo key 对象。

`queryOptions` 在运行时原样返回对象，但能统一 key 与 queryFn 的位置，并获得完整类型推导；`useQuery`、`prefetchQuery` 可以直接复用它，`setQueryData` 则使用它的 `.queryKey`。

### 3.4 useQuery：状态机、依赖查询、派生与占位数据

```tsx
const selectPost = (post: Post) => ({ title: post.title, author: post.author.name })

function Post({ id }: { id: number | undefined }) {
  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['post', id],
    queryFn: ({ signal }) => fetchPost(id!, signal),
    enabled: id != null,
    select: selectPost,
  })
  if (id == null) return <p>请选择文章</p>
  if (isLoading) return <p>首次加载…</p>
  if (isError) return <p role="alert">{error.message}</p>
  return <p>{data?.title}{isFetching && ' 后台刷新中…'}</p>
}
```

| 字段 | 含义 | 什么时候用 |
|---|---|---|
| `status: 'pending'` / `isPending` | 没有缓存数据、没有 placeholder、也没有错误 | 首次真正无数据可显示 |
| `isLoading` | `isPending && isFetching`，即首次请求正在跑 | 依赖查询、`enabled: false` 时不会误报加载 |
| `isFetching` | `queryFn` 正在执行，包含后台刷新 | 顶部细进度条、刷新提示 |
| `isError` / `error` | 重试耗尽后（或 `select` 抛错） | 错误 UI，配合 Error Boundary 也行 |

关键区别：`enabled: false` 且没有缓存时，`status` 仍是 `pending`，但 `fetchStatus` 是 `idle`，所以 `isPending === true`、`isLoading === false`。依赖查询里如果直接用 `isPending` 判断加载，会永远显示“加载中”；应该先判断参数是否存在，或用 `isLoading`。v5 也可以用 `skipToken` 代替 `enabled`，让 `queryFn` 的参数类型自动收窄。

`select` 只改变组件拿到的 `data`，缓存里仍存完整响应。它会在数据或函数引用变化时重新执行，所以把 `select` 定义在模块顶层或用 `useCallback` 固定引用。分页 / 搜索切换时保留上一页数据：

```tsx
import { keepPreviousData, useQuery } from '@tanstack/react-query'

const { data, isPlaceholderData, isFetching } = useQuery({
  queryKey: ['todos', page],
  queryFn: () => fetchTodos(page),
  placeholderData: keepPreviousData,
})
```

`keepPreviousData` 让新 key 在加载时先显示上一个 key 的成功数据，此时 `status` 是 `success`、`isPlaceholderData` 为 `true`，不会闪回骨架屏；placeholder 不写入缓存。`initialData` 则会真正写入缓存，并默认被视为 stale，二者不要混用。`queryFn` 的参数是 `QueryFunctionContext`，至少会给你 `queryKey` 和 `signal`。

### 3.5 staleTime 与 gcTime：fresh / stale / inactive 的生命周期

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 分钟内 fresh：挂载/聚焦/重连不自动重取
      gcTime: 10 * 60_000,        // 无订阅后 10 分钟才从内存删除
      refetchOnWindowFocus: true, // 只对 stale 查询生效
    },
  },
})
```

```text
首次 mount ──► 无缓存 ──► isPending + 请求
                  │
                  └─ 有缓存 ──► 先显示缓存
                                   │
                     age < staleTime（fresh）
                       └─► 不自动重取
                     age ≥ staleTime（stale）
                       └─► 后台重取，旧数据继续显示（isFetching）
最后一个 observer 卸载 ──► inactive ──► gcTime 计时 ──► 删除缓存
```

- **fresh**：数据还新鲜，mount、窗口聚焦、网络重连都不会自动重取（除非 `refetchOn*: 'always'`）。
- **stale**：数据过期但仍在缓存；先同步显示旧数据，再后台重取。默认 `staleTime` 是 `0`，所以数据一拿到就算 stale，但重取只发生在上述事件，不是每秒轮询。
- **inactive**：没有组件订阅，条目仍留在缓存，`gcTime` 到期才被垃圾回收；期间重新挂载会复用缓存并取消回收计时。
- 默认值：`staleTime: 0`、`gcTime: 5 * 60_000`、查询 `retry: 3`、`refetchOnWindowFocus: true`、`refetchOnReconnect: true`。
- `staleTime` 只管“新不新”，`gcTime` 才管“删不删”。通常让 `gcTime >= staleTime`，否则 fresh 数据可能先被回收。`staleTime: Infinity` 永不因过期重取，但 inactive 后仍会被 GC；5.107 的 `'static'` 更严格，连 `invalidateQueries` 都不会让它重取。

### 3.6 useMutation：写入、pending 与回调

```tsx
function AddTodo() {
  const qc = useQueryClient()
  const add = useMutation({
    mutationFn: (title: string) => api.createTodo(title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
    onError: (err) => console.error('创建失败', err),
    onSettled: () => console.log('请求结束'),
  })
  return (
    <button disabled={add.isPending} onClick={() => add.mutate('写讲义')}>
      {add.isPending ? '保存中…' : '添加'}
    </button>
  )
}
```

mutation 用于创建、更新、删除等写操作。`mutationFn(variables)` 返回 Promise；mutation 的状态属于当前 hook 实例，不像 query 那样按 key 全局共享。生命周期是 `onMutate → mutationFn → onSuccess / onError → onSettled`，其中 `onSettled` 无论成功失败都会执行。结果状态有 `isPending` / `isError` / `isSuccess`、`data`、`error`、`variables`；`reset()` 可以把它们清回初始状态。

`mutate(vars)` 返回 `void`，错误进入 `error` state 和回调，适合“点一下就走”的 UI；`mutateAsync(vars)` 返回 Promise，失败会 reject，**必须自己 `try/catch`**，否则产生未处理的 rejection。传给 `mutate` 的 per-call 回调只对“最后一次调用”生效，且组件卸载后不再触发；hook 级别的 `onSuccess` / `onError` 则对每次 mutation 都生效。若 `onSuccess` / `onSettled` 返回 Promise（例如返回 `invalidateQueries`），mutation 会保持 `isPending` 直到它完成；上面的箭头函数正好把 Promise 返回了出去。mutation 默认 `retry: 0`，只对幂等写操作考虑开启重试。

### 3.7 失效与缓存更新：invalidate、setQueryData、refetch

```tsx
const qc = useQueryClient()

await qc.invalidateQueries({ queryKey: ['todos'] }) // 前缀：所有 todos 子键
await qc.invalidateQueries({ queryKey: ['todos'], exact: true }) // 仅自身
await qc.invalidateQueries({ queryKey: ['todos'], refetchType: 'none' }) // 只标脏

qc.setQueryData<Todo>(['todos', 'detail', 1], updatedTodo) // 立即写缓存（不可变）

await qc.refetchQueries({ queryKey: ['todos'], type: 'active' }) // 无视 fresh 强制重取
```

`invalidateQueries` 做两件事：把匹配的查询标记为 stale（覆盖 `staleTime`），并默认对 **active**（当前有组件订阅）的查询后台重取；inactive 查询只标脏，下次挂载时再取。默认等价于 `refetchType: 'active'`，`'none'` 只标脏，`'all'` 连 inactive 也重取。匹配默认是前缀，`exact: true` 只命中完全相同的 key，复杂条件可用 `predicate`。

`setQueryData` 是同步写缓存，适合直接用 mutation 返回值更新详情，省掉一次 GET；更新必须不可变（返回新对象），不能原地改 `oldData`。它不会自动让查询失效，列表顺序、计数等服务器端变化仍可能需要 `invalidateQueries`。`setQueriesData` 可以按前缀批量改多个缓存。`refetchQueries` 与失效不同：它不管数据新不新，直接强制重取，适合手动刷新 / 重试。

### 3.8 乐观更新：先改缓存，失败回滚，最终以服务器为准

```tsx
const qc = useQueryClient()
const toggle = useMutation({
  mutationFn: (todo: Todo) => api.updateTodo(todo),
  onMutate: async (next) => {
    await qc.cancelQueries({ queryKey: ['todos'] })
    const previous = qc.getQueryData<Todo[]>(['todos'])
    qc.setQueryData<Todo[]>(['todos'], (old) =>
      old?.map((t) => (t.id === next.id ? next : t)),
    )
    return { previous }
  },
  onError: (_err, _next, onMutateResult) =>
    qc.setQueryData(['todos'], onMutateResult?.previous),
  onSettled: () => qc.invalidateQueries({ queryKey: ['todos'] }),
})
```

顺序不能乱：

1. `await cancelQueries`：取消在途 GET，避免它在乐观写入之后返回、把新值覆盖回旧值。
2. 快照：`getQueryData` 保存回滚点，必须在取消之后取。
3. `setQueryData`：用更新函数做不可变更新。
4. `return` 快照：5.107 会把它作为 `onMutateResult` 传给 `onError` / `onSettled`（旧文章常把这个位置叫 `context`）。
5. `onError` 回滚；`onSettled` 无论成败都失效，让服务器真值最终覆盖乐观值。
6. 并发 mutation 时，后一个快照可能已包含前一个的乐观值，前一个回滚会连带抹掉后一个。用 mutation 的 `scope: { id: 'todo' }` 串行化，或按单条 key 更新与回滚，不要用整张列表的全局快照硬扛并发。

只有一处 UI 需要显示乐观结果时，也可以不改缓存，直接用 `mutation.variables` 渲染临时项；多处共享同一份数据时，改缓存更合适。

### 3.9 错误、重试、取消，以及 QueryClient 的单例边界

```tsx
const { data } = useQuery({
  queryKey: ['todos'],
  queryFn: async ({ signal }) => {
    const res = await fetch('/api/todos', { signal }) // 把取消信号交给 fetch
    if (!res.ok) throw new Error(`HTTP ${res.status}`) // fetch 不会自动抛 4xx
    return res.json() as Promise<Todo[]>
  },
  retry: (failureCount, error) =>
    failureCount < 2 && !(error instanceof HttpError && error.status < 500),
})
```

查询默认失败后静默重试 3 次，退避时间指数增长、上限 30 秒；错误只在重试耗尽后进入 `isError`。4xx 这类确定性错误重试也不会成功，生产里用带 `status` 的错误类，在 `retry` 里排除（假设上面的 `HttpError` 由 API 层抛出）。mutation 默认不重试，因为它可能不是幂等的。`retryDelay` 可自定义退避。

取消：TanStack Query 给 `queryFn` 一个 `AbortSignal`，查询过期或失活时会 abort；只有你把它传给 `fetch`（消费它）才真正取消底层请求。默认情况下，组件卸载不会取消请求，Promise 完成后结果仍写入缓存——这通常是好事，下次挂载能直接复用。需要手动取消时用 `qc.cancelQueries({ queryKey })`，它会把查询状态回退到请求前；该能力不适用于 `useSuspenseQuery`。

QueryClient 不要再犯这个错：

```tsx
// ✗ 每次 render 新 client：缓存清空、查询重挂载
function App() { const client = new QueryClient(); return <QueryClientProvider client={client}>…</QueryClientProvider> }

// ✓ 模块级单例；SSR 每个请求新建
export const queryClient = new QueryClient()
```

### 3.10 何时不需要 TanStack Query，以及与 W2D5 Zustand 的分工

```tsx
import { create } from 'zustand'

type UIState = { sidebarOpen: boolean; toggleSidebar: () => void }
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
```

| 状态类型 | 放在哪里 |
|---|---|
| 服务端数据（任务列表、用户、详情） | TanStack Query 缓存 |
| 可分享 / 可后退的状态（筛选、分页、tab） | URL / React Router（W2D4） |
| 组件局部 UI 状态 | `useState` / `useReducer` |
| 客户端全局状态（主题、侧边栏、命令面板、草稿） | Zustand（W2D5） |

不需要 TanStack Query 的场景：只发一次、不缓存、不共享、不重取的请求；构建期静态数据；框架的 RSC / loader 已经统一管理缓存；小到缓存带来的复杂度超过收益。反过来，只要有列表 + 详情 + 写入 + 失效，它很快就能回本。

最重要的边界：**不要把 query 数据复制进 Zustand**。`useEffect(() => setStore(data), [data])` 会制造两份真相，`invalidateQueries` 也刷新不到 store；UI 直接从 `useQuery` / `select` 派生。TanStack Query 不是通用状态管理器，它只接管服务端状态；把服务端状态移走后，Zustand 里剩下的通常只有很少的客户端全局状态。

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| 在组件函数体里 `new QueryClient()` | 模块级单例；SSR / 测试每请求或每测试新建 | 每次 render 新缓存，数据丢失、重复请求、Provider 重挂载 |
| key 里漏掉 queryFn 依赖的 `page` / `status` | 所有影响结果的参数都放进 key | key 是依赖；漏掉会读错缓存或该重取时不重取 |
| key 里放函数、类实例、随机数、`Date.now()` | 只放稳定、可 JSON 序列化的值 | 不可序列化或每次新 key，产生无限缓存条目和请求 |
| 认为 key 对象必须 memo 才能稳定 | 保证对象内容稳定即可，默认按内容 hash | 对象字段顺序不影响；数组顺序和内容才影响 |
| 用 `isPending` 判断 `enabled: false` 的加载 | 先判断参数，或用 `isLoading` | disabled 时 `isPending` 仍为 true，但根本没有请求 |
| 把 `isFetching` 当首次加载 | 首次用 `isPending` / `isLoading`，后台刷新用 `isFetching` | `isFetching` 也包含后台重取，会误显示整页 loading |
| 继续写 `cacheTime` | 用 `gcTime` | v5 已改名，`cacheTime` 不存在 |
| 认为 `staleTime` 会删除缓存 | 新鲜度用 `staleTime`，删除用 `gcTime` | 数据 stale 仍会显示；inactive 到期才回收 |
| mutation 后只 `setQueryData` 不失效 | 用返回值写详情；列表 / 计数仍按需 `invalidateQueries` | 只更新一个条目，服务器端的其他变化不会同步 |
| 乐观更新不先 `cancelQueries` | 先 `await cancelQueries`，再快照和写缓存 | 在途 GET 晚到会覆盖乐观值 |
| 乐观更新失败后不回滚、`onSettled` 不失效 | `onError` 用快照回滚，`onSettled` 失效 | UI 卡在错误值，缓存与服务器长期不一致 |
| `mutateAsync` 不 `try/catch` | 捕获 rejection，或改用 `mutate` + `error` state | 未处理的 Promise rejection；回调也不保证执行 |
| 认为组件卸载会自动取消请求 | 把 `signal` 传给 `fetch`；需要时手动 `cancelQueries` | 默认请求会继续，完成后仍写入缓存 |
| 把服务端数据镜像进 Zustand | query 缓存作为唯一真相，UI 从查询派生 | 两份真相，失效与刷新不同步 |

## 5. 三句话自测

1. Query key 是缓存地址也是依赖：必须是可序列化数组、包含所有影响结果的参数；前缀匹配让 `invalidateQueries({ queryKey: ['todos'] })` 命中所有子键，`exact: true` 只命中自身。
2. `staleTime` 决定数据多久算新鲜（默认 0），`gcTime` 决定无订阅缓存多久被回收（默认 5 分钟）；fresh 时挂载 / 聚焦 / 重连不重取，stale 时先显示缓存再后台重取，inactive 到期被 GC。
3. 写入后在 `onSuccess` / `onSettled` 失效相关查询；乐观更新按 `cancelQueries → 快照 → setQueryData → onError 回滚 → onSettled invalidate`，并且 `mutate` 的错误走 state / 回调，`mutateAsync` 的 rejection 必须自己 catch。

## 6. 官方阅读

- https://tanstack.com/query/latest/docs/framework/react/overview
- https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
- https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
