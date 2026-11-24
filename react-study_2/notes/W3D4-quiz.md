# W3D4 课前测验：测试（Vitest 5 + Testing Library + MSW 3）

先独立作答，不查资料、不运行代码；把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W3D4.md`，做完前不要打开。

本卷共 9 分：2 道复习题（各 0.5 分），3 道新主题题（3 + 2.5 + 2.5 分）。以当前练习环境为准：Vitest 5.1、@testing-library/react 16.3、@testing-library/user-event 14.6、jsdom 30；`globals: true`，`vitest.setup.ts` 已引入 `@testing-library/jest-dom/vitest`。当前练习环境**没有安装 MSW**；MSW 题按 3.0.7 官方文档作答，不要假设本机能运行或能通过类型检查。

## 复习 1：interval 的过期闭包与 cleanup（0.5 分｜来自 W1D3 第 3 题）

下面的秒表每 1000ms 自增一次：

```tsx
function Stopwatch() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(seconds + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return <p>已运行 {seconds} 秒</p>
}
```

1. 让真实时间过去约 3 秒（不重新挂载组件），页面显示多少秒？逐次写出每个 tick 时 `setSeconds` 收到的值，并解释原因。
2. 修复组件，使秒数正常递增。若要把这段行为写成不等待 3 秒的确定性测试，计时器的推进和断言应怎么写？在 StrictMode 下还要注意什么？

**你的答案：**
1: 收到的值1 ， setSeconds（seconds + 1） 的方式是值设置，pending state的值还是0， 
2: 修复代码setSeconds（() => seconds + 1)


## 复习 2：不可变更新与 StrictMode 双调用（0.5 分｜来自 W1D1 第 2 题）

```tsx
type Task = { id: string; title: string; done: boolean }

function addTask(tasks: Task[], title: string): Task[] {
  tasks.push({ id: crypto.randomUUID(), title, done: false })
  return tasks
}

function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [n, setN] = useState(0)

  return (
    <>
      <button onClick={() => setTasks(prev => addTask(prev, '写周报'))}>添加</button>
      <button onClick={() => setN(x => x + 1)}>刷新 {n}</button>
      <ul>
        {tasks.map(task => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </>
  )
}
```

测试显式用 `<StrictMode><TaskBoard /></StrictMode>` 渲染，然后：

1. 点击“添加”一次后**立刻**查询，列表里有几个 `<li>`？为什么？
2. 紧接着点击“刷新”一次，列表里又有几个 `<li>`、文本是什么？解释这两次观察为何不同。
3. 给出修复后的 `addTask` 或事件处理（要求不可变更新），并说明随机 `id` 应该在哪里生成。

**你的答案：**
1:  有0 个 li标签
2: 1个， 文本是1，
3: const addTask = (title, tasks）=> {
    if(!title) return 
    const task = { id: crypto.randomUUID(), title, done: false }
    setTasks([...tasks,task])
}
` <button onClick={() => setTasks(prev => addTask('写周报',tasks))}>添加</button>`



## 第 1 题：查询优先级、可访问名称与用户事件（3 分）

### A. 查询预测（1.25 分）

```tsx
function TaskComposer() {
  const [title, setTitle] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) {
      setError('保存失败')
      return
    }
    setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>新建任务</h2>

      <label htmlFor="title">标题</label>
      <input
        id="title"
        placeholder="例如：写周报"
        maxLength={10}
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <p>剩余 <strong>{10 - title.length}</strong> 个字符</p>

      <button type="submit">保存</button>
      <button type="button" onClick={() => setTitle('')}>
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="M2 2l12 12M14 2L2 14" />
        </svg>
      </button>

      {saved && <p>已保存</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

对下面的每个查询，逐一判断“返回元素”还是“抛错”，并说明原因。对抛错的查询，给出修正后的查询或组件改法。

```tsx
render(<TaskComposer />)

screen.getByRole('textbox', { name: '例如：写周报' })
screen.getByRole('button', { name: '保存' })
screen.getByRole('button', { name: '清空' })
screen.getByText('剩余 10 个字符')
screen.getByLabelText('标题')
```

最后说明：表单输入框应优先用哪类查询？`getByRole` 的 `name`、`getByLabelText`、`getByPlaceholderText`、`getByText`、`getByTestId` 的推荐优先级是什么？

**你的答案：**
1: 

### B. 事件与输入约束（1 分）

```tsx
test('按 Enter 保存过长的标题', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  )

  render(<TaskComposer />)
  const input = screen.getByLabelText('标题')

  fireEvent.change(input, { target: { value: '这是一个超过十个字的任务标题' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  expect(await screen.findByText('已保存')).toBeInTheDocument()
})
```

这个测试会失败。请从 `fireEvent` 模拟的事件范围、浏览器默认行为以及输入框自身约束三方面解释原因；然后用 `user-event` 重写这段交互（含 `userEvent.setup()`），并说明 `user.type` 与 `fireEvent.change` 在等价性上的差异。

另外回答：在什么情况下仍然可以合理使用 `fireEvent`？举一个例子。

**你的答案：**


### C. act 警告与异步等待（0.75 分）

```tsx
test('保存后显示提示', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 50)
        }),
    ),
  )

  const user = userEvent.setup()
  render(<TaskComposer />)

  await user.type(screen.getByRole('textbox', { name: '标题' }), '写周报')
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(screen.getByText('已保存')).toBeInTheDocument()
})
```

运行后测试失败，并在 stderr 看到：

```text
Warning: An update to TaskComposer inside a test was not wrapped in act(...)
Unable to find an element with the text: 已保存
```

1. 为什么 `await user.click(...)` 已经 await 了，仍会找不到提示并出现 act 警告？
2. 给出最小修复，并解释 `findBy` / `waitFor` 在这里各自做了什么；它们默认等待多久、如何调整？
3. 如果服务端 mock 故意延迟 1500ms，测试要怎么改？用 `await new Promise(r => setTimeout(r, 1500))` 等待可以吗？为什么？

**你的答案：**


## 第 2 题：MSW 3 的 server 生命周期、override 与错误语义（2.5 分）

本练习环境未安装 MSW；以下代码按 MSW 3.0.7 的 API 判断。假设 `TaskList` 挂载时执行 `fetch('/api/tasks')`，成功且有数据时渲染任务标题，成功但空数组时渲染“暂无任务”，失败时渲染 `role="alert"`。

### A. 两个测试与 handler 覆盖（1 分）

```tsx
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw/http'

export const handlers = [
  http.get('/api/tasks', () =>
    HttpResponse.json([{ id: '1', title: '写周报' }]),
  ),
]

// src/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```tsx
// src/test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from '../mocks/server'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.restoreHandlers())
afterAll(() => server.close())
```

```tsx
// TaskList.test.tsx
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { delay } from 'msw/utils/delay'
import { server } from '../mocks/server'
import { TaskList } from './TaskList'

test('没有任务时显示空状态', async () => {
  server.use(
    http.get('/api/tasks', async () => {
      await delay(50)
      return HttpResponse.json([])
    }),
  )

  render(<TaskList />)
  expect(await screen.findByText('暂无任务')).toBeInTheDocument()
})

test('有任务时显示标题', async () => {
  render(<TaskList />)
  expect(await screen.findByText('写周报')).toBeInTheDocument()
})
```

1. 第二个测试会通过吗？实际会看到什么？请从 handler 的注册位置与 `afterEach` 的清理方式解释。
2. `server.use` 注册的 handler 与 `setupServer(...handlers)` 的初始 handler 谁先匹配？连续两次 `server.use` 同一个接口，哪一次生效？
3. 正确的 `beforeAll` / `afterEach` / `afterAll` 应该怎么写？`resetHandlers` 与 `restoreHandlers` 的区别是什么？`resetHandlers` 接受参数时又会怎样？

**你的答案：**


### B. HTTP 错误与网络错误（1 分）

```tsx
function TaskList() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(() => setError('加载失败'))
  }, [])

  if (error) return <p role="alert">{error}</p>
  if (!tasks) return <p>加载中…</p>
  return tasks.length === 0
    ? <p>暂无任务</p>
    : <ul>{tasks.map(t => <li key={t.id}>{t.title}</li>)}</ul>
}
```

测试里用：

```tsx
server.use(
  http.get('/api/tasks', () =>
    HttpResponse.json({ message: 'boom' }, { status: 500 }),
  ),
)

render(<TaskList />)
expect(await screen.findByRole('alert')).toHaveTextContent('加载失败')
```

1. 这个测试会看到 alert 吗？实际会发生什么？这个 500 响应会怎样被 `fetch` 处理，`.catch` 会执行吗？
2. 如果要模拟“HTTP 500，且客户端检查 `res.ok` 后显示错误”，handler 和组件分别应怎么写？
3. 如果要模拟“网络层失败，`fetch` 直接 reject”，handler 应怎么写？这时 catch 收到的错误大致是什么？
4. 与直接 `vi.stubGlobal('fetch', ...)` 相比，用 MSW 模拟同样的 500/网络错误有什么好处？至少说一点。

**你的答案：**


### C. MSW 3 迁移与生命周期（0.5 分）

```tsx
import { http, HttpResponse, delay } from 'msw'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
beforeEach(() => {
  server.listen()
})
afterAll(() => {
  await server.close()
})
```

1. 这段代码有哪些地方不符合 MSW 3.0.7？逐处改正（import、listen 选项、同步/异步、重复 listen）。
2. `onUnhandledFrame: 'error'` 的作用是什么？默认策略是什么？

**你的答案：**


## 第 3 题：测试隔离与实现细节反模式（2.5 分）

```tsx
// src/taskStore.ts
import { create } from 'zustand'

let nextId = 1

type Task = { id: number; title: string; done: boolean }

export const useTaskStore = create<{
  tasks: Task[]
  add: (title: string) => void
  toggle: (id: number) => void
}>(set => ({
  tasks: [],
  add: title =>
    set(state => ({
      tasks: [...state.tasks, { id: nextId++, title, done: false }],
    })),
  toggle: id =>
    set(state => ({
      tasks: state.tasks.map(task =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    })),
}))
```

```tsx
// TaskList.tsx（节选）
function TaskList() {
  const tasks = useTaskStore(state => state.tasks)
  const add = useTaskStore(state => state.add)
  const toggle = useTaskStore(state => state.toggle)
  const [title, setTitle] = useState('')

  return (
    <>
      <label htmlFor="title">标题</label>
      <input id="title" value={title} onChange={e => setTitle(e.target.value)} />
      <button onClick={() => add(title)}>添加</button>

      <ul aria-label="任务列表">
        {tasks.map(task => (
          <li
            key={task.id}
            data-testid={`task-${task.id}`}
            className={task.done ? 'task-card completed' : 'task-card'}
          >
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggle(task.id)}
            />
            {task.title}
          </li>
        ))}
      </ul>
    </>
  )
}
```

```tsx
// TaskList.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTaskStore } from '../taskStore'
import { TaskList } from './TaskList'

beforeEach(() => {
  vi.useFakeTimers()
  useTaskStore.setState({ tasks: [] })
})

test('添加任务', async () => {
  const addSpy = vi.spyOn(useTaskStore.getState(), 'add')
  const user = userEvent.setup()

  render(<TaskList />)
  await user.type(screen.getByLabelText('标题'), '写周报')
  await user.click(screen.getByRole('button', { name: '添加' }))

  expect(addSpy).toHaveBeenCalledWith('写周报')
  expect(document.querySelectorAll('.task-card')).toHaveLength(1)
  expect(screen.getByTestId('task-1')).toHaveTextContent('写周报')
})

test('切换完成状态', async () => {
  const user = userEvent.setup()
  const card = document.querySelector('.task-card')!
  const checkbox = within(card).getByRole('checkbox')

  await user.click(checkbox)
  expect(card).toHaveClass('completed')
})
```

1. 找出至少 3 个测试隔离/顺序相关问题，并说明哪些在本环境（Vitest 5.1、RTL 16.3.3、`globals: true`）下会直接让测试失败（崩溃或超时）。
2. 找出至少 3 处“测实现细节”的断言，说明为什么脆弱，并改写为面向用户行为的断言；给出改写后的“切换完成状态”测试（自行准备数据，不能依赖上一个测试）。
3. 为什么 `vi.spyOn(useTaskStore.getState(), 'add')` 这种断言不可靠？如果确实要验证“添加后 store 中有一条任务”，更合适的分层测试是什么？

**你的答案：**
