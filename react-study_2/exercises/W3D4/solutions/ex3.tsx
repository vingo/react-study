// 参考答案 3：校验 + pending + 失败重试
//
// 用户路径：
//   输入 -> 空标题校验 -> 提交中（禁用按钮）-> 成功清空并加入列表
//                                      \-> 失败保留输入并显示错误 -> 重试
//
// localStorage 只用于演示“用例之间要清理共享状态”；测试在 beforeEach
// 里既 reset 了 fetch handler，也 clear 了 localStorage。

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
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    storeTasks(tasks)
  }, [tasks])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTitle = title.trim()

    if (trimmedTitle === '') {
      setError('请输入任务标题')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      })

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`)
      }

      const created = (await response.json()) as Task
      setTasks((current) => [...current, created])
      setTitle('')
    } catch {
      setError('创建失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section aria-label="新建任务">
      <form onSubmit={handleSubmit}>
        <label>
          任务标题
          <input
            value={title}
            disabled={isSubmitting}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '提交中…' : '添加任务'}
        </button>
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
