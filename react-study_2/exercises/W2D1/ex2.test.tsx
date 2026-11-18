import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommentForm from './ex2'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('保存完成前按钮显示提交中…并禁用，完成后恢复', async () => {
  const user = userEvent.setup()
  const deferred = createDeferred<void>()
  const saveComment = vi.fn(() => deferred.promise)

  render(<CommentForm saveComment={saveComment} />)

  expect(screen.getByRole('button', { name: '提交' })).toBeEnabled()

  await user.type(screen.getByRole('textbox', { name: '留言' }), '你好')
  await user.click(screen.getByRole('button', { name: '提交' }))

  expect(saveComment).toHaveBeenCalledWith('你好')
  const pendingButton = await screen.findByRole('button', { name: '提交中…' })
  expect(pendingButton).toBeDisabled()

  await act(async () => {
    deferred.resolve()
    await deferred.promise
  })

  expect(await screen.findByRole('button', { name: '提交' })).toBeEnabled()
})

test('一次保存完成后，第二次提交同样会显示 pending', async () => {
  const user = userEvent.setup()
  const first = createDeferred<void>()
  const second = createDeferred<void>()
  let callCount = 0
  const saveComment = vi.fn(async (_text: string) => {
    const deferred = callCount++ === 0 ? first : second
    await deferred.promise
  })

  render(<CommentForm saveComment={saveComment} />)
  const input = screen.getByRole('textbox', { name: '留言' })

  await user.type(input, '第一条')
  await user.click(screen.getByRole('button', { name: '提交' }))
  expect(await screen.findByRole('button', { name: '提交中…' })).toBeDisabled()

  await act(async () => {
    first.resolve()
    await first.promise
  })
  expect(await screen.findByRole('button', { name: '提交' })).toBeEnabled()

  await user.type(input, '第二条')
  await user.click(screen.getByRole('button', { name: '提交' }))
  expect(await screen.findByRole('button', { name: '提交中…' })).toBeDisabled()

  await act(async () => {
    second.resolve()
    await second.promise
  })
  expect(await screen.findByRole('button', { name: '提交' })).toBeEnabled()
})
