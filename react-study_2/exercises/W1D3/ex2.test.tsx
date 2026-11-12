import { render, screen } from '@testing-library/react'
import { act } from 'react'
import WindowWidth from './ex2'

test('挂载时读取窗口宽度，并在 resize 后同步', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 })
  const { unmount } = render(<WindowWidth />)
  expect(screen.getByText('宽度：900')).toBeInTheDocument()

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
  act(() => window.dispatchEvent(new Event('resize')))
  expect(screen.getByText('宽度：1200')).toBeInTheDocument()
  unmount()

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 })
  act(() => window.dispatchEvent(new Event('resize')))
})
