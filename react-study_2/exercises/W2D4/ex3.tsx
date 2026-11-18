// 练习 3：用 URL 作为筛选状态（20 分钟）
//
// 现状：
// - loader 不读 request.url，永远返回全部任务；
// - 点击状态筛选只改组件里的 searchParams 写入，但 loader 没有按它过滤；
// - 搜索框的 onChange 是空实现，输入不会写进 URL；
// - 组件里没有 useState，这是故意的：筛选状态必须只有 URL 这一份来源。
//
// 要求：
// 1. tasksLoader：用 `new URL(request.url).searchParams` 读取 status 和 q，
//    返回过滤后的任务。status 取 "all" | "active" | "done"（缺省/非法值按 all），
//    q 按标题包含匹配、忽略大小写、trim。
// 2. 点击状态按钮时更新 URL 的 status（all 时删除该参数），由 loader 重新取数。
// 3. 搜索框的 value 来自 URL 的 q；输入时更新 URL（空字符串删除 q）。
// 4. 不要用 useState 复制筛选状态，也不要自己在组件里 filter 数据——
//    过滤结果必须来自 loader，这样刷新、分享链接、前进后退都能还原。
//
// 不要修改测试断言，也不要改变按钮/输入框的可访问名称。
// 提示：setSearchParams 会触发一次导航，loader 随之重新执行；
// 用 `new URLSearchParams(searchParams)` 复制后再增删参数。

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
  // TODO 1：读取 request.url 的 status/q 并过滤 TASKS。
  const searchParams = new URL(request.url).searchParams
   const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const status = parseStatus(searchParams)
  return TASKS.filter(task => {
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
    // TODO 2：next === 'all' 时删除 status，否则写入 next。
    if (next === 'all') {
      params.delete('status')
    } else {
      params.set('status', next)
    }
    setSearchParams(params)
  }

  function updateQuery(next: string) {
    // TODO 3：写入 q；next 为空字符串时删除 q。
     const params = new URLSearchParams(searchParams)
     if (next === '') {
      params.delete('q')
     } else{
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
