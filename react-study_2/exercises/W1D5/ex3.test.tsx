import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskApp from './ex3'

test('Context 中的 dispatch 添加任务，state Context 更新列表', async () => {
  const user = userEvent.setup()
  render(<TaskApp />)
  await user.click(screen.getByRole('button', { name: '新增练习' }))
  expect(screen.getByRole('button', { name: '待办：写练习' })).toBeInTheDocument()
})

test('reducer 不可变地切换指定任务的完成状态', async () => {
  const user = userEvent.setup()
  render(<TaskApp />)
  await user.click(screen.getByRole('button', { name: '待办：阅读 React' }))
  expect(screen.getByRole('button', { name: '完成：阅读 React' })).toHaveAttribute('aria-pressed', 'true')
})
