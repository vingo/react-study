# W2D3 课前测验：TanStack Query 5

先独立作答，不查资料、不运行代码。把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W2D3.md`，做完前不要打开。

本次总分 9 分：复习题 1 分（0.5 + 0.5），新主题题 8 分（2.5 + 3 + 2.5）。

## 复习 1：Effect 的职责边界（0.5 分｜来自 W1D3 第 1 题）

下面的组件把三件不同的事都写成了 Effect。请逐条判断哪些 Effect 不该存在、哪些值应该在 render 中直接计算、`POST` 实际会在什么时机会被触发。最后给出一个真正适合放进 Effect 的外部系统同步例子。

```tsx
function OrderPanel({ roomId, items }: { roomId: string; items: Item[] }) {
  const [title, setTitle] = useState('')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setTitle(`房间：${roomId}`)
  }, [roomId])

  useEffect(() => {
    setTotal(items.reduce((sum, item) => sum + item.price * item.quantity, 0))
  }, [items])

  useEffect(() => {
    fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ roomId }),
    })
  }, [roomId])

  return (
    <section>
      <h2>{title}</h2>
      <p>总价：{total}</p>
      <button>下单</button>
    </section>
  )
}
```

**你的答案：**
1: title ，total 都不需要effect， total放在render里就可以

## 复习 2：Error Boundary 与请求竞态（0.5 分｜来自 W2D2 第 3 题）

```tsx
function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(data => setUser(data))
      .catch(err => setError(err))
  }, [id])

  return { user, error }
}

function Profile({ id }: { id: string }) {
  const { user, error } = useUser(id)
  if (error) throw error
  return user ? <h1>{user.name}</h1> : <p>加载中…</p>
}

<ErrorBoundary fallback={<p>加载失败</p>}>
  <Profile id={id} />
</ErrorBoundary>
```

1. 从 alice 快速切到 bob，bob 的响应先成功，alice 的响应后成功。最终显示谁？如果 alice 后到的是失败，而 bob 已经成功，会显示什么？为什么？
2. `.catch(err => setError(err))` 之后在 render 里 `if (error) throw error`，Error Boundary 能捕获吗？如果直接在 `.catch` 回调里 `throw err` 呢？Error Boundary 能直接捕获 fetch 的 rejection 吗？
3. 用 cleanup 修复竞态。再试着说明：如果改用 TanStack Query，它可能用哪些机制分别接管“旧请求覆盖新数据”和“异步错误没有边界接住”？（今天还没学到也没关系，先写出你的猜测。）

**你的答案：**
1: Alice， bob 失败后会直接剔除掉
2: 可以获取到，catch的回调里throw error boundary捕获不到异常。 可以捕获到reject。

## 第 1 题：queryKey 的身份与缓存命中（2.5 分）

```tsx
function TodoList({ status }: { status?: 'open' | 'done' }) {
  return useQuery({
    queryKey: ['todos', { status }],
    queryFn: () => fetchTodos(status),
    staleTime: 60_000,
  })
}

function Profile({ userId }: { userId: string }) {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => fetchProfile(userId),
    staleTime: 60_000,
  })
}
```

使用方式：列表页先渲染 `<TodoList status="open" />`，60 秒内用户点击切换到 `status="done"`；个人页先渲染 `<Profile userId="alice" />`，60 秒内切换到 `userId="bob"`。假设没有其他组件订阅这些 key。

1. 列表从 `open` 切到 `done` 时，两个 queryKey 是否相同？会不会发请求？切换瞬间 `data` 是什么？如果两种筛选都访问过，来回切换会怎样？
2. 判断下面每对 queryKey 是否会命中同一个缓存条目，并说明理由（对象键顺序、数组顺序、`undefined`）：
   - `['todos', { status, page }]` 与 `['todos', { page, status }]`
   - `['todos', status, page]` 与 `['todos', page, status]`
   - `['todos', { status: undefined }]` 与 `['todos', {}]`
   - `['todos', undefined]` 与 `['todos']`
3. `Profile` 从 alice 切到 bob 后，屏幕显示谁的数据？为什么？如果 60 秒后窗口失焦再聚焦，会发生什么？给出 queryKey 的正确写法。如果把 `staleTime` 改成 `0`，这个问题会消失吗？为什么？若希望在切换用户或翻页时先保留上一份数据、同时给出“正在更新”的提示，应该使用哪个选项？此时 `isPlaceholderData` 是什么？
4. 如果列表查询的 key 是 `['todos', { status: 'done' }]`，调用 `queryClient.invalidateQueries({ queryKey: ['todos'] })` 会失效它吗？加上 `exact: true` 呢？

**你的答案：**
1: 不同，会发请求，切换时还是上次的状态，来回切会一直触发fetchTodos 请求
2: 
2.1 same
2.2 不同
2.3: 不同
2.4 ： 相同
3: alice， 60s后显示 bob，
4: 会失效，exact： true 只查询自身

## 第 2 题：staleTime、gcTime 与加载标志（3 分）

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5_000,
    },
  },
})

function Todos() {
  const { data, isPending, isFetching } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos, // 1 秒后 resolve
  })

  if (isPending) return <p>首次加载…</p>

  return (
    <>
      {isFetching && <p>后台刷新中…</p>}
      <List data={data} />
    </>
  )
}
```

时间线（假设只有这一个组件订阅 `['todos']`，且网络请求都在 1 秒后成功）：

- `t = 0s`：首次挂载，开始请求；`t = 1s` 成功。
- `t = 10s`：组件卸载。
- `t = 12s`：组件重新挂载。
- `t = 20s`：组件再次卸载。
- `t = 26s`：组件再次重新挂载。

1. `t = 12s` 重新挂载时，屏幕立即显示什么？`fetchTodos` 会执行吗？`isPending`、`isFetching` 分别是什么？`gcTime` 和 `staleTime` 各自在这里起了什么作用？
2. `t = 26s` 重新挂载时，缓存还在吗？屏幕显示什么？`isPending`、`isFetching` 分别是什么？`fetchTodos` 会执行吗？请结合 `staleTime` 与 `gcTime` 解释原因（注意：此时数据距离上次成功才 25 秒）。
3. 如果把配置改成 `staleTime: 5_000`、`gcTime: 30_000`，重新回答 `t = 12s` 和 `t = 26s`：屏幕是否立刻有数据？有没有请求？两个标志分别是什么？会不会出现“首次加载…”？
4. 如果改成 `staleTime: Infinity`、`gcTime: 5_000`，`t = 26s` 会发请求吗？这说明了 `staleTime` 与 `gcTime` 各自控制什么？
5. 假设最后一次成功是 `t = 27s`，组件一直挂载。`t = 60s` 用户切回标签页时会发生什么？后台刷新期间 `isPending` 与 `isFetching` 各是什么？如果组件在 `isFetching` 为 true 时直接 `return <p>首次加载…</p>`，会有什么体验问题？首次骨架屏和“后台刷新中”提示分别应该依据哪个标志？`isLoading` 与这两个标志是什么关系？

**你的答案：**

## 第 3 题：mutation 的失效与乐观更新（2.5 分）

```tsx
function useToggleTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (todo: Todo) => api.updateTodo(todo),
    onMutate: async (updated) => {
      const previous = queryClient.getQueryData<Todo[]>(['todos'])
      queryClient.setQueryData<Todo[]>(['todos'], old =>
        old?.map(todo => (todo.id === updated.id ? updated : todo)),
      )
      return { previous }
    },
    onError: (_error, _updated, onMutateResult) => {
      queryClient.setQueryData(['todos'], onMutateResult?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}

function ToggleButton({ todo }: { todo: Todo }) {
  const { mutate, isPending } = useToggleTodo()

  return (
    <button
      disabled={isPending}
      onClick={() => mutate({ ...todo, done: !todo.done })}
    >
      {isPending ? '保存中…' : todo.done ? '取消完成' : '完成'}
    </button>
  )
}
```

1. 用户点击时，如果 `['todos']` 恰好有一个后台 refetch 还在途中，这个 refetch 可能在乐观更新写入缓存之后才返回并覆盖它。当前 `onMutate` 缺少哪一步？它应该放在读取 `previous` 之前还是之后？为什么必须 `await`？它默认会把那个在途请求的查询状态回退到哪里？
2. 服务端最终返回 500。请按顺序说明 `onMutate`、`mutationFn`、`onError`、`onSettled` 各自做什么，界面如何变化。回滚用的旧数据来自哪里？如果 `onSettled` 触发的重新请求也失败，缓存最终是什么状态？
3. 为什么把失效放在 `onSettled`，而不是只放在 `onSuccess`？只写 `onSuccess` 会漏掉哪些情况？
4. 当前 `onSettled` 里直接调用 `queryClient.invalidateQueries(...)` 但没有 `return`。这会让 mutation 的 `isPending` 在什么时候变成 `false`？如果希望“保存中…”一直持续到重新取数完成，应该怎样调整？为什么？
5. `invalidateQueries({ queryKey: ['todos'] })` 会匹配 `['todos', todo.id]` 这样的详情查询吗？如果只想匹配列表 key 本身、不碰详情，应该加什么选项？如果这次 mutation 改的是单条 todo，乐观更新应该改哪些缓存？只改列表或只改详情分别会有什么问题？

**你的答案：**
