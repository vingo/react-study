import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeProfile from './ex2'

test('嵌套 theme 更新后触发界面更新', async () => {
  const user = userEvent.setup()
  render(<ThemeProfile />)
  await user.click(screen.getByRole('button', { name: '启用深色主题' }))
  expect(screen.getByText('主题：dark')).toBeInTheDocument()
})
