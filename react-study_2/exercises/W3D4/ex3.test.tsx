import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateTaskForm from './ex3'
import {
  createDeferred,
  jsonResponse,
  setupFetchMock,
  textResponse,
} from './test-utils'

const server = setupFetchMock()

beforeEach(() => {
  // 测试隔离：每个用例都从干净的 handler 与 localStorage 开始。
  server.reset()
  localStorage.clear()
})

afterAll(() => {
  server.restore()
})

test('空标题（含纯空格）不发起请求，并显示校验错误', async () => {
  const user = userEvent.setup()
  render(<CreateTaskForm />)

  const input = screen.getByRole('textbox', { name: '任务标题' })
  const submit = screen.getByRole('button', { name: '添加任务' })

  await user.click(submit)

  expect(screen.getByRole('alert')).toHaveTextContent('请输入任务标题')
  expect(server.fetchMock).not.toHaveBeenCalled()

  await user.type(input, '   ')
  await user.click(submit)

  expect(screen.getByRole('alert')).toHaveTextContent('请输入任务标题')
  expect(server.fetchMock).not.toHaveBeenCalled()
  expect(screen.getByText('0 个任务')).toBeInTheDocument()
})

test('提交时显示 pending，成功后清空输入并更新列表', async () => {
  const user = userEvent.setup()
  const deferred = createDeferred<Response>()
  server.on('POST', '/api/tasks', () => deferred.promise)

  render(<CreateTaskForm />)

  const input = screen.getByRole('textbox', { name: '任务标题' })
  await user.type(input, '写周报')
  await user.click(screen.getByRole('button', { name: '添加任务' }))

  const pending = screen.getByRole('button', { name: '提交中…' })
  expect(pending).toBeDisabled()
  expect(input).toHaveValue('写周报')

  await act(async () => {
    deferred.resolve(jsonResponse({ id: 't1', title: '写周报' }))
    await deferred.promise
  })

  expect(await screen.findByText('写周报')).toBeInTheDocument()
  expect(input).toHaveValue('')
  expect(screen.getByRole('button', { name: '添加任务' })).toBeEnabled()
  expect(screen.getByText('1 个任务')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('提交失败显示错误并保留输入；重试成功后清除错误并加入列表', async () => {
  const user = userEvent.setup()
  const retryResponse = createDeferred<Response>()
  let attempts = 0

  server.on('POST', '/api/tasks', () => {
    attempts += 1

    if (attempts === 1) {
      return textResponse('服务器错误', { status: 500 })
    }

    return retryResponse.promise
  })

  render(<CreateTaskForm />)

  const input = screen.getByRole('textbox', { name: '任务标题' })
  await user.type(input, '写周报')
  await user.click(screen.getByRole('button', { name: '添加任务' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    '创建失败，请重试',
  )
  expect(input).toHaveValue('写周报')
  expect(screen.getByText('0 个任务')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '添加任务' }))

  expect(screen.getByRole('button', { name: '提交中…' })).toBeDisabled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  await act(async () => {
    retryResponse.resolve(jsonResponse({ id: 't2', title: '写周报' }))
    await retryResponse.promise
  })

  expect(await screen.findByText('写周报')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(input).toHaveValue('')
  expect(screen.getByText('1 个任务')).toBeInTheDocument()
})
