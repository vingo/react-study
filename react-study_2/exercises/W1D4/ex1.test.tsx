import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBox from './ex1'

test('点击按钮后，原生 input 获得焦点', async () => {
  const user = userEvent.setup()
  render(<SearchBox />)
  const input = screen.getByRole('textbox', { name: '关键词' })
  expect(input).not.toHaveFocus()
  await user.click(screen.getByRole('button', { name: '聚焦搜索框' }))
  expect(input).toHaveFocus()
})
