import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import TaskToggleList, { type Task } from './ex3'
import { createDeferred, renderWithQueryClient } from './test-utils'

function createTasks(): Task[] {
  return [
    { id: 't1', title: '写文档', completed: false },
    { id: 't2', title: '修 bug', completed: true },
  ]
}

function getTaskRow(title: string): HTMLElement {
  const row = screen.getByText(title).closest('li')
  if (row === null) {
    throw new Error(`找不到任务行：${title}`)
  }
  return row as HTMLElement
}

async function clickToggle(title: string) {
  // onMutate 里先 await cancelQueries 再写缓存，用异步 act 包住点击，
  // 断言前微任务才会被 flush。
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `切换任务：${title}` }))
  })
}

function setup(tasks: Task[]) {
  const toggled = createDeferred<Task>()
  const listTasks = vi.fn(async () => tasks.map((task) => ({ ...task })))
  const toggleTask = vi.fn((_id: string) => toggled.promise)

  const view = renderWithQueryClient(
    <TaskToggleList listTasks={listTasks} toggleTask={toggleTask} />,
  )

  return { toggled, listTasks, toggleTask, view }
}

test('点击后立即乐观更新，不等服务端返回', async () => {
  const tasks = createTasks()
  const { toggled, toggleTask } = setup(tasks)

  expect(await screen.findByText('写文档')).toBeInTheDocument()
  expect(within(getTaskRow('写文档')).getByText('未完成')).toBeInTheDocument()

  await clickToggle('写文档')

  expect(toggleTask).toHaveBeenCalledTimes(1)
  // v5 会在 variables 之后再传一个 mutation context 对象，只断言第一个参数。
  expect(toggleTask.mock.calls[0]?.[0]).toBe('t1')
  // 服务端 promise 仍未 resolve；此时 UI 已切换，才说明是乐观更新。
  await waitFor(() =>
    expect(within(getTaskRow('写文档')).getByText('已完成')).toBeInTheDocument(),
  )

  // 清理：让 mutation 正常结束，避免用例结束时还挂着一个 pending 请求。
  tasks[0] = { ...tasks[0], completed: true }
  await act(async () => {
    toggled.resolve(tasks[0])
    await toggled.promise
  })
})

test('服务端成功后保持乐观结果，并重新拉取列表', async () => {
  const tasks = createTasks()
  const { toggled, listTasks } = setup(tasks)

  expect(await screen.findByText('写文档')).toBeInTheDocument()
  await clickToggle('写文档')
  await waitFor(() =>
    expect(within(getTaskRow('写文档')).getByText('已完成')).toBeInTheDocument(),
  )

  tasks[0] = { ...tasks[0], completed: true }

  await act(async () => {
    toggled.resolve(tasks[0])
    await toggled.promise
  })

  await waitFor(() => expect(listTasks).toHaveBeenCalledTimes(2))

  expect(within(getTaskRow('写文档')).getByText('已完成')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('服务端失败时回滚到快照，并显示错误提示', async () => {
  const tasks = createTasks()
  const { toggled, listTasks } = setup(tasks)

  expect(await screen.findByText('写文档')).toBeInTheDocument()
  await clickToggle('写文档')
  await waitFor(() =>
    expect(within(getTaskRow('写文档')).getByText('已完成')).toBeInTheDocument(),
  )

  await act(async () => {
    toggled.reject(new Error('保存失败'))
    await toggled.promise.catch(() => {})
  })

  expect(await screen.findByRole('alert')).toHaveTextContent('更新失败，请重试')

  await waitFor(() => expect(listTasks).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(within(getTaskRow('写文档')).getByText('未完成')).toBeInTheDocument(),
  )
  expect(within(getTaskRow('修 bug')).getByText('已完成')).toBeInTheDocument()
})
