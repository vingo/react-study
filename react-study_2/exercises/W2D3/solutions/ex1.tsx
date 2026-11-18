// 参考答案 1：queryKey 必须包含所有影响结果的参数
//
// ['user', userId] 让每个用户拥有独立的缓存条目：
// - 切换 userId → queryHash 变化 → 新条目、新请求；
// - 切回已经缓存过的用户 → 命中对应条目（在 gcTime 内）；
// - 相同 userId 重新渲染 → key 不变，不会无谓重复请求。

import { useQuery } from '@tanstack/react-query'

export type User = { id: string; name: string }

export type UserFetcher = (id: string) => Promise<User>

const USERS: Record<string, User> = {
  u1: { id: 'u1', name: 'Ada Lovelace' },
  u2: { id: 'u2', name: 'Grace Hopper' },
}

export async function defaultFetchUser(id: string): Promise<User> {
  return USERS[id] ?? { id, name: `用户 ${id}` }
}

type UserCardProps = {
  userId: string
  fetchUser?: UserFetcher
}

export default function UserCard({ userId, fetchUser = defaultFetchUser }: UserCardProps) {
  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })

  if (userQuery.isPending) {
    return <p role="status">加载中…</p>
  }

  if (userQuery.isError) {
    return <p role="alert">加载失败：{userQuery.error.message}</p>
  }

  return (
    <article aria-label="用户卡片">
      <h2>{userQuery.data.name}</h2>
      <p>用户 ID：{userQuery.data.id}</p>
    </article>
  )
}
