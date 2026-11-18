import { screen, waitFor } from '@testing-library/react'
import UserCard, { type User } from './ex1'
import { renderWithQueryClient } from './test-utils'

function createFetchUser() {
  return vi.fn(
    async (id: string): Promise<User> => {
      console.log('>>>>>>test', id)
      return {
        id,
        name: id === 'u1' ? 'Ada Lovelace' : 'Grace Hopper',
      }

    },
  )
}

test('首次加载显示请求到的用户', async () => {
  const fetchUser = createFetchUser()

  renderWithQueryClient(<UserCard userId="u1" fetchUser={fetchUser} />)

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
  expect(screen.getByText('用户 ID：u1')).toBeInTheDocument()
  expect(fetchUser).toHaveBeenCalledTimes(1)
  expect(fetchUser).toHaveBeenCalledWith('u1')
})

test('切换 userId 后请求新用户并显示新数据，不再显示旧用户', async () => {
  const fetchUser = createFetchUser()
  const view = renderWithQueryClient(<UserCard userId="u1" fetchUser={fetchUser} />)

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

  view.rerender(<UserCard userId="u2" fetchUser={fetchUser} />)

  expect(await screen.findByText('Grace Hopper')).toBeInTheDocument()
  expect(screen.getByText('用户 ID：u2')).toBeInTheDocument()
  expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  expect(fetchUser).toHaveBeenCalledTimes(2)
  expect(fetchUser).toHaveBeenLastCalledWith('u2')
})

test('相同 userId 重新渲染不会重复请求', async () => {
  const fetchUser = createFetchUser()
  const view = renderWithQueryClient(<UserCard userId="u1" fetchUser={fetchUser} />)

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

  view.rerender(<UserCard userId="u1" fetchUser={fetchUser} />)

  await waitFor(() => expect(fetchUser).toHaveBeenCalledTimes(1))
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  expect(fetchUser).toHaveBeenCalledWith('u1')
})
