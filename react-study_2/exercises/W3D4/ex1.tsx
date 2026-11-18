// 练习 1：修 bug —— 让测试按用户能看到/听到的方式查询（15 分钟）
//
// 现象：
// 这个筛选面板的旧测试只能这样写：
//   screen.getByTestId('task-search')
//   container.querySelector('[data-testid="toggle-open"]')!.click()
// 因为搜索框没有 label，切换筛选的控件是一个 <div onClick>，不是按钮。
//
// 目标：
// - 输入框有真正的可访问名称“搜索任务”（用 <label> 关联即可）；
// - “只看未完成”是一个真正的 <button>，有可访问名称，并暴露 aria-pressed；
// - 鼠标点击与键盘（Tab 聚焦 + Enter）都能切换筛选。
//
// 测试已经改成按 role + accessible name 查询，并且只断言用户可见的行为。
// 保留测试作为验收标准，不要修改断言；只改组件。
//
// 提示：
// - 不要用 aria-label 的同时又保留一个没有关联的视觉文字，造成重复名称；
//   用 <label> 包住输入框最常见；
// - <div onClick> 既不进入 Tab 顺序，也不响应 Enter/Space；
// - aria-pressed 让切换按钮的状态对辅助技术可见，测试也会断言它。

import { useState } from 'react'

export type Task = {
  id: string
  title: string
  done: boolean
}

export const TASKS: Task[] = [
  { id: 't1', title: '写周报', done: false },
  { id: 't2', title: '整理会议记录', done: true },
  { id: 't3', title: '修复登录页样式', done: false },
]

export default function TaskFilter({ tasks = TASKS }: { tasks?: Task[] }) {
  const [query, setQuery] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)

  const visibleTasks = tasks.filter((task) => {
    const matchesQuery = task.title.includes(query.trim())
    return matchesQuery && (!onlyOpen || !task.done)
  })

  return (
    <section aria-label="任务筛选">
      {/* BUG 1：没有 label。placeholder 会变成可访问名称“输入关键词”，
          但用户界面上真正的字段名是“搜索任务”。 */}
      <input
        data-testid="task-search"
        type="search"
        placeholder="输入关键词"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {/* BUG 2：用 div 冒充按钮。它不在 Tab 顺序里，没有 button role，
          也没有把“开/关”状态暴露给辅助技术。 */}
      <div
        data-testid="toggle-open"
        onClick={() => setOnlyOpen((value) => !value)}
        style={{ cursor: 'pointer' }}
      >
        只看未完成
      </div>

      <p>{visibleTasks.length} 个任务</p>

      <ul aria-label="任务列表">
        {visibleTasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </section>
  )
}
