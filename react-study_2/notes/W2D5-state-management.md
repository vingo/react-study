# W2D5：状态管理选型：Zustand 5 与 selector

> 以 `zustand@5.1.0` 为准。承接 [W2D3](W2D3-tanstack-query.md) 与 [W2D4](W2D4-react-router.md)：Query 接管服务端缓存，Router 接管 URL 状态；本讲只讨论**剩下的客户端全局状态**，以及如何用 selector 控制重渲染。v5 的三个高频差异：`create<T>()` 柯里化写法、selector 默认按 `Object.is` 比较（返回新引用会额外渲染甚至死循环）、`useShallow` 从 `zustand/react/shallow` 导入。

## 1. 一句话结论

先按“谁拥有、活多久、给谁用、能否派生”把状态分成局部 UI、URL、服务端、客户端全局四类；只有最后一类才进 Zustand，并且用 selector 只订阅需要的切片，返回对象/数组时用 `useShallow` 稳定引用。

## 2. 心智模型

```text
这个值能从其他数据算出来吗？ ──是──► 不要存，在 render / selector 里派生
        │否
只在一个组件或一棵子树里用吗？ ──是──► useState / useReducer（共享就提升）
        │否
需要可分享、刷新保留、前进后退吗？ ──是──► URL（searchParams / 路由参数）
        │否
来自服务器、需要缓存/失效/重试吗？ ──是──► TanStack Query / RSC / loader
        │否
要跨路由、跨组件，甚至 React 外读取？ ──是──► Zustand
```

```text
组件 A ── selector ──┐
组件 B ── selector ──┼──► Zustand store（state + actions）
非 React ─ getState ─┘          │ set(action)
                                ▼
                     每个订阅者按 Object.is 比较自己的切片
                     只有切片变化的组件重渲染
```

三句话记住：**状态先找 owner，再选工具；服务端状态和 URL 状态不要搬进 store；store 里只存最小真相，派生值在读取处算。**

## 3. 要点

### 3.1 状态分类：四类状态，四个归属

判断标准只有四个问题：

1. **谁拥有它？** 服务器拥有的事实（任务、用户、订单）→ Query / RSC；用户与 URL 绑定的事实（筛选、分页、tab）→ URL；组件自己的 UI → 局部 state。
2. **生命周期多长？** 卸载即失效 → 局部；刷新/分享后还要在 → URL 或持久化；需要后台刷新和失效 → Query。
3. **需要跨多大范围共享？** 一个子树 → 提升或 Context；跨路由、跨布局、多个不相邻组件 → Zustand。
4. **能否从其他数据派生？** 能派生就不要存，避免两份真相。

| 类别 | 典型例子 | 真相位置 | 生命周期 | 工具 |
|---|---|---|---|---|
| 组件局部 UI | 展开/折叠、hover、输入草稿、弹窗开关 | 组件内 | 挂载到卸载 | `useState` / `useReducer` |
| URL 状态 | 筛选、分页、tab、可分享的搜索词 | URL / history | 刷新、分享、前进后退 | Router 的 searchParams / loader |
| 服务端状态 | 任务列表、详情、当前用户 | 远端 + 缓存 | 由 staleTime / gcTime 管理 | TanStack Query / RSC / loader |
| 客户端全局 | 主题、侧边栏、命令面板、跨页草稿、播放器 | 浏览器内存 | 整个应用会话 | Zustand |

```tsx
function TaskPage({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false)              // 局部 UI
  const [params, setParams] = useSearchParams()        // URL：?tab=activity
  const { data: task } = useQuery(taskQuery(taskId))   // 服务端状态
  const sidebarOpen = useUIStore((s) => s.sidebarOpen) // 客户端全局
  // task 不再复制进任何 state；params 也不再复制进 store
  return <TaskDetail task={task} open={open} sidebarOpen={sidebarOpen} />
}
```

**为什么先分类？** 选错 owner 的代价不是“多写几行”，而是两份真相：URL 后退后 store 还是旧筛选、`invalidateQueries` 刷不到 store 里的副本、刷新页面后全局草稿消失。工具是最后一步，owner 才是第一步。

### 3.2 默认从局部开始：状态提升与 Context 的边界

按这个阶梯升级，能停在前一步就不要往下走：

1. **组件内 `useState`**：只影响自己。
2. **状态提升到最近公共父级**：两个兄弟要共享，就把 state 放到它们最近的公共父级，用 props 下发。这是 React 的默认答案。
3. **Context**：当“层层透传 props”成为主要噪音，且这组状态服务一整棵子树时使用；它解决的是**依赖注入**，不是“全局”。
4. **Zustand**：跨路由、跨布局、多个不相邻组件共享，或 React 外也要读。

```tsx
type Filter = 'all' | 'done'
const FilterContext = createContext<{
  filter: Filter
  setFilter: (f: Filter) => void
} | null>(null)

function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<Filter>('all') // 只服务这棵子树
  const value = useMemo(() => ({ filter, setFilter }), [filter])
  return <FilterContext value={value}>{children}</FilterContext>
}
// 读取：const { filter } = use(FilterContext)!
```

Context vs Zustand 的取舍：

| 维度 | Context | Zustand |
|---|---|---|
| Provider | 需要包一层 | 不需要，模块级 store |
| 更新粒度 | value 变化时**所有消费者**重渲染（拆分 Context 可缓解） | 每个组件用 selector 独立订阅 |
| 高频更新 | 容易变成整棵子树重渲染 | 适合，selector 精确到切片 |
| React 外读取 | 不能 | `store.getState()` |
| 测试 | 需要包 Provider | 直接 `getState()` / `setState()` |
| 最适合 | 主题、locale、当前用户、依赖注入、低频率子树状态 | 跨路由的客户端全局状态、高频交互、非 React 读取 |

**不要为了“全局”而全局。** 一个只在一个页面用的筛选器，放进 Zustand 只会得到：刷新后残留、测试要重置、卸载后还要记得清理。Context 也不等于状态管理器；如果 value 每个按键都变，先拆 Context 或用 selector 化的 store。

### 3.3 Zustand 5 基础：一个 store，state 与 actions 同店

```tsx
import { create } from 'zustand'

type Item = { id: string; title: string; done: boolean }
type TodoState = { items: Item[]; add: (t: string) => void; toggle: (id: string) => void; pendingCount: () => number }
export const useTodos = create<TodoState>()((set, get) => ({
  items: [],
  add: (title) => set((s) => ({
    items: [...s.items, { id: crypto.randomUUID(), title, done: false }],
  })),
  toggle: (id) => set((s) => ({
    items: s.items.map((t) => t.id === id ? { ...t, done: !t.done } : t),
  })),
  pendingCount: () => get().items.filter((t) => !t.done).length,
}))
```

**为什么这样写？**

- `create<T>()((set, get) => ...)` 是 TypeScript 推荐的柯里化写法；第二组括号让 `T` 先确定，中间件和复杂类型不会被推断成 `unknown`。
- `set` 默认**浅合并**，所以只返回要改的字段即可；actions 和 state 放在同一个对象里，组件拿到的 action 引用天然稳定。
- 更新必须不可变：数组用 `map` / `filter` / `[...arr]`，对象用 `{ ...obj, field }`。直接 `push` / `obj.field = x` 不会创建新引用，订阅者收不到通知。
- 需要读当前最新值（尤其是异步 action）时用 `get()`，不要依赖闭包里的旧 state。
- `set(fn)` 的 `fn` 读取的是上一步的 state，连续更新要用更新函数。

在 React 外读写同一个 store：

```ts
useTodos.getState().add('写周报')        // 最新快照，不受闭包影响
useTodos.setState({ items: [] })          // 浅合并，actions 保留
const unsub = useTodos.subscribe((s, prev) =>
  console.log(prev.items.length, '→', s.items.length),
)
unsub()
```

`create` 返回的 `useTodos` 既是 Hook，也挂载了 `getState` / `setState` / `subscribe` / `getInitialState`。`setState(partial, true)` 是**整体替换**：v5 的类型要求替换时提供完整 state，否则会把 actions 一并抹掉。

### 3.4 selector 与重渲染：只订阅需要的切片

```tsx
import { useShallow } from 'zustand/react/shallow' // zustand/shallow 也再导出

const count = useTodos((s) => s.items.length) // number：Object.is 足够
const add = useTodos((s) => s.add)            // 稳定引用

// 返回对象/数组：用 useShallow 做一层浅比较
const { items, toggle } = useTodos(
  useShallow((s) => ({ items: s.items, toggle: s.toggle })),
)
```

**为什么要 `useShallow`？** v5 的 `useStore` 基于 `useSyncExternalStore`，selector 在 `getSnapshot` 中执行，默认用 `Object.is` 比较输出。如果 selector 每次返回新对象/新数组，React 会认为快照一直在变：轻则每次 store 更新都重渲染，重则报 “Maximum update depth exceeded” 或 “The result of getSnapshot should be cached”。

- **优先拆成多个原子 selector**：`s.items`、`s.filter`、`s.add` 分开订阅，根本不会创建包装对象。
- **必须返回组合值时**用 `useShallow`；它缓存上一次输出，浅比较相等就返回旧引用。
- `useShallow` 是 Hook，必须在组件顶层调用；不要放进条件或循环。
- selector 必须**纯**：不能在里面 `set`、发请求、写日志、改对象、用 `Math.random()` / `Date.now()`。它在 render 和 StrictMode 下可能执行多次。
- “稳定”指同样的逻辑值返回稳定/浅相等的引用，不是要求把内联 selector 函数 memo 起来；v5 允许内联 selector，只要输出稳定。
- 不要 `useTodos()` 选整个 store：任何字段变化都会重渲染。真的需要全量时，明确知道代价。
- 自定义 equality 的旧写法在 v5 的 `create` 中已不支持；确有必要时用 `zustand/traditional` 的 `createWithEqualityFn`（该入口依赖可选的 `use-sync-external-store`），但大多数场景 `useShallow` 就够了。

### 3.5 派生状态：store 只存最小真相

不要在 store 里重复存 `total`、`count`、`filteredItems`、`isAllDone`；它们都能从 `items` 算出来。重复存储意味着每次更新都要记得同步两份，迟早不一致。

```tsx
// store 只存 items；总价在读取处派生
const total = useCart((s) =>
  s.items.reduce((sum, i) => sum + i.price * i.qty, 0),
)
// 返回新数组：用 useShallow 避免内容不变但引用变
const cheap = useCart(useShallow((s) => s.items.filter((i) => i.price < 10)))
// 复杂派生：先选原始切片，再在组件里 useMemo
const items = useCart((s) => s.items)
const total2 = useMemo(
  () => items.reduce((sum, i) => sum + i.price * i.qty, 0),
  [items],
)
```

**`useShallow` 的比较语义（只比一层）：**

- 对象：比较自有可枚举 key 的数量和每个 key 的值，值用 `Object.is`；嵌套对象仍按引用比较。
- 数组及其他可迭代对象：逐元素用 `Object.is` 比较，顺序敏感。
- `Map`：比较 entry 的数量、key 是否存在、value 是否 `Object.is`。
- 不是深比较。`{ user: { name: 'a' } }` 两次浅比较会失败，因为内层对象引用不同；这种结构应拆 selector，或只选 `user.name`。

selector 会在**每次 store 更新**时重新执行，所以不要在 selector 里做 O(n²) 的重计算；选原始切片 + 组件内 `useMemo` 通常更可控。

### 3.6 高频更新与瞬态更新：绕过 React 渲染

鼠标移动、拖拽、滚动、音频进度这类每帧都可能更新的值，如果每次都 `set` 并让组件重渲染，React 的调度成本会盖过业务本身。做法是：store 照常保存值，但显示层用 `subscribe` + `getState` 直接写 DOM/ref。

```tsx
type Cursor = { x: number; y: number; move: (x: number, y: number) => void }
export const useCursor = create<Cursor>()(
  subscribeWithSelector((set) => ({
    x: 0, y: 0,
    move: (x, y) => set({ x, y }),
  })),
)
```

```tsx
function Dot() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current!
    return useCursor.subscribe(
      (s) => s.x,
      (x) => { el.style.transform = `translateX(${x}px)` }, // 直接写 DOM
      { fireImmediately: true },
    )
  }, [])
  return <div ref={ref} />
}
```

**为什么有效？** 订阅回调在 React 渲染之外执行，不调用 `setState`，所以每帧只有一次 DOM 写入，没有组件重渲染。`subscribeWithSelector` 让回调只在选中的切片变化时触发；不用中间件时，`store.subscribe(() => { const { x } = store.getState(); ... })` 也能工作，只是任何字段变化都会触发回调。记得在 Effect cleanup 中取消订阅。

边界：需要驱动 React UI 的值不要用瞬态写法；高频但又要显示在 React 里的值，用正常 selector，并考虑 `requestAnimationFrame` 节流。瞬态更新适合“显示层是命令式”的场景（canvas、视频、拖拽位置）。

### 3.7 中间件：persist、devtools 与测试重置

```ts
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
type Settings = { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }
export const useSettings = create<Settings>()(
  devtools(
    persist(
      (set) => ({
        theme: 'light',
        setTheme: (theme) => set({ theme }, false, 'settings/setTheme'),
      }),
      { name: 'settings', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ theme: s.theme }), version: 1, skipHydration: true },
    ),
    { name: 'settings', enabled: import.meta.env.DEV },
  ),
)
```

- `persist` 的 `name` 必须唯一；默认存储就是 `createJSONStorage(() => localStorage)`，getter 是惰性的，模块求值时不会立刻访问 `localStorage`。
- `partialize` 只持久化需要的字段。不要把 `loading` / `error` / 弹窗开关 / 临时筛选持久化，否则刷新后会带着上一次的中间状态。
- `version` + `migrate` 处理结构变更；`merge` 默认是浅合并，嵌套结构升级时要注意旧数据覆盖新默认值。
- `createJSONStorage` 只做 `JSON.parse` / `JSON.stringify`，**不做运行时校验**；损坏、过期或被篡改的数据会直接 cast 成你的类型。生产环境用 Zod 等 schema 校验，或自定义 `PersistStorage`；不要把 token、隐私数据放进 localStorage。
- `skipHydration: true` 会跳过初始化时的自动回填，适合 SSR：服务端没有 `localStorage`，客户端持久化值又可能与服务端 HTML 不一致，直接回填会造成 hydration mismatch。客户端在 Effect 里手动 `void useSettings.persist.rehydrate()`，用 `persist.hasHydrated()` 或 `onFinishHydration` 决定何时渲染依赖持久化值的 UI。
- v5 的行为变化：persist **不再在 store 创建时写入初始 state**；如果依赖“首次就有存储项”，创建后显式 `setState`。
- SSR / Next.js 额外注意：模块级 store 在服务端可能在请求间共享，**每用户/每请求**的状态不要放模块级单例；用 Provider + `useState(() => createStore(...))` 做请求级 store。
- `devtools` 通常放在最外层，统一记录用户 action 和 persist 回填等动作；`enabled` 只在开发环境开启。第三个参数是 action 名，便于在 Redux DevTools 中辨认。

测试里重置 store，避免用例互相污染：

```ts
import { act } from '@testing-library/react'

afterEach(() => {
  act(() => useSettings.setState(useSettings.getInitialState(), true))
})
```

`getInitialState()` 返回创建时的完整 state（含 actions），`replace: true` 整体替换，能清掉测试中新增的字段。若每个测试都新建 store，则不需要全局重置。

### 3.8 异步与边界：Zustand 不负责服务端缓存

Zustand 能写异步 action，但它**不提供**请求去重、缓存键、重试、失效、后台刷新、垃圾回收。这些是 TanStack Query / RSC 的职责。Zustand 里的异步只适合“客户端全局任务”，例如上传队列、WebSocket 连接状态、全局命令面板的搜索。

```ts
type SearchState = { items: Item[]; loading: boolean; error: Error | null; search: (q: string) => Promise<void> }
let seq = 0 // 只让最后一次请求写回
export const useSearch = create<SearchState>()((set) => ({
  items: [], loading: false, error: null,
  search: async (q) => {
    const id = ++seq
    set({ loading: true, error: null })
    try {
      const items = await api.search(q)
      if (id === seq) set({ items, loading: false })
    } catch (e) {
      if (id === seq) set({ error: e as Error, loading: false })
    }
  },
}))
```

**竞态**：用户连续输入时，旧请求可能后到并覆盖新结果。用递增序号（上面）或 `AbortController` 在 store 闭包里取消旧请求；不要只用 `loading` 布尔值判断“是不是最新”。**错误**：异步 action 必须自己 `try/catch`，否则 rejection 无人处理；loading/error 与结果一起放在 store 里，UI 才能区分“空结果”和“请求失败”。

最重要的三条边界：

- **服务端数据归 Query / RSC。** 不要 `useEffect(() => setStore(data), [data])`，也不要 `setQueryData` 后再 `setStore`。两份真相会让失效、回滚、刷新全部失步。
- **URL 状态归 URL。** 筛选、分页、tab、可分享的搜索词不要搬进 store；否则前进/后退、深链、刷新都会与 URL 脱节。store 里最多存“URL 不表达的纯客户端偏好”（如侧边栏宽度）。
- **组件局部异步归组件或 Query。** 只在当前组件用、卸载即失效的请求，不需要全局 store。

### 3.9 Store 组织：单 store + slices，还是多个 store

```ts
type Store = TodoSlice & UiSlice
const createTodoSlice: StateCreator<Store, [], [], TodoSlice> = (set) => ({
  todos: [],
  addTodo: (title) => set((s) => ({
    todos: [...s.todos, { id: crypto.randomUUID(), title }],
  })),
})
const createUiSlice: StateCreator<Store, [], [], UiSlice> = (set) => ({
  filter: 'all',
  setFilter: (filter) => set({ filter }),
})
export const useStore = create<Store>()((...a) => ({
  ...createTodoSlice(...a),
  ...createUiSlice(...a),
}))
```

- **单 store + slices**：领域之间会互相读取、需要原子更新时用。slice 只是把一个大对象拆成多个 `StateCreator`，最终仍是同一个 store；跨 slice 的 action 可以用 `get()` 读另一片。
- **多个 store**：领域真正独立时用，例如 `useAuthStore` 与 `useEditorStore`。好处是按需加载、独立持久化、订阅面更小；代价是跨 store 协调要显式 `getState()` / `subscribe`，别搞成循环依赖。
- **actions 命名**：用领域动词（`addTodo`、`toggleTodo`、`resetFilters`），不要包一层通用 `setState`。action 是唯一写入口，读代码时能看出发生了什么。
- **可测试性**：action 直接 `useStore.getState().addTodo('x')` 就能测，不需要 Provider；断言 `getState()` 的结果。把纯计算抽成普通函数，action 只负责组合。
- **selector 不做副作用**：不 `set`、不请求、不写日志、不修改数组；selector 是读取，不是生命周期。
- 大型团队若需要严格 action 日志、时间旅行、中间件生态，Redux Toolkit 更合适；Zustand 的取舍是更少的样板和更细的订阅，不是“功能更多”。

### 3.10 选型表

| 工具 | 适合 | 不适合 / 代价 | 本项目中的位置 |
|---|---|---|---|
| `useState` / `useReducer` | 组件局部、短生命周期、一棵子树共享（提升后） | 跨路由/跨布局共享要层层传；无全局调试 | 卡片展开、表单草稿、局部弹窗 |
| Context | 低频率依赖注入：主题、locale、当前用户、子树级配置 | value 变化会让所有消费者重渲染；React 外读不到 | 主题、Router/Query 的 Provider 之外的小范围注入 |
| Zustand | 客户端全局、跨路由、高频交互、React 外读取、selector 细粒度订阅 | 不自带服务端缓存；需自己约束 store 边界；持久化有 SSR 坑 | 侧边栏、命令面板、跨页草稿、拖拽偏好 |
| Redux Toolkit | 大团队、复杂领域、严格 action 流、时间旅行、丰富中间件 | 样板和概念更多；小项目收益低 | 本项目不用，知道边界即可 |
| Jotai | 自底向上的原子状态、大量独立小状态、细粒度派生 | 集中式 action 日志弱；跨模块约定要团队统一 | 可选，不作为本项目主线 |
| TanStack Query | 服务端状态：缓存、去重、重试、失效、乐观更新 | 不是 UI 状态管理器，不该存弹窗/筛选 | 任务列表、详情、mutation |

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| 什么都放进 Zustand，“以后可能共享” | 先 `useState`，需要共享再提升，最后才 Context/Zustand | 全局化会带来残留、测试污染和额外订阅 |
| 把 `useQuery` 的 data 复制进 store | UI 直接读 Query；需要组合就在组件里派生 | 两份真相，`invalidateQueries` 刷不到 store |
| 把 `searchParams.get('status')` 复制进 store/`useState` | 每次渲染从 URL 读，setter 写回 URL | 刷新、分享、后退会与 URL 脱节 |
| selector 返回对象字面量且不用 `useShallow` | 拆原子 selector，或 `useShallow` 包一层 | v5 默认 `Object.is`，每次新引用会额外渲染甚至死循环 |
| 把 `useShallow` 当深比较 | 只选需要的字段，或拆 selector | 它只比较一层，嵌套对象仍按引用 |
| `useStore()` 不传 selector | `useStore((s) => s.need)` | 任何字段变化都重渲染 |
| selector 里 `set`、发请求、`Math.random()` | selector 只读、只计算 | selector 在 render 中执行，可能多次执行 |
| 直接 `items.push(x)` / `obj.field = x` | `[...items, x]` / `{ ...obj, field: x }` | 引用没变，订阅者收不到通知 |
| `persist` 持久化整个 store | `partialize` 只留需要的字段 | loading/error/弹窗状态刷新后变成脏数据 |
| `skipHydration: true` 却不调用 `rehydrate()` | 客户端 Effect 里 `persist.rehydrate()` | 持久化值永远不会回填 |
| 在模块顶层直接读 `localStorage` | 用 `createJSONStorage(() => localStorage)` 惰性读取 | SSR 没有 `localStorage`，模块求值会崩 |
| 依赖 localStorage 存用户数据且不校验 | schema 校验或自定义 storage；不存敏感信息 | JSON 只反序列化，不验证形状，可能崩溃或被篡改 |
| 异步 action 不处理竞态 | 递增序号或 `AbortController` | 旧响应后到会覆盖新结果 |
| 用 Zustand 自己实现请求缓存 | 服务端状态交给 Query/RSC | 去重、重试、失效、GC 都要重造一遍 |
| 测试之间不重置 store | `setState(getInitialState(), true)` 或每测试新建 | 上一个用例的状态泄漏到下一个 |
| 在组件 render 里 `createStore()` | 模块级 store，或 `useState(() => createStore())` 放 Context | 每次 render 新 store，状态和订阅全部丢失 |

## 5. 三句话自测

1. 判断状态归属的四个问题是什么？——谁拥有、生命周期多长、需要跨多大范围共享、能否从其他数据派生；服务端状态归 Query/RSC，可分享状态归 URL，局部 UI 归组件，剩下的客户端全局状态才归 Zustand。
2. v5 里 selector 返回对象或数组为什么要用 `useShallow`？——默认用 `Object.is` 比较输出，每次新引用会被当成新快照，导致额外渲染甚至无限循环；`useShallow` 做一层浅比较并复用旧引用，或者干脆拆成多个原子 selector。
3. Zustand 不负责哪些事？——不负责服务端缓存、请求去重/重试/失效（交给 TanStack Query/RSC），不负责 URL 状态（交给 Router），持久化也只管客户端存储，SSR 下要处理 `skipHydration`、hydration mismatch 和请求级 store 隔离。

## 6. 官方阅读

- https://zustand.docs.pmnd.rs/learn/getting-started/introduction
- https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow
- https://zustand.docs.pmnd.rs/reference/middlewares/persist
