import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import TaskBoard, { type Task } from './ex2'
import { createDeferred, renderWithQueryClient } from './test-utils'

test('首次渲染显示服务端返回的任务列表', async () => {
  const listTasks = vi.fn(async (): Promise<Task[]> => [{ id: 't1', title: '已有任务' }])
  const createTask = vi.fn(async (title: string): Promise<Task> => ({ id: 't9', title }))

  renderWithQueryClient(<TaskBoard listTasks={listTasks} createTask={createTask} />)

  expect(await screen.findByText('已有任务')).toBeInTheDocument()
  expect(listTasks).toHaveBeenCalledTimes(1)
})

test('提交后 POST 被调用，mutation pending 时按钮禁用，成功后恢复', async () => {
  const created = createDeferred<Task>()
  const tasks: Task[] = [{ id: 't1', title: '已有任务' }]
  const listTasks = vi.fn(async (): Promise<Task[]> => tasks.map((task) => ({ ...task })))
  const createTask = vi.fn((_title: string) => created.promise)

  renderWithQueryClient(<TaskBoard listTasks={listTasks} createTask={createTask} />)
  expect(await screen.findByText('已有任务')).toBeInTheDocument()

  fireEvent.change(screen.getByRole('textbox', { name: '任务标题' }), {
    target: { value: '新任务' },
  })
  const submitButton = screen.getByRole('button', { name: '添加任务' })

  await act(async () => {
    fireEvent.click(submitButton)
  })

  expect(createTask).toHaveBeenCalledTimes(1)
  // v5 会在 variables 之后再传一个 mutation context 对象，只断言第一个参数。
  expect(createTask.mock.calls[0]?.[0]).toBe('新任务')
  // React Query 默认用 setTimeout(0) 批量通知观察者，等通知 flush 后再断言。
  await waitFor(() => expect(submitButton).toBeDisabled())

  const newTask: Task = { id: 't2', title: '新任务' }
  tasks.push(newTask)

  await act(async () => {
    created.resolve(newTask)
    await created.promise
  })

  await waitFor(() => expect(submitButton).toBeEnabled())
})

test('提交成功后列表重新拉取并出现新任务', async () => {
  const created = createDeferred<Task>()
  const tasks: Task[] = [{ id: 't1', title: '已有任务' }]
  const listTasks = vi.fn(async (): Promise<Task[]> => tasks.map((task) => ({ ...task })))
  const createTask = vi.fn(() => created.promise)

  renderWithQueryClient(<TaskBoard listTasks={listTasks} createTask={createTask} />)
  expect(await screen.findByText('已有任务')).toBeInTheDocument()

  fireEvent.change(screen.getByRole('textbox', { name: '任务标题' }), {
    target: { value: '新任务' },
  })

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '添加任务' }))
  })
  expect(screen.queryByText('新任务')).not.toBeInTheDocument()

  const newTask: Task = { id: 't2', title: '新任务' }
  tasks.push(newTask)

  await act(async () => {
    created.resolve(newTask)
    await created.promise
  })

  expect(await screen.findByText('新任务')).toBeInTheDocument()
  expect(await screen.findByText('已有任务')).toBeInTheDocument()
  expect(listTasks).toHaveBeenCalledTimes(2)
})
