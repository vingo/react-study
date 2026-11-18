// 练习 1：修复 Query Key 不完整导致的“换人后仍显示旧数据”（15 分钟）
//
// 现象：
// 1. 首次用 userId="u1" 渲染，能正确显示 u1。
// 2. 把 userId 改成 "u2" 后，组件仍然显示 u1 的数据，也不会为 u2 发起请求。
//
// 原因：queryKey 只有 ['user']，两个用户共用同一个缓存条目；TanStack Query
// 认为“查询没有变化”，不会重新执行 queryFn。queryFn 闭包里的 userId 虽然变了，
// 但 Query 并不知道。
//
// 要求：只修改 useQuery 的配置，让 queryKey 能唯一标识“哪个用户”。
// 不要修改测试里的断言，也不要改 fetchUser 的签名。
//
// 提示：queryKey 是一个可序列化的数组，数组里所有会影响结果的参数都要放进去。
// 参数顺序和每一段值都会参与 hash；userId 不同 → key 不同 → 独立缓存、独立请求。

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
    // BUG：key 没有包含 userId，切换用户时仍然命中同一个缓存。
    queryKey: ['user', {userId}],
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
