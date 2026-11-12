import { Profiler } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NameForm from './ex1'

test('fullName 在 render 中由两个输入值派生，不因同步 Effect 产生额外 commit', async () => {
  const user = userEvent.setup()
  const phases: string[] = []
  render(
    <Profiler id="name-form" onRender={(_id, phase) => phases.push(phase)}>
      <NameForm />
    </Profiler>,
  )

  // 初始 fullName 应在首次 render 得到，而不是 Effect setState 后再提交一次。
  expect(phases).toEqual(['mount'])

  await user.clear(screen.getByLabelText('名'))
  await user.type(screen.getByLabelText('名'), 'Grace')
  expect(screen.getByText('全名：Grace Lovelace')).toBeInTheDocument()
})
