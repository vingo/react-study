import { act, fireEvent, screen } from '@testing-library/react'
import { createAppRoutes, createTaskStore, type Task } from './ex2'
import { currentUrl, renderRouter } from './test-utils'

const TEST_TASKS: Task[] = [
  { id: 'a1', title: '第一项', done: false },
  { id: 'a2', title: '第二项', done: true },
  { id: 'a3', title: '第三项', done: false },
]

function setup(initialEntries: string[] = ['/'], initialTasks: Task[] = TEST_TASKS) {
  const store = createTaskStore(initialTasks)
  const { router } = renderRouter(createAppRoutes(store), initialEntries)
  return { store, router }
}

async function submitForm() {
  const button = screen.getByRole('button', { name: '创建任务' })
  await act(async () => {
    fireEvent.click(button)
  })
}

test('列表页 loader 返回 store 中的任务', async () => {
  setup()

  expect(await screen.findByRole('heading', { name: '任务列表' })).toBeInTheDocument()
  expect(await screen.findByText('第一项')).toBeInTheDocument()
  expect(screen.getByText('第二项')).toBeInTheDocument()
  expect(screen.getByText('第三项')).toBeInTheDocument()
  expect(screen.queryByText('写周报')).not.toBeInTheDocument()
})

test('详情页 loader 使用 params.taskId 返回对应任务', async () => {
  setup(['/tasks/a2'])

  expect(await screen.findByRole('heading', { name: '第二项' })).toBeInTheDocument()
  expect(screen.getByText('状态：已完成')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '第一项' })).not.toBeInTheDocument()
})

test('详情页遇到不存在的 id 显示 404 错误', async () => {
  setup(['/tasks/missing'])

  expect(await screen.findByRole('alert')).toHaveTextContent('任务不存在')
})

test('空标题提交时返回校验错误，不创建任务，也不跳转', async () => {
  const { store, router } = setup(['/tasks/new'])
  const initialCount = store.tasks.length

  const input = await screen.findByRole('textbox', { name: '任务标题' })
  fireEvent.change(input, { target: { value: '   ' } })
  await submitForm()

  expect(await screen.findByRole('alert')).toHaveTextContent('标题不能为空')
  expect(store.tasks).toHaveLength(initialCount)
  expect(currentUrl(router)).toBe('/tasks/new')
})

test('提交有效标题后创建任务、redirect 到列表并看到新任务', async () => {
  const { store, router } = setup(['/tasks/new'])

  const input = await screen.findByRole('textbox', { name: '任务标题' })
  fireEvent.change(input, { target: { value: '  新任务  ' } })
  await submitForm()

  expect(await screen.findByText('新任务')).toBeInTheDocument()
  expect(currentUrl(router)).toBe('/')
  expect(screen.getByRole('heading', { name: '任务列表' })).toBeInTheDocument()
  expect(store.tasks).toHaveLength(TEST_TASKS.length + 1)
  expect(store.tasks.at(-1)).toMatchObject({ title: '新任务', done: false })
})
