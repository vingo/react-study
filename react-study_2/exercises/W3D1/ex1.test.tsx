import { fireEvent, render, screen } from '@testing-library/react'
import { TaskQueue } from './ex1'

function openNote(title: string, note: string) {
  fireEvent.click(screen.getByRole('button', { name: `展开 ${title}` }))
  fireEvent.change(screen.getByLabelText(`备注 ${title}`), {
    target: { value: note },
  })
}

test('置顶任务后，展开状态与草稿跟着任务走，而不是留在原来的行号', () => {
  render(<TaskQueue />)

  openNote('实现列表', '等接口字段确认后再写')
  fireEvent.click(screen.getByRole('button', { name: '置顶 实现列表' }))

  expect(
    screen.getByRole('button', { name: '收起 实现列表' }),
  ).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByLabelText('备注 实现列表')).toHaveValue(
    '等接口字段确认后再写',
  )

  // 被挤到第 2 行的“设计接口”没有被展开过，不应该继承上面的状态。
  expect(
    screen.queryByRole('button', { name: '收起 设计接口' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('备注 设计接口')).not.toBeInTheDocument()
})

test('删除前一项后，展开状态与草稿仍属于原来的任务', () => {
  render(<TaskQueue />)

  openNote('实现列表', '只属于实现列表的草稿')
  fireEvent.click(screen.getByRole('button', { name: '删除 设计接口' }))

  expect(screen.queryByText('设计接口')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: '收起 实现列表' }),
  ).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByLabelText('备注 实现列表')).toHaveValue(
    '只属于实现列表的草稿',
  )

  // 后面的“补充测试”向上补位，但它是另一个任务，不应该拿到草稿。
  expect(
    screen.queryByRole('button', { name: '收起 补充测试' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('备注 补充测试')).not.toBeInTheDocument()
})

test('在顶部插入新任务后，旧任务的展开状态和草稿不会被顶掉', () => {
  render(<TaskQueue />)

  openNote('实现列表', '插入新任务也不能丢')
  fireEvent.click(screen.getByRole('button', { name: '插入新任务' }))

  expect(screen.getByText('新任务 4')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: '收起 实现列表' }),
  ).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByLabelText('备注 实现列表')).toHaveValue(
    '插入新任务也不能丢',
  )

  // 新任务和“设计接口”都应该是收起状态。
  expect(
    screen.queryByRole('button', { name: '收起 新任务 4' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: '收起 设计接口' }),
  ).not.toBeInTheDocument()
})
