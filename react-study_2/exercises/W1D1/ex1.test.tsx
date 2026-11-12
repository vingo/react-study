import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import TeaSet from './ex1'

test('StrictMode 下三个茶杯依次是第 1、2、3 位客人', () => {
  render(
    <StrictMode>
      <TeaSet />
    </StrictMode>,
  )
  const titles = screen.getAllByRole('heading').map((h) => h.textContent)
  expect(titles).toEqual(['给第 1 位客人的茶杯', '给第 2 位客人的茶杯', '给第 3 位客人的茶杯'])
})

test('重复渲染结果不变（纯函数：相同输入，相同输出）', () => {
  const first = render(<TeaSet />)
  const a = first.container.textContent
  first.unmount()
  const b = render(<TeaSet />).container.textContent
  expect(b).toBe(a)
})
