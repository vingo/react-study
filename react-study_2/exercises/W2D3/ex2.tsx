// 练习 2：Mutation 成功后让任务列表失效（15 分钟）
//
// 现状：
// - 列表用 useQuery(['tasks']) 读取；
// - 表单用 useMutation(createTask) 提交；
// - POST 成功了，但列表还是旧的，必须刷新页面才能看到新任务。
//
// 要求：只补全 useMutation 的 onSuccess，让 ['tasks'] 查询失效并重新拉取。
// 可以使用 invalidateQueries，也可以视情况用 setQueryData；本题推荐前者。
// 不要修改测试里的断言。
//
// 提示：useQueryClient() 拿到同一个 client；invalidateQueries 会把匹配的查询标记
// 为 stale，并对正在观察它的组件触发 refetch。key 必须能被 ['tasks'] 前缀匹配。
// 注意 onSuccess 改在 useMutation 配置里，而不是写在 mutate() 的局部回调里——
// 后者也能工作，但把“提交成功后数据一致性”留在组件事件里，容易漏掉其他入口。

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
    // TODO：成功后让 ['tasks'] 查询失效，触发列表重新拉取。
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
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
