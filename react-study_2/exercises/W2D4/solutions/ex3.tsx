// 参考答案 3：URL 是筛选状态的唯一来源
//
// - loader 从 request.url 读取 searchParams，过滤在数据层完成；
// - 组件只负责把用户操作写回 URL（setSearchParams），不保存副本 state；
// - URL 变化 → 导航 → loader 重新执行 → 组件拿到新数据。
// 因此刷新、分享链接、前进后退都能还原同一份筛选结果。

import {
  useLoaderData,
  useSearchParams,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router'

export type Task = {
  id: string
  title: string
  done: boolean
}

export const TASKS: Task[] = [
  { id: 't1', title: '写周报', done: false },
  { id: 't2', title: '修复登录 bug', done: true },
  { id: 't3', title: '评审 PR', done: true },
  { id: 't4', title: '准备演示', done: false },
]

export const STATUS_LABELS = {
  all: '全部',
  active: '进行中',
  done: '已完成',
} as const

export type Status = keyof typeof STATUS_LABELS

export function parseStatus(params: URLSearchParams): Status {
  const value = params.get('status')
  return value === 'active' || value === 'done' ? value : 'all'
}

export async function tasksLoader({ request }: LoaderFunctionArgs): Promise<Task[]> {
  const url = new URL(request.url)
  const status = parseStatus(url.searchParams)
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()

  return TASKS.filter((task) => {
    if (status === 'active' && task.done) {
      return false
    }
    if (status === 'done' && !task.done) {
      return false
    }
    if (q !== '' && !task.title.toLowerCase().includes(q)) {
      return false
    }
    return true
  }).map((task) => ({ ...task }))
}

export function TaskBrowser() {
  const tasks = useLoaderData<Task[]>()
  const [searchParams, setSearchParams] = useSearchParams()

  const status = parseStatus(searchParams)
  const q = searchParams.get('q') ?? ''

  function updateStatus(next: Status) {
    const params = new URLSearchParams(searchParams)

    if (next === 'all') {
      params.delete('status')
    } else {
      params.set('status', next)
    }

    setSearchParams(params)
  }

  function updateQuery(next: string) {
    const params = new URLSearchParams(searchParams)

    if (next === '') {
      params.delete('q')
    } else {
      params.set('q', next)
    }

    setSearchParams(params)
  }

  return (
    <section aria-label="任务浏览器">
      <h1>任务列表</h1>

      <div role="group" aria-label="状态筛选">
        {(Object.keys(STATUS_LABELS) as Status[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => updateStatus(value)}
          >
            {STATUS_LABELS[value]}
          </button>
        ))}
      </div>

      <label>
        搜索任务
        <input value={q} onChange={(event) => updateQuery(event.target.value)} />
      </label>

      <p>
        当前筛选：{STATUS_LABELS[status]}
        {q !== '' ? `，关键词“${q}”` : ''}
      </p>

      <ul aria-label="任务列表">
        {tasks.map((task) => (
          <li key={task.id}>
            <span>{task.title}</span>
            <span>{task.done ? '已完成' : '未完成'}</span>
          </li>
        ))}
      </ul>

      {tasks.length === 0 && <p role="status">没有符合条件的任务</p>}
    </section>
  )
}

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <TaskBrowser />,
    loader: tasksLoader,
  },
]
