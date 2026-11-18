// 参考答案 3：乐观更新 + 失败回滚
//
// 流程：
// onMutate  → 取消进行中的 ['tasks'] 拉取（防止旧响应覆盖）→ 保存快照 →
//             立即 setQueryData 切换 completed → 返回 context
// onError   → 用 context.previousTasks 恢复快照
// onSettled → invalidateQueries，成功或失败最终都以服务端为准
//
// 为什么快照放在 context 而不是模块变量：并发点击多个任务时，每次 mutation
// 都需要自己那一份回滚数据；context 天然按 mutation 实例隔离。

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type Task = {
  id: string
  title: string
  completed: boolean
}

export type ListTasks = () => Promise<Task[]>
export type ToggleTask = (id: string) => Promise<Task>

const INITIAL_TASKS: Task[] = [
  { id: 't1', title: '写文档', completed: false },
  { id: 't2', title: '修 bug', completed: true },
]

async function defaultListTasks(): Promise<Task[]> {
  return INITIAL_TASKS.map((task) => ({ ...task }))
}

async function defaultToggleTask(id: string): Promise<Task> {
  const task = INITIAL_TASKS.find((item) => item.id === id)
  if (task === undefined) {
    throw new Error(`任务不存在：${id}`)
  }
  task.completed = !task.completed
  return { ...task }
}

type TaskToggleListProps = {
  listTasks?: ListTasks
  toggleTask?: ToggleTask
}

export default function TaskToggleList({
  listTasks = defaultListTasks,
  toggleTask = defaultToggleTask,
}: TaskToggleListProps) {
  const queryClient = useQueryClient()

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
  })

  const toggleMutation = useMutation({
    mutationFn: toggleTask,
    onMutate: async (id) => {
      // 1. 取消进行中的拉取：否则一个更早发出的 refetch 可能在乐观更新之后返回，
      //    用旧数据覆盖掉刚写进缓存的乐观结果。
      await queryClient.cancelQueries({ queryKey: ['tasks'] })

      // 2. 快照当前缓存，供失败时回滚。
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks'])

      // 3. 立即更新缓存；列表观察者会在本次通知后重渲染。
      queryClient.setQueryData<Task[]>(['tasks'], (oldTasks) =>
        oldTasks?.map((task) =>
          task.id === id ? { ...task, completed: !task.completed } : task,
        ),
      )

      return { previousTasks }
    },
    onError: (_error, _id, context) => {
      if (context?.previousTasks !== undefined) {
        queryClient.setQueryData(['tasks'], context.previousTasks)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  if (tasksQuery.isPending) {
    return <p role="status">加载中…</p>
  }

  if (tasksQuery.isError) {
    return <p role="alert">加载失败：{tasksQuery.error.message}</p>
  }

  return (
    <section aria-label="任务完成状态">
      <ul aria-label="任务列表">
        {tasksQuery.data.map((task) => (
          <li key={task.id}>
            <span>{task.title}</span>
            <span>{task.completed ? '已完成' : '未完成'}</span>
            <button
              type="button"
              aria-label={`切换任务：${task.title}`}
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate(task.id)}
            >
              切换完成状态
            </button>
          </li>
        ))}
      </ul>

      {toggleMutation.isError && <p role="alert">更新失败，请重试</p>}
    </section>
  )
}
