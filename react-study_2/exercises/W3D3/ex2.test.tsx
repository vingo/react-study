import { fireEvent, render, screen, within } from '@testing-library/react'
import WorkspacePanel, {
  getBoardProfilerCommits,
  getBoardRenderCount,
  getCheapStatusCompareCount,
  getCheapStatusRenderCount,
  resetBoardLogs,
} from './ex2'

beforeEach(() => {
  resetBoardLogs()
})

test('首次挂载渲染一次指标面板，页脚与指标可见', () => {
  render(<WorkspacePanel />)

  expect(getBoardRenderCount()).toBe(1)
  expect(getBoardProfilerCommits()).toBe(1)

  const board = screen.getByLabelText('指标面板')
  expect(board).toHaveAttribute('data-team', 'alpha')
  expect(within(board).getByText('周活跃')).toBeInTheDocument()
  expect(within(board).getByText('4.2%')).toBeInTheDocument()
  expect(screen.getByText('数据来源：本地缓存')).toBeInTheDocument()
})

test('无关的备注输入不重渲染 memo 面板', () => {
  render(<WorkspacePanel />)
  resetBoardLogs()

  const note = screen.getByLabelText('备注')
  fireEvent.change(note, { target: { value: 'a' } })
  fireEvent.change(note, { target: { value: 'ab' } })

  expect(note).toHaveValue('ab')
  expect(screen.getByText('备注预览：ab')).toBeInTheDocument()

  expect(getBoardRenderCount()).toBe(0)
  expect(getBoardProfilerCommits()).toBe(0)
})

test('theme 这类外部 prop 变化也不重渲染 memo 面板', () => {
  const { rerender } = render(<WorkspacePanel />)
  resetBoardLogs()

  rerender(<WorkspacePanel theme="dark" />)

  // 外层确实收到了新的 theme。
  expect(screen.getByLabelText('工作台')).toHaveAttribute('data-theme', 'dark')

  // memo 面板的 props 没变（尤其不能每次新建 children），因此 bail out。
  expect(getBoardRenderCount()).toBe(0)
  expect(getBoardProfilerCommits()).toBe(0)
})

test('切换团队仍然重渲染面板，并显示对应指标', () => {
  render(<WorkspacePanel />)
  resetBoardLogs()

  fireEvent.change(screen.getByLabelText('团队'), {
    target: { value: 'beta' },
  })

  expect(getBoardRenderCount()).toBe(1)
  expect(getBoardProfilerCommits()).toBe(1)

  const board = screen.getByLabelText('指标面板')
  expect(board).toHaveAttribute('data-team', 'beta')
  expect(within(board).getByText('860')).toBeInTheDocument()
  expect(within(board).getByText('5.1%')).toBeInTheDocument()
})

test('详情按钮把已查看的指标交给面板外显示', () => {
  render(<WorkspacePanel />)

  fireEvent.click(screen.getByRole('button', { name: '详情 周活跃' }))

  expect(screen.getByText('已查看：周活跃')).toBeInTheDocument()
})

test('对照实验：props 每次都变时，memo 只比较不省渲染', () => {
  render(<WorkspacePanel />)
  resetBoardLogs()

  const refresh = screen.getByRole('button', { name: '刷新气泡' })
  fireEvent.click(refresh)
  fireEvent.click(refresh)
  fireEvent.click(refresh)

  expect(screen.getByLabelText('轻量状态')).toHaveTextContent('tick 3')

  // 3 次父更新 -> 3 次浅比较 -> 3 次重渲染，memo 没有减少任何一次渲染。
  expect(getCheapStatusCompareCount()).toBe(3)
  expect(getCheapStatusRenderCount()).toBe(3)
})
