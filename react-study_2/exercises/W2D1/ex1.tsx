// 练习 1：修复 useActionState 表单（15 分钟）
// 现象：
// 1. 标题为空时提交，界面没有任何错误提示。
// 2. 连续添加两个任务时，前一个任务会消失。
// 3. 成功添加后，输入框仍保留刚才输入的标题。
// 只修改 submitTask 和 TaskForm；不要修改测试里的断言。

import { startTransition, useActionState, useState } from 'react'

type Task = { id: number; title: string }
type TaskState = { tasks: Task[]; error: string | null }

const initialState: TaskState = { tasks: [], error: null }

// 注意 action 的签名是 (prevState, formData)。
// 现在的实现每次从空白列表开始，导致上一次提交的结果被覆盖。
let nextId = 1

async function submitTask(_prevState: TaskState, formData: FormData): Promise<TaskState> {
  const title = String(formData.get('title') ?? '').trim()

  if (title === '') {
    return { ..._prevState, error: '请输入任务标题' }
  }

  return { tasks: [... _prevState.tasks, { id: nextId++, title }], error: null }
}

export default function TaskForm() {
  const [title, setTitle] = useState('')
  const [state, formAction, isPending] = useActionState(async (prevState: TaskState, formData: FormData) => {
      const nextState = await submitTask(prevState, formData)
      if (nextState.error === null) {
        // await 之后的 state 更新需要再包一层 startTransition。
        startTransition(() => setTitle(''))
      }
      return nextState
  }, initialState)

  // TODO：成功提交后清空输入框（错误时保留输入，方便用户修改）。
  // 提示：若在 action 的 await 之后更新 state，需要再包一层 startTransition。
  if (isPending) {
    // setTitle('')
  }

  return (
    <section aria-label="任务表单">
      <form action={formAction}>
        <label>
          任务标题
          <input
            name="title"
            value={title}
            onChange={(event) => startTransition( () => setTitle(event.target.value)) }
          />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? '添加中…' : '添加任务'}
        </button>
      </form>

      {/* TODO：state.error 不为空时，用 role="alert" 显示错误。 */}
      {state.error !== null && <p role="alert">{state.error}</p>}
      <ul aria-label="任务列表">
        {state.tasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </section>
  )
}
