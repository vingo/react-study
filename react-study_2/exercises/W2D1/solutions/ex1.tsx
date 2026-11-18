// 参考实现：使用 prevState 追加任务、渲染错误、成功后清空输入。

import { startTransition, useActionState, useState } from 'react'

type Task = { id: number; title: string }
type TaskState = { tasks: Task[]; error: string | null }

const initialState: TaskState = { tasks: [], error: null }
let nextId = 1

async function submitTask(prevState: TaskState, formData: FormData): Promise<TaskState> {
  const title = String(formData.get('title') ?? '').trim()

  if (title === '') {
    return { ...prevState, error: '请输入任务标题' }
  }

  return {
    tasks: [...prevState.tasks, { id: nextId++, title }],
    error: null,
  }
}

export default function TaskForm() {
  const [title, setTitle] = useState('')
  const [state, formAction, isPending] = useActionState(
    async (prevState: TaskState, formData: FormData) => {
      const nextState = await submitTask(prevState, formData)
      if (nextState.error === null) {
        // await 之后的 state 更新需要再包一层 startTransition。
        startTransition(() => setTitle(''))
      }
      return nextState
    },
    initialState,
  )

  return (
    <section aria-label="任务表单">
      <form action={formAction}>
        <label>
          任务标题
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? '添加中…' : '添加任务'}
        </button>
      </form>

      {state.error !== null && <p role="alert">{state.error}</p>}

      <ul aria-label="任务列表">
        {state.tasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </section>
  )
}
