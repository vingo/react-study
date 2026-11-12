import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import Stopwatch from './ex3'

test('运行时每秒增加，停止后清理 interval', () => {
  vi.useFakeTimers()
  try {
    render(<Stopwatch />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))

    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText('秒数：3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByText('秒数：3')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
