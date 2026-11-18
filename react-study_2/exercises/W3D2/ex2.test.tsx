import { act, fireEvent, render, screen } from '@testing-library/react'
import TransitionTabs, {
  getTabLoadCount,
  resetTabLoads,
  resolveTabLoad,
} from './ex2'

beforeEach(() => {
  resetTabLoads()
})

test('切换期间保留旧内容并显示 pending，加载完成后显示新内容', async () => {
  render(<TransitionTabs />)

  expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByLabelText('标签页内容')).toHaveAttribute(
    'data-tab',
    'overview',
  )

  fireEvent.click(screen.getByRole('tab', { name: '动态' }))

  // pending 提示出现；旧内容还在；旧 tab 仍是选中状态。
  expect(screen.queryByRole('status')).not.toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('切换中…')
  expect(screen.getByLabelText('标签页内容')).toHaveAttribute(
    'data-tab',
    'overview',
  )
  expect(screen.getByLabelText('标签页内容')).toHaveTextContent('概览内容')
  expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByRole('tab', { name: '动态' })).toHaveAttribute(
    'aria-selected',
    'false',
  )
  expect(getTabLoadCount()).toBe(1)

  await act(async () => {
    resolveTabLoad('activity')
  })

  // 完成后：新内容、新 tab 选中、pending 消失。
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByLabelText('标签页内容')).toHaveAttribute(
    'data-tab',
    'activity',
  )
  expect(screen.getByLabelText('标签页内容')).toHaveTextContent('动态内容')
  expect(screen.getByRole('tab', { name: '动态' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('pending 期间紧急输入不被阻塞，完成后输入值保留', async () => {
  render(<TransitionTabs />)

  fireEvent.click(screen.getByRole('tab', { name: '动态' }))

  const filter = screen.getByLabelText('过滤内容')
  fireEvent.change(filter, { target: { value: 'keyword' } })

  // 输入立即生效，同时 transition 还处于 pending。
  expect(filter).toHaveValue('keyword')
  expect(screen.queryByRole('status')).not.toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('切换中…')
  expect(screen.getByLabelText('标签页内容')).toHaveAttribute(
    'data-tab',
    'overview',
  )

  await act(async () => {
    resolveTabLoad('activity')
  })

  expect(filter).toHaveValue('keyword')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByLabelText('标签页内容')).toHaveAttribute(
    'data-tab',
    'activity',
  )
})
