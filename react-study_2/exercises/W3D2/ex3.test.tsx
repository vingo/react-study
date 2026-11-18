import { fireEvent, render, screen } from '@testing-library/react'
import KeepAliveTabs, {
  getKeepAliveLog,
  resetKeepAliveLog,
} from './ex3'

beforeEach(() => {
  resetKeepAliveLog()
})

test('两个 tab 始终保留在 DOM 中，隐藏面板为 display: none', () => {
  render(<KeepAliveTabs />)

  const notesPanel = screen.queryByTestId('notes-panel')
  const statsPanel = screen.queryByTestId('stats-panel')

  // keep-alive：隐藏的统计面板没有被卸载。
  expect(notesPanel).not.toBeNull()
  expect(statsPanel).not.toBeNull()

  expect(window.getComputedStyle(notesPanel as HTMLElement).display).not.toBe(
    'none',
  )
  expect(window.getComputedStyle(statsPanel as HTMLElement).display).toBe(
    'none',
  )

  fireEvent.click(screen.getByRole('tab', { name: '统计' }))

  // 切换后可见性反转，但两个面板都还在 DOM 中。
  expect(screen.queryByTestId('notes-panel')).not.toBeNull()
  expect(screen.queryByTestId('stats-panel')).not.toBeNull()
  expect(
    window.getComputedStyle(screen.getByTestId('notes-panel')).display,
  ).toBe('none')
  expect(
    window.getComputedStyle(screen.getByTestId('stats-panel')).display,
  ).not.toBe('none')
})

test('隐藏时 Effects cleanup、切回后 state 恢复且 Effects 重建', () => {
  render(<KeepAliveTabs />)

  // 初始只挂载了可见的笔记面板。
  expect(getKeepAliveLog()).toContain('notes:mount')
  expect(getKeepAliveLog()).not.toContain('stats:mount')

  fireEvent.change(screen.getByLabelText('笔记草稿'), {
    target: { value: '草稿 A' },
  })

  fireEvent.click(screen.getByRole('tab', { name: '统计' }))

  // 隐藏笔记面板：effect cleanup；统计面板变为可见：effect setup。
  expect(getKeepAliveLog()).toEqual([
    'notes:mount',
    'notes:cleanup',
    'stats:mount',
  ])
  expect(screen.queryByLabelText('笔记草稿')).not.toBeNull()
  expect(
    window.getComputedStyle(screen.getByTestId('notes-panel')).display,
  ).toBe('none')

  fireEvent.click(screen.getByRole('button', { name: '点赞' }))
  fireEvent.click(screen.getByRole('button', { name: '点赞' }))
  fireEvent.change(screen.getByLabelText('统计备注'), {
    target: { value: '备注 B' },
  })
  expect(screen.getByLabelText('点赞数')).toHaveTextContent('2')

  fireEvent.click(screen.getByRole('tab', { name: '笔记' }))

  // 统计面板 cleanup，笔记面板重新 setup。
  expect(getKeepAliveLog()).toEqual([
    'notes:mount',
    'notes:cleanup',
    'stats:mount',
    'stats:cleanup',
    'notes:mount',
  ])

  // state 原样恢复；隐藏面板里的 state 也没有丢。
  expect(screen.getByLabelText('笔记草稿')).toHaveValue('草稿 A')
  expect(screen.getByLabelText('统计备注')).toHaveValue('备注 B')
  expect(screen.getByLabelText('点赞数')).toHaveTextContent('2')

  // 可见性再次反转。
  expect(
    window.getComputedStyle(screen.getByTestId('notes-panel')).display,
  ).not.toBe('none')
  expect(
    window.getComputedStyle(screen.getByTestId('stats-panel')).display,
  ).toBe('none')
})
