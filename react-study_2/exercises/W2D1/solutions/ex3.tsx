// 参考实现：乐观追加，成功后写入真实 state，失败时显示错误并自动回滚。

import { startTransition, useOptimistic, useState } from 'react'

type Task = { id: string; title: string }

type TaskBoardProps = {
  saveTask?: (title: string) => Promise<Task>
}

let nextSavedId = 1

async function defaultSaveTask(title: string): Promise<Task> {
  return { id: `saved-${nextSavedId++}`, title }
}

export default function TaskBoard({ saveTask = defaultSaveTask }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)

  const [optimisticTasks, addOptimisticTask] = useOptimistic(
    tasks,
    (currentTasks: Task[], title: string) => [
      ...currentTasks,
      { id: `optimistic-${title}`, title },
    ],
  )

  async function handleSubmit(formData: FormData) {
    const title = String(formData.get('title') ?? '').trim()

    if (title === '') {
      setError('请输入任务标题')
      return
    }

    setError(null)
    addOptimisticTask(title)

    try {
      const saved = await saveTask(title)
      // await 之后的真实 state 更新需要 startTransition，乐观层才能与真实值
      // 在同一次 transition 中收敛。
      startTransition(() => {
        setTasks((currentTasks) => [...currentTasks, saved])
      })
    } catch {
      startTransition(() => setError('添加失败，请重试'))
    }
  }

  return (
    <section aria-label="任务看板">
      <form action={handleSubmit}>
        <label>
          新任务
          <input name="title" />
        </label>
        <button type="submit">添加</button>
      </form>

      {error !== null && <p role="alert">{error}</p>}

      <p>已保存 {tasks.length} 个任务</p>

      <ul aria-label="任务列表">
        {optimisticTasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </section>
  )
}
