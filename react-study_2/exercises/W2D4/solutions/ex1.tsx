// 参考答案 1：嵌套布局 + NavLink active
//
// 1. 布局路由只负责公共头部，子路由通过 <Outlet /> 渲染在 main 里。
// 2. <NavLink to="/"> 是特殊情况：React Router 默认只在根路径激活，
//    不需要 end；end 用于非根链接（如 to="/tasks"）避免详情页也激活。
//
// 结果：/、/tasks/:taskId、/stats 共享同一个头部，URL 改变时只有 Outlet 部分切换。

import {
  Link,
  NavLink,
  Outlet,
  useParams,
  type RouteObject,
} from 'react-router'

export type Task = {
  id: string
  title: string
  status: 'todo' | 'done'
}

export const TASKS: Task[] = [
  { id: 't1', title: '写文档', status: 'todo' },
  { id: 't2', title: '修 bug', status: 'done' },
]

export function AppLayout() {
  return (
    <div>
      <header>
        <h1>任务中心</h1>
        <nav aria-label="主导航">
          <NavLink to="/">首页</NavLink>
          <NavLink to="/stats">统计</NavLink>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}

export function Dashboard() {
  return (
    <section aria-label="任务列表">
      <h2>所有任务</h2>
      <ul>
        {TASKS.map((task) => (
          <li key={task.id}>
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
            <span>{task.status === 'done' ? '已完成' : '未完成'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TaskDetail() {
  const { taskId } = useParams()
  const task = TASKS.find((item) => item.id === taskId)

  if (task === undefined) {
    return <p role="alert">任务不存在</p>
  }

  return (
    <article aria-label="任务详情">
      <h2>{task.title}</h2>
      <p>状态：{task.status === 'done' ? '已完成' : '未完成'}</p>
      <Link to="/">返回列表</Link>
    </article>
  )
}

export function Stats() {
  const doneCount = TASKS.filter((task) => task.status === 'done').length

  return (
    <section aria-label="任务统计">
      <h2>任务统计</h2>
      <p>全部任务：{TASKS.length}</p>
      <p>已完成：{doneCount}</p>
    </section>
  )
}

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'tasks/:taskId', element: <TaskDetail /> },
      { path: 'stats', element: <Stats /> },
    ],
  },
]
