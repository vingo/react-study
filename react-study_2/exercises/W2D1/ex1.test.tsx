import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskForm from './ex1'

test('空标题提交时显示错误，且不添加任务', async () => {
  const user = userEvent.setup()
  render(<TaskForm />)

  await user.click(screen.getByRole('button', { name: '添加任务' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('请输入任务标题')
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

test('提交有效标题后出现新任务，并清空输入框', async () => {
  const user = userEvent.setup()
  render(<TaskForm />)

  const input = screen.getByRole('textbox', { name: '任务标题' })
  await user.type(input, '买牛奶')
  await user.click(screen.getByRole('button', { name: '添加任务' }))

  expect(await screen.findByText('买牛奶')).toBeInTheDocument()
  expect(input).toHaveValue('')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('连续提交两个任务时，两次结果都会保留', async () => {
  const user = userEvent.setup()
  render(<TaskForm />)

  const input = screen.getByRole('textbox', { name: '任务标题' })

  await user.type(input, '任务一')
  await user.click(screen.getByRole('button', { name: '添加任务' }))
  expect(await screen.findByText('任务一')).toBeInTheDocument()

  await user.type(input, '任务二')
  await user.click(screen.getByRole('button', { name: '添加任务' }))
  expect(await screen.findByText('任务二')).toBeInTheDocument()

  expect(screen.getByText('任务一')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})
