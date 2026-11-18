import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InboxPanel from './ex2'
import {
  createDeferred,
  jsonResponse,
  setupFetchMock,
  textResponse,
} from './test-utils'

const server = setupFetchMock()

beforeEach(() => {
  server.reset()
})

afterAll(() => {
  server.restore()
})

test('请求完成前显示加载状态，完成后显示消息列表', async () => {
  const deferred = createDeferred<Response>()
  server.on('GET', '/api/inbox', () => deferred.promise)

  render(<InboxPanel />)

  expect(screen.getByRole('status')).toHaveTextContent('加载中…')

  await act(async () => {
    deferred.resolve(jsonResponse([{ id: 'm1', title: '本周周报' }]))
    await deferred.promise
  })

  expect(await screen.findByText('本周周报')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('成功但列表为空时显示空状态', async () => {
  server.on('GET', '/api/inbox', () => jsonResponse([]))

  render(<InboxPanel />)

  expect(await screen.findByText('收件箱为空')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument(),
  )
  expect(
    screen.queryByRole('list', { name: '消息列表' }),
  ).not.toBeInTheDocument()
})

test('接口失败时显示错误，点击重试后先 loading 再成功', async () => {
  const user = userEvent.setup()
  const retryResponse = createDeferred<Response>()
  let attempts = 0

  server.on('GET', '/api/inbox', () => {
    attempts += 1

    if (attempts === 1) {
      return textResponse('服务器错误', { status: 500 })
    }

    return retryResponse.promise
  })

  render(<InboxPanel />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    '加载失败，请重试',
  )
  expect(server.fetchMock).toHaveBeenCalledTimes(1)

  await user.click(screen.getByRole('button', { name: '重试' }))

  expect(screen.getByRole('status')).toHaveTextContent('加载中…')
  expect(server.fetchMock).toHaveBeenCalledTimes(2)

  await act(async () => {
    retryResponse.resolve(
      jsonResponse([{ id: 'm2', title: '重试后的消息' }]),
    )
    await retryResponse.promise
  })

  expect(await screen.findByText('重试后的消息')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
