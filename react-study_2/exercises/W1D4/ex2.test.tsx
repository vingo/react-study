import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileEditor from './ex2'

test('React 19 函数组件直接接收并透传 ref', async () => {
  const user = userEvent.setup()
  render(<ProfileEditor />)
  const input = screen.getByRole('textbox', { name: '昵称' })
  await user.click(screen.getByRole('button', { name: '编辑昵称' }))
  expect(input).toHaveFocus()
})
