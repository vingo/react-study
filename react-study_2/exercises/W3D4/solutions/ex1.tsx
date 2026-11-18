// 参考答案 1：补全语义（label + button + aria-pressed）
//
// 只改组件，不改测试。关键是让“用户/辅助技术如何找到并操作控件”成为
// 组件契约的一部分，而不是让测试去依赖 data-testid 这种实现细节。

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
      <label>
        搜索任务
        <input
          type="search"
          placeholder="输入关键词"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <button
        type="button"
        aria-pressed={onlyOpen}
        onClick={() => setOnlyOpen((value) => !value)}
      >
        只看未完成
      </button>

      <p>{visibleTasks.length} 个任务</p>

      <ul aria-label="任务列表">
        {visibleTasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </section>
  )
}
