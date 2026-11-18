import { act, fireEvent, render, screen } from '@testing-library/react'
import ProfilePanel, { type User } from './ex2'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function rejectWithinAct<T>(
  deferred: ReturnType<typeof createDeferred<T>>,
  error: Error,
) {
  try {
    await act(async () => {
      deferred.reject(error)
      await deferred.promise.catch(() => {})
    })
  } catch {
    // 起始代码没有错误边界时，React 会把未捕获的渲染错误抛回测试。
    // 吞掉它，让下面的断言负责说明“没有错误 UI”。
  }
}

const originalError = console.error.bind(console)

beforeEach(() => {
  // 错误边界测试会触发 React 预期的错误日志（“The above error occurred...”
  // 以及被抛出的 Error 本身），这里只屏蔽这些噪声，其余 console.error 原样输出。
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args
      .map((arg) => (arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg)))
      .join(' ')
    if (
      text.includes('The above error occurred') ||
      text.includes('An error occurred in the') ||
      text.includes('网络错误')
    ) {
      return
    }
    originalError(...args)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('挂起时显示加载提示，resolve 后显示用户内容', async () => {
  const profile = createDeferred<User>()
  const loadProfile = vi.fn(() => profile.promise)

  // 首次渲染就挂起，需要异步 act 才能正确 flush Suspense 重试。
  await act(async () => {
    render(<ProfilePanel loadProfile={loadProfile} />)
  })

  expect(screen.getByRole('status')).toHaveTextContent('加载中…')
  expect(loadProfile).toHaveBeenCalledTimes(1)

  await act(async () => {
    profile.resolve({ id: 'u1', name: 'Ada Lovelace' })
    await profile.promise
  })

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
  expect(screen.getByText('u1')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('reject 时显示错误提示，点击重试后用新的 promise 成功', async () => {
  const first = createDeferred<User>()
  const second = createDeferred<User>()
  const loadProfile = vi
    .fn<() => Promise<User>>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)

  await act(async () => {
    render(<ProfilePanel loadProfile={loadProfile} />)
  })
  expect(screen.getByRole('status')).toHaveTextContent('加载中…')

  await rejectWithinAct(first, new Error('网络错误'))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('加载失败，请重试')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()

  // 重试会让子树重新挂起，用异步 act 包住点击才能正确 flush。
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
  })

  expect(loadProfile).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('status')).toHaveTextContent('加载中…')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  await act(async () => {
    second.resolve({ id: 'u2', name: 'Grace Hopper' })
    await second.promise
  })

  expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
  expect(screen.getByText('u2')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('重试后再次失败，仍然显示错误 UI 而不是崩溃', async () => {
  const first = createDeferred<User>()
  const second = createDeferred<User>()
  const loadProfile = vi
    .fn<() => Promise<User>>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)

  await act(async () => {
    render(<ProfilePanel loadProfile={loadProfile} />)
  })

  await rejectWithinAct(first, new Error('网络错误'))
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败，请重试')

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
  })
  expect(screen.getByRole('status')).toHaveTextContent('加载中…')

  await rejectWithinAct(second, new Error('网络错误'))

  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败，请重试')
  expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  expect(loadProfile).toHaveBeenCalledTimes(2)
})
