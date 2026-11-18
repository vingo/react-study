// 练习 3：创建任务表单 —— 校验、pending、失败重试（20 分钟）
//
// 现状：表单能提交，成功时会追加到列表；但还缺三块用户可见的行为：
// 1. 空标题（包括只有空格）不发起请求，显示“请输入任务标题”；
// 2. 提交期间按钮 disabled，文字变成“提交中…”；
// 3. 请求失败（非 2xx 或网络错误）时显示“创建失败，请重试”，
//    保留输入内容，让用户可以直接重试；重试成功后错误消失。
//
// 测试用 userEvent 走完整用户路径，用 fetch mock 模拟 POST /api/tasks
// 的成功、延迟和 500。每个测试都会重置 fetch handler 与 localStorage，
// 所以不要在模块级缓存“上一次提交”的数据。
//
// 不要修改测试里的断言。
//
// 提示：
// - 先 `title.trim()` 再判空；真正的请求体也使用 trim 后的标题；
// - 用 isSubmitting state 控制按钮的 disabled 与文案；
// - 失败时不要清空 title，否则用户要重新输入；
// - 用 try/catch/finally 保证失败后 isSubmitting 会复位。

import { useEffect, useState, type FormEvent } from 'react'

export type Task = {
  id: string
  title: string
}

export const STORAGE_KEY = 'w3d4-tasks'

function loadStoredTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Task[]) : []
  } catch {
    return []
  }
}

function storeTasks(tasks: Task[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

export default function CreateTaskForm() {
  const [tasks, setTasks] = useState<Task[]>(loadStoredTasks)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  // TODO 1：增加 isSubmitting state。

  useEffect(() => {
    storeTasks(tasks)
  }, [tasks])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // TODO 2：trim 后为空则 setError('请输入任务标题') 并 return（不发请求）。

    setError(null)

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`)
      }

      const created = (await response.json()) as Task
      setTasks((current) => [...current, created])
      setTitle('')
    } catch {
      // TODO 3：失败时显示“创建失败，请重试”，并保留输入。
    }
  }

  return (
    <section aria-label="新建任务">
      <form onSubmit={handleSubmit}>
        <label>
          任务标题
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        {/* TODO 4：提交中按钮 disabled，文案改成“提交中…”。 */}
        <button type="submit">添加任务</button>
      </form>

      {error !== null && <p role="alert">{error}</p>}

      <p>{tasks.length} 个任务</p>

      <ul aria-label="任务列表">
        {tasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </section>
  )
}
