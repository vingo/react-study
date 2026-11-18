// 练习 3：Mutation 乐观更新 + 失败回滚（20 分钟）
//
// 现状：
// - 列表用 useQuery(['tasks']) 读取；
// - 每行有一个“切换完成状态”按钮，用 useMutation(toggleTask) 提交；
// - mutation 要等服务端返回后才更新列表，点击后有明显延迟；
// - 请求失败时列表保持原样，但没有任何回滚逻辑（目前也没做乐观更新）。
//
// 要求：只补全 useMutation 的三个回调，实现标准的乐观更新流程：
// 1. onMutate：
//    - await queryClient.cancelQueries({ queryKey: ['tasks'] }) 取消进行中的拉取，
//      避免旧响应覆盖乐观结果；
//    - 用 getQueryData 保存当前列表快照；
//    - 用 setQueryData 立即把目标任务切换 completed；
//    - 返回 { previousTasks } 作为 context。
// 2. onError：用 context.previousTasks 恢复快照。
// 3. onSettled：invalidateQueries({ queryKey: ['tasks'] })，成功或失败都以服务端为准。
//
// 不要修改测试里的断言，也不要改 mutationFn 的签名。
// 提示：onMutate 里 await 之后才 setQueryData 是可以的；测试会用异步 act 包住点击，
// 在断言前 flush 微任务。回滚只需要 context 里保存的那份快照。

import { MutationFunctionContext, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
    // TODO 1：onMutate —— 取消进行中的查询、保存快照、立即更新缓存。
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

    // TODO 2：onError —— 用快照回滚。
     onError: (_error, _id, context) => {
      if (context?.previousTasks !== undefined) {
        queryClient.setQueryData(['tasks'], context.previousTasks)
      }
    },

    // TODO 3：onSettled —— invalidateQueries 让服务端结果最终生效。
    onSettled: () => {
       void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
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
