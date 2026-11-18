import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { Workspace, resetWorkspaceStore } from './ex2'

beforeEach(() => {
  resetWorkspaceStore()
})

// 测试专用探针：显示当前 URL，并提供一个“外部导航”的入口，
// 用来模拟前进/后退或直接改地址栏，验证筛选状态真的来自 URL。
function UrlProbe() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <>
      <output data-testid="url">
        {location.pathname}
        {location.search}
      </output>
      <button type="button" onClick={() => navigate('/?q=评审')}>
        跳到评审筛选
      </button>
    </>
  )
}

function renderApp(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UrlProbe />
      <Workspace />
    </MemoryRouter>,
  )
}

function currentUrl() {
  return decodeURIComponent(screen.getByTestId('url').textContent ?? '')
}

test('主题与侧边栏是全局状态，切换后所有订阅者同步更新', () => {
  renderApp()

  expect(screen.getByText('当前主题：浅色')).toBeInTheDocument()
  expect(
    screen.queryByRole('complementary', { name: '侧边栏' }),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '切换到深色' }))
  expect(screen.getByText('当前主题：深色')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '侧边栏' }))
  expect(
    screen.getByRole('complementary', { name: '侧边栏' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '侧边栏' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
})

test('收藏 action 不可变地增删，派生数量始终正确', () => {
  renderApp()

  expect(screen.getByText('已收藏 0 个任务')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '收藏 写周报' }))
  fireEvent.click(screen.getByRole('button', { name: '收藏 评审 PR' }))

  expect(screen.getByText('已收藏 2 个任务')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '收藏 写周报' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  fireEvent.click(screen.getByRole('button', { name: '收藏 写周报' }))

  expect(screen.getByText('已收藏 1 个任务')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '收藏 写周报' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  // 取消收藏一个任务，不应该顺带把另一个也弄丢。
  expect(screen.getByRole('button', { name: '收藏 评审 PR' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('筛选关键词属于 URL：输入写回 URL，外部导航也会同步到界面', () => {
  renderApp('/?q=周报')

  const input = screen.getByLabelText('筛选任务')
  expect(input).toHaveValue('周报')
  expect(screen.getByText('共 1 个任务')).toBeInTheDocument()
  expect(screen.getByText('写周报')).toBeInTheDocument()
  expect(screen.queryByText('修复登录 bug')).not.toBeInTheDocument()

  fireEvent.change(input, { target: { value: 'bug' } })

  expect(currentUrl()).toBe('/?q=bug')
  expect(screen.getByText('共 1 个任务')).toBeInTheDocument()
  expect(screen.getByText('修复登录 bug')).toBeInTheDocument()
  expect(screen.queryByText('写周报')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '跳到评审筛选' }))

  expect(currentUrl()).toBe('/?q=评审')
  expect(screen.getByLabelText('筛选任务')).toHaveValue('评审')
  expect(screen.getByText('评审 PR')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('筛选任务'), { target: { value: '' } })

  expect(currentUrl()).toBe('/')
  expect(screen.getByText('共 4 个任务')).toBeInTheDocument()
})

test('编辑草稿留在局部 state：关闭编辑器后再次打开会重置', () => {
  renderApp()

  fireEvent.click(screen.getByRole('button', { name: '编辑 写周报' }))

  const draft = screen.getByLabelText('草稿 写周报')
  fireEvent.change(draft, { target: { value: '临时草稿，不该被记住' } })
  expect(draft).toHaveValue('临时草稿，不该被记住')

  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByLabelText('草稿 写周报')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '编辑 写周报' }))
  expect(screen.getByLabelText('草稿 写周报')).toHaveValue('写周报')
})
