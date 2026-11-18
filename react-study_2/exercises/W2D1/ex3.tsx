// 练习 3：useOptimistic 乐观添加 + 失败回滚（20 分钟）
// 需求：点击“添加”后，任务立刻出现在列表里（乐观项）；
// 保存成功后，用真实 state 中的任务替换乐观项；
// 保存失败时，乐观项自动回滚，并显示错误提示。
// 补全 3 个 TODO；不要修改测试里的断言。

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
    (currentTasks: Task[], title: string) =>
      // TODO 1：返回一个追加了乐观任务的新数组，id 使用 `optimistic-${title}`。
      [...currentTasks, {id: `optimistic-${title}`, title}]
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
      startTransition(() => {
        setTasks((currentyTasks) => {
          return [...currentyTasks, saved]
        })
      })
      // TODO 2：保存成功后，把 saved 写入真实任务列表。
      // 提示：await 之后的 state 更新需要包在 startTransition 内。
      void saved
    } catch {
      // TODO 3：保存失败时显示“添加失败，请重试”。
      // 乐观项会在这次 action 结束后自动回滚；这里的 setError 在 await 之后，
      // 同样要包在 startTransition 内。
      setError('添加失败，请重试')
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
