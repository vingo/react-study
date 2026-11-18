import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskFilter from './ex1'

// 这些测试是验收标准，不要修改断言。
// 查询方式：role + accessible name（用户/辅助技术看到的名字），
// 不用 data-testid，也不用 container.querySelector。

test('搜索框按可访问名称定位，输入关键词后过滤任务', async () => {
  const user = userEvent.setup()
  render(<TaskFilter />)

  const search = screen.getByRole('searchbox', { name: '搜索任务' })
  await user.type(search, '周报')

  expect(screen.getByRole('list', { name: '任务列表' })).toHaveTextContent(
    '写周报',
  )
  expect(screen.queryByText('整理会议记录')).not.toBeInTheDocument()
  expect(screen.getByText('1 个任务')).toBeInTheDocument()
})

test('“只看未完成”是按钮，点击后切换筛选并暴露按下状态', async () => {
  const user = userEvent.setup()
  render(<TaskFilter />)

  const toggle = screen.getByRole('button', { name: '只看未完成' })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await user.click(toggle)

  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('整理会议记录')).not.toBeInTheDocument()
  expect(screen.getByText('2 个任务')).toBeInTheDocument()

  await user.click(toggle)

  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByText('3 个任务')).toBeInTheDocument()
})

test('只用键盘也能到达筛选按钮并切换状态', async () => {
  const user = userEvent.setup()
  render(<TaskFilter />)

  const search = screen.getByRole('searchbox', { name: '搜索任务' })

  await user.tab()
  expect(search).toHaveFocus()

  await user.tab()
  const toggle = screen.getByRole('button', { name: '只看未完成' })
  expect(toggle).toHaveFocus()

  await user.keyboard('{Enter}')
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('2 个任务')).toBeInTheDocument()

  await user.keyboard('{Enter}')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByText('3 个任务')).toBeInTheDocument()
})
