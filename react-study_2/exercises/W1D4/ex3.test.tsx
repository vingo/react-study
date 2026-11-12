import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatComposer from './ex3'

test('受控输入提交后清空，并经由 ref 把焦点放回输入框', async () => {
  const user = userEvent.setup()
  render(<ChatComposer />)
  const input = screen.getByRole('textbox', { name: '消息' })
  const send = screen.getByRole('button', { name: '发送' })

  expect(send).toBeDisabled()
  await user.type(input, '你好')
  expect(send).toBeEnabled()
  await user.click(send)

  expect(screen.getByText('已发送：你好')).toBeInTheDocument()
  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
  expect(send).toBeDisabled()
})
