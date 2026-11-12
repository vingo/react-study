import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Messenger from './ex2'

test('切换收件人时，用稳定 key 重置 Chat 的本地草稿', async () => {
  const user = userEvent.setup()
  render(<Messenger />)

  const adaInput = screen.getByRole('textbox', { name: '给 Ada 的消息' })
  await user.type(adaInput, 'Ada 的草稿')
  expect(adaInput).toHaveValue('Ada 的草稿')

  await user.click(screen.getByRole('button', { name: 'Grace' }))
  expect(screen.getByRole('textbox', { name: '给 Grace 的消息' })).toHaveValue('')

  await user.type(screen.getByRole('textbox', { name: '给 Grace 的消息' }), 'Grace 的草稿')
  await user.click(screen.getByRole('button', { name: 'Ada' }))
  expect(screen.getByRole('textbox', { name: '给 Ada 的消息' })).toHaveValue('')
})
