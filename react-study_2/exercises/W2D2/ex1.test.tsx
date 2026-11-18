import { act, render, screen } from '@testing-library/react'
import ProfileCard, {
  getFetchCallCount,
  resetFetchCallCount,
  resetUserCache,
  resolvePendingFetches,
} from './ex1'

beforeEach(() => {
  resetFetchCallCount()
  resetUserCache()
})

test('挂起时显示加载提示，resolve 后显示用户内容，且只请求一次', async () => {
  // React 19 下，首次渲染就挂起的组件需要放在异步 act 中，
  // 否则 Suspense 的重试不会被正确 flush。
  await act(async () => {
    render(<ProfileCard userId="u1" />)
  })

  expect(screen.getByRole('status')).toHaveTextContent('加载中…')

  await act(async () => {
    resolvePendingFetches()
  })

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
  expect(screen.getByText('u1')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(getFetchCallCount()).toBe(1)
})

test('相同 userId 重新渲染不重复请求；切换 userId 只为新参数请求一次', async () => {
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(<ProfileCard userId="u1" />)
  })
  await act(async () => {
    resolvePendingFetches()
  })
  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

  await act(async () => {
    view.rerender(<ProfileCard userId="u1" />)
  })
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  expect(getFetchCallCount()).toBe(1)

  await act(async () => {
    view.rerender(<ProfileCard userId="u2" />)
  })
  expect(screen.getByRole('status')).toHaveTextContent('加载中…')
  await act(async () => {
    resolvePendingFetches()
  })
  expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
  expect(screen.getByText('u2')).toBeInTheDocument()
  expect(getFetchCallCount()).toBe(2)
})
