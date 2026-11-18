# W2D5 课前测验：状态管理选型与 Zustand 5

先独立作答，不查资料、不运行代码。把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W2D5.md`，做完前不要打开。

本次总分 9 分：复习题 1 分（0.5 + 0.5），新主题题 8 分（2.5 + 3 + 2.5）。

## 复习 1：interval 的过期闭包与 cleanup（0.5 分｜来自 W1D3 第 3 题）

```tsx
function Timer() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1)
      console.log('tick', count)
    }, 1000)

    return () => clearInterval(id)
  }, [])

  return <p>{count}</p>
}
```

1. 1 秒后、2 秒后、5 秒后页面分别显示多少？每次 tick 时 `console.log` 打印的 `count` 是多少？
2. 为什么会出现这种结果？怎样改才能让页面每秒正确加 1？依赖数组要不要加 `count`？加上之后会带来什么副作用？
3. 如果仍然希望在每次 tick 时打印最新的 `count`，但不想因此重置 interval，可以用什么？写出关键代码。

**你的答案：**
1: 都显示1，打印的时：0，
2: 因为count初始值时0 ， setCount（count+1）这样的方式每次执行的时候count都是0 ，
修改为函数， setCount(() => count+1),
依赖不需要加count， 因为 setInterval触发一次就够了，不需要每次count更新后都要重新创建。添加后会多次重建id
3:

## 复习 2：URL 作为状态（0.5 分｜来自 W2D4 第 3 题）

```tsx
function TaskList() {
  const { q, page } = useLoaderData()
  const [draft, setDraft] = useState(q)
  const [, setParams] = useSearchParams()

  return (
    <div>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => setParams({ q: draft, page: '1' })}>搜索</button>
      <button onClick={() => setParams({ q, page: String(page + 1) })}>
        下一页
      </button>
      <p>第 {page} 页</p>
    </div>
  )
}
```

当前 URL 是 `/tasks?q=react&page=2&sort=due`。用户在输入框里输入 `vue`，但**没有**点“搜索”，随后直接点“下一页”。

1. 点击后 URL、列表数据和输入框分别是什么？loader 会重新执行吗？`TaskList` 会重新挂载吗？
2. `sort=due` 还在吗？为什么？如果要保留 URL 中所有现有参数，应该怎么写？
3. 为什么输入框显示的内容和列表实际使用的查询词会不一致？指出这份状态的两个来源。

**你的答案：**
1: 点击下一页后 ，q还是react，page=2，loader会因为page更新而触发。taskList不会
2: sort不在了， 因为 setParams（{}）的写法,会全部覆盖掉旧的值。
  const [params] = useSearchParams()；
  params.set('q', 'vue')
  setParams(params)
3: 主要原因是读取的来源有2个，一个是组件内的state，一个是loader里的url参数。

## 第 1 题：状态归属与服务端数据（2.5 分）

项目看板同时使用 React Router、TanStack Query 和 Zustand。请判断下列状态应该放在哪里。对每一项写出 **local / URL / server / global（Zustand）** 之一，并给一句理由；如果存在合理的第二种选择，写清取舍。

1. 搜索框里正在输入、尚未提交的文本。
2. 已提交的筛选条件 `status` 和页码 `page`，刷新和分享链接后都要保留。
3. 从 `/api/tasks?status=...&page=...` 拉取的任务列表、`isPending`、`error`。
4. 全站主题 `theme`，刷新后保留。
5. 侧边栏是否折叠，所有页面共享，但不要求刷新后保留。
6. 正在编辑的卡片标题草稿，取消编辑就丢弃。
7. “新建任务”对话框是否打开；页头和看板里各有一个按钮都能打开它。
8. 拖拽卡片过程中的临时坐标和占位顺序。

接着看下面的组件：

```tsx
function TaskBoard() {
  const [params] = useSearchParams()
  const status = params.get('status') ?? 'all'
  const page = Number(params.get('page') ?? '1')

  const { data, isPending, error } = useQuery({
    queryKey: ['tasks', status, page],
    queryFn: () => fetchTasks({ status, page }),
  })

  const tasks = useTaskStore((s) => s.tasks)
  const setTasks = useTaskStore((s) => s.setTasks)

  useEffect(() => {
    if (data) setTasks(data)
  }, [data, setTasks])

  if (isPending) return <Spinner />
  if (error) return <ErrorView error={error} />
  return <TaskList tasks={tasks} />
}
```

1. 当前 `tasks` 有几份数据来源？这个 Effect 在哪些时机会执行？
2. 列出至少三个由这种双写导致的问题。可以结合翻页、后台 refetch、失败重试、登出和持久化来回答。
3. 如果 `status` 从 `all` 切到 `done`，在 Query 尚未返回前，`tasks` 和 URL 分别是什么？用户可能看到什么？
4. 给出正确分工：哪些数据留在 Query，哪些放进 Zustand？mutation 成功后如何让列表更新？如果多个相距很远的组件都要读任务列表，应该共享什么？

**你的答案：**
1: 2份来源； effect会在data有变化的时候执行
2: 翻页： 点击下一页的时候，只更新page，
3: url会push一个记录，tasks不变，
4: 

## 第 2 题：selector、useShallow 与不可变 actions（3 分）

```tsx
type Task = { id: string; title: string; done: boolean }
type Filter = 'all' | 'open' | 'done'

type TaskState = {
  tasks: Task[]
  filter: Filter
  theme: 'light' | 'dark'
  doneCount: number
  toggle: (id: string) => void
  add: (title: string) => void
  clearCompleted: () => void
  setFilter: (filter: Filter) => void
  toggleTheme: () => void
}

const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  filter: 'all',
  theme: 'light',
  doneCount: 0,

  toggle: (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (task) task.done = !task.done
    set({
      tasks: get().tasks,
      doneCount: get().tasks.filter((t) => t.done).length,
    })
  },

  add: (title) => {
    get().tasks.push({ id: crypto.randomUUID(), title, done: false })
    set({ tasks: get().tasks })
  },

  clearCompleted: () => {
    set({ tasks: get().tasks.filter((t) => !t.done) })
  },

  setFilter: (filter) => set({ filter }),

  toggleTheme: () =>
    set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
}))

function DoneBadge() {
  const doneCount = useTaskStore((s) => s.doneCount)
  return <p>已完成 {doneCount}</p>
}

function TaskList() {
  const { tasks, filter } = useTaskStore((s) => ({
    tasks: s.tasks,
    filter: s.filter,
  }))

  const visible = useTaskStore((s) =>
    s.filter === 'all'
      ? s.tasks
      : s.tasks.filter((t) => (s.filter === 'done') === t.done)
  )

  return (
    <div>
      <DoneBadge />
      {visible.map((t) => (
        <label key={t.id}>
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => useTaskStore.getState().toggle(t.id)}
          />
          {t.title} {t.done ? '✓' : '○'}
        </label>
      ))}
    </div>
  )
}
```

1. `TaskList` 首次挂载后，控制台可能立即出现什么？最坏会发生什么？三个 `useTaskStore` 调用各自返回什么形状的快照？当 `filter` 从 `all` 切到 `open` 后，`visible` 这一项有什么变化？
2. 只调用 `toggleTheme()` 时，`TaskList` 会重渲染吗？把 selector 修好后呢？
3. 点击复选框后，原 `task` 对象和 `tasks` 数组的引用分别变了吗？如果把列表拆成一个只订阅 `s.tasks` 的子组件，界面会更新吗？用 `useShallow` 包住 `visible` 能补救吗？为什么？
4. `clearCompleted()` 之后 `doneCount` 为什么可能不对？`doneCount` 应该怎么得到？
5. 把 `toggle`、`add`、`clearCompleted` 改写为不可变更新；再给出至少两种修复 selector 的方案，使主题变化不触发列表重渲染，而任务变化只更新相关部分。

**你的答案：**

## 第 3 题：persist、partialize 与瞬态更新（2.5 分）

```tsx
type Task = { id: string; title: string; done: boolean }

type BoardState = {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  tasks: Task[]
  draft: string
  cursorX: number
  setTheme: (theme: 'light' | 'dark') => void
  setCursorX: (x: number) => void
}

const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarOpen: true,
      tasks: [],
      draft: '',
      cursorX: 0,
      setTheme: (theme) => set({ theme }),
      setCursorX: (cursorX) => set({ cursorX }),
    }),
    {
      name: 'kanban-board',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        tasks: state.tasks,
        draft: state.draft,
      }),
    }
  )
)
```

```tsx
function CursorTracker() {
  const x = useBoardStore((s) => s.cursorX)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      useBoardStore.getState().setCursorX(e.clientX)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return <div className="cursor" style={{ transform: `translateX(${x}px)` }} />
}
```

1. 写出 `localStorage` 中 key 为 `kanban-board` 的大致 JSON（标出 `state` 与 `version`）。当前 `partialize` 包含哪些字段？`tasks` 和 `draft` 被持久化分别有什么问题？`setTheme`、`setCursorX` 会出现在 JSON 里吗？为什么？
2. 刷新页面时，持久化状态如何与初始 state 合并？默认 `merge` 做什么？如果存储里是 `theme: 'dark'`、初始值是 `'light'`，最终 `theme` 是什么？如果以后给 state 新增 `fontSize`，但旧存储里没有，它是什么？如果 `partialize` 直接返回整个 state，会有什么后果？
3. 鼠标移动时 `CursorTracker` 会发生什么？改成不触发 React 重渲染的瞬态更新，写出 Effect 和 cleanup。为什么订阅回调不会读到过期的 `cursorX`？什么场景适合这种写法，什么场景仍应使用普通 selector？
4. 如果 `tasks` 也由 TanStack Query 管理，刷新页面后、用户登出并换账号后，可能分别看到什么？给出 `partialize` 与登出清理的修复。若只想让 `sidebarOpen` 在标签页会话内保留、关闭标签页即丢弃，`storage` 应该怎么写？

**你的答案：**
1: storage: createJSONStorage(() => localStorage);
包含： theme， sidebarOpen，tasks，draft；
会影响全局的清理，测试等；
会出现
2: 


