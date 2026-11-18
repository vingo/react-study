// 参考答案：按参数缓存 promise
//
// 关键点：cache 的 key 是参数（userId），而不是组件或调用位置。
// 同一个 key 在 promise 生命周期内始终返回同一个 promise，因此：
// - Suspense 重试时 use() 读到的是已经 fulfilled 的同一个 promise；
// - 父组件重新渲染时不会再次发起请求。

import { Suspense, use } from 'react'

export type User = { id: string; name: string }

const USERS: Record<string, User> = {
  u1: { id: 'u1', name: 'Ada Lovelace' },
  u2: { id: 'u2', name: 'Grace Hopper' },
}

let fetchCallCount = 0
const pendingResolvers: Array<() => void> = []
const MAX_SAFE_CALLS = 20

const userCache = new Map<string, Promise<User>>()

export function resetFetchCallCount() {
  fetchCallCount = 0
  pendingResolvers.length = 0
}

export function getFetchCallCount() {
  return fetchCallCount
}

export function resolvePendingFetches() {
  const resolvers = pendingResolvers.splice(0)
  for (const resolve of resolvers) {
    resolve()
  }
}

export function resetUserCache() {
  userCache.clear()
}

export function fetchUser(id: string): Promise<User> {
  fetchCallCount += 1

  if (fetchCallCount > MAX_SAFE_CALLS) {
    return new Promise<User>(() => {})
  }

  return new Promise<User>((resolve) => {
    pendingResolvers.push(() => {
      resolve(USERS[id] ?? { id, name: `用户 ${id}` })
    })
  })
}

function getUser(id: string): Promise<User> {
  let promise = userCache.get(id)
  if (promise === undefined) {
    promise = fetchUser(id)
    userCache.set(id, promise)
  }
  return promise
}

function Profile({ userId }: { userId: string }) {
  const user = use(getUser(userId))

  return (
    <article aria-label="用户资料">
      <h2>{user.name}</h2>
      <p>{user.id}</p>
    </article>
  )
}

export default function ProfileCard({ userId }: { userId: string }) {
  return (
    <section aria-label="用户卡片">
      <Suspense key={userId} fallback={<p role="status">加载中…</p>}>
        <Profile userId={userId} />
      </Suspense>
    </section>
  )
}
