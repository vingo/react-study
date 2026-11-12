import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileForm from './ex3'

test('切换主题后，已填写的内容不丢失', async () => {
  const user = userEvent.setup()
  render(<ProfileForm />)
  await user.type(screen.getByLabelText('昵称'), '小明')
  await user.click(screen.getByRole('button', { name: '切换主题' }))
  expect(screen.getByRole('region', { name: '资料表单' })).toHaveClass('dark')
  expect(screen.getByLabelText('昵称')).toHaveValue('小明')
})

test('紧凑模式可以开启和关闭，且与主题互不影响', async () => {
  const user = userEvent.setup()
  render(<ProfileForm />)
  const form = screen.getByRole('region', { name: '资料表单' })
  await user.type(screen.getByLabelText('城市'), '杭州')

  await user.click(screen.getByRole('button', { name: '紧凑模式' }))
  expect(form).toHaveClass('light', 'compact')
  expect(screen.getByLabelText('城市')).toHaveValue('杭州')

  await user.click(screen.getByRole('button', { name: '紧凑模式' }))
  expect(form).not.toHaveClass('compact')
  expect(screen.getByLabelText('城市')).toHaveValue('杭州')
})
