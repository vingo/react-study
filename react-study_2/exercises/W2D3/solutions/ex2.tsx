// 参考答案 2：mutation 成功后让列表查询失效
//
// invalidateQueries 做两件事：
// 1. 把匹配 ['tasks'] 的所有查询标记为 stale；
// 2. 对当前有观察者的查询立即 refetch。
// 这样不管是这次创建、别的标签页创建，还是后续其他 mutation，只要调用了失效，
// 列表都会以服务端为准。局部 setQueryData 也可行，但需要自己维护完整数据。

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type Task = { id: string; title: string }

export type ListTasks = () => Promise<Task[]>
export type CreateTask = (title: string) => Promise<Task>

const INITIAL_TASKS: Task[] = [{ id: 't1', title: '已有任务' }]

async function defaultListTasks(): Promise<Task[]> {
  return INITIAL_TASKS.map((task) => ({ ...task }))
}

let nextId = 2

async function defaultCreateTask(title: string): Promise<Task> {
  const task: Task = { id: `t${nextId++}`, title }
  INITIAL_TASKS.push(task)
  return task
}

type TaskBoardProps = {
  listTasks?: ListTasks
  createTask?: CreateTask
}

export default function TaskBoard({
  listTasks = defaultListTasks,
  createTask = defaultCreateTask,
}: TaskBoardProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
  })

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (trimmed === '') {
      return
    }

    createMutation.mutate(trimmed, {
      onSuccess: () => setTitle(''),
    })
  }

  return (
    <section aria-label="任务看板">
      <form onSubmit={handleSubmit}>
        <label>
          任务标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <button type="submit" disabled={createMutation.isPending}>
          添加任务
        </button>
      </form>

      {tasksQuery.isPending ? (
        <p role="status">加载中…</p>
      ) : tasksQuery.isError ? (
        <p role="alert">加载失败：{tasksQuery.error.message}</p>
      ) : (
        <ul aria-label="任务列表">
          {tasksQuery.data.map((task) => (
            <li key={task.id}>{task.title}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
