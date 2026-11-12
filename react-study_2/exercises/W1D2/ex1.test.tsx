import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScoreBoard from './ex1'

test('一次点击 +3 使用 pending state 连续累加三次', async () => {
  const user = userEvent.setup()
  render(<ScoreBoard />)
  await user.click(screen.getByRole('button', { name: /分数：0/ }))
  expect(screen.getByRole('button')).toHaveTextContent('分数：3')
})
