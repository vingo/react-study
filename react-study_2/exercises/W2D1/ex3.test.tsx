import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskBoard from './ex3'

type Task = { id: string; title: string }

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('提交后立即出现乐观项，保存成功后由真实 state 确认', async () => {
  const user = userEvent.setup()
  const deferred = createDeferred<Task>()
  const saveTask = vi.fn((_title: string) => deferred.promise)

  render(<TaskBoard saveTask={saveTask} />)
  expect(screen.getByText('已保存 0 个任务')).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: '新任务' }), '写周报')
  await user.click(screen.getByRole('button', { name: '添加' }))

  expect(saveTask).toHaveBeenCalledWith('写周报')
  expect(await screen.findByText('写周报')).toBeInTheDocument()
  expect(screen.getByText('已保存 0 个任务')).toBeInTheDocument()

  await act(async () => {
    deferred.resolve({ id: 'saved-1', title: '写周报' })
    await deferred.promise
  })

  expect(screen.getByText('已保存 1 个任务')).toBeInTheDocument()
  expect(screen.getAllByText('写周报')).toHaveLength(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('保存失败时乐观项回滚，并显示错误', async () => {
  const user = userEvent.setup()
  const deferred = createDeferred<Task>()
  const saveTask = vi.fn((_title: string) => deferred.promise)

  render(<TaskBoard saveTask={saveTask} />)

  await user.type(screen.getByRole('textbox', { name: '新任务' }), '写周报')
  await user.click(screen.getByRole('button', { name: '添加' }))

  expect(await screen.findByText('写周报')).toBeInTheDocument()

  const settled = deferred.promise.catch(() => {})
  await act(async () => {
    deferred.reject(new Error('网络错误'))
    await settled
  })

  expect(screen.queryByText('写周报')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('添加失败，请重试')
  expect(screen.getByText('已保存 0 个任务')).toBeInTheDocument()
})
