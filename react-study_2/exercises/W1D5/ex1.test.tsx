import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Accordion from './ex1'

test('展开一个 Panel 时，另一个 Panel 自动关闭', async () => {
  const user = userEvent.setup()
  render(<Accordion />)

  await user.click(screen.getByRole('button', { name: '展开账户' }))
  expect(screen.getByText('账户设置内容')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '展开订单' }))
  expect(screen.queryByText('账户设置内容')).not.toBeInTheDocument()
  expect(screen.getByText('订单记录内容')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '展开账户' })).toHaveAttribute('aria-expanded', 'false')
})
