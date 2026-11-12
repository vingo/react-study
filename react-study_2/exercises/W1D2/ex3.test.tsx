import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Cart from './ex3'

test('连续排队的三次购物车更新都作用于前一个 pending state', async () => {
  const user = userEvent.setup()
  render(<Cart />)
  await user.click(screen.getByRole('button', { name: '再加 3 件' }))
  expect(screen.getByText('茶：4 件')).toBeInTheDocument()
  expect(screen.getByText('合计：4 件')).toBeInTheDocument()
})
