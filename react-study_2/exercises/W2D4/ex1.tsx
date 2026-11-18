// 练习 1：修复嵌套路由布局（15 分钟）
//
// 现象：
// 1. 打开 "/" 只看到布局头部的“任务中心”，首页列表完全不渲染。
// 2. 点击任务链接后 URL 变了，但详情页内容也不出现。
//
// 原因：布局组件负责渲染公共头部，但忘记给子路由留出口（Outlet）。
//
// 要求：
// 1. 在 AppLayout 中渲染子路由出口，让首页/详情/统计都能显示在头部下方。
// 2. 不要修改测试断言，也不要改变路由路径。
//
// 提示：布局路由的 element 只渲染一次，子路由的 element 会渲染在 <Outlet /> 的位置。
// 注意：<NavLink to="/"> 是特殊情况，React Router 默认只在根路径激活，不需要 end；
// end 只对非根链接（例如 to="/tasks"）的前缀匹配有影响。

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
          {/* 根路径 NavLink 默认只在 "/" 激活，不需要 end。 */}
          <NavLink to="/">首页</NavLink>
          <NavLink to="/stats">统计</NavLink>
        </nav>
      </header>

      <main>
        {/* BUG 1：这里缺少子路由出口，children 永远不会渲染。 */}
        <p>请把子路由渲染在这里</p>
        <Outlet/>
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
