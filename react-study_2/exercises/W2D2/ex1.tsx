// 练习 1：修复 use() 的“每次渲染都新建 promise”问题（15 分钟）
//
// 现象：
// 1. 首次渲染时组件挂起，promise resolve 后重试，又在 render 里调用了一次 fetchUser。
// 2. 父组件任何一次重新渲染都会再次调用 fetchUser，同一个 userId 被重复请求。
//
// 要求：只修改 Profile（可以新增模块级缓存），让同一个 userId 在多次 render 之间
// 复用同一个 promise。不要修改测试里的断言。
//
// 提示：在 render 中创建 promise 不是稳定引用；React 会在重试时继续使用第一次
// 跟踪到的 thenable，并打印 “uncached promise” 警告。按参数把 promise 缓存起来。

import { Suspense, use } from 'react'

export type User = { id: string; name: string }

const USERS: Record<string, User> = {
  u1: { id: 'u1', name: 'Ada Lovelace' },
  u2: { id: 'u2', name: 'Grace Hopper' },
}

let fetchCallCount = 0

// 测试用来控制请求何时完成；返回的 promise 初始处于 pending。
const pendingResolvers: Array<() => void> = []

// 安全阀：错误实现可能在每次 render 都发起请求。超过上限后返回永不 resolve
// 的 promise，保证测试以断言失败结束，而不是把整个测试进程挂死。
const MAX_SAFE_CALLS = 20

export function resetFetchCallCount() {
  fetchCallCount = 0
  pendingResolvers.length = 0
}

export function getFetchCallCount() {
  return fetchCallCount
}

// 测试用：让当前所有 pending 请求 resolve。学生代码无需修改这里。
export function resolvePendingFetches() {
  const resolvers = pendingResolvers.splice(0)
  for (const resolve of resolvers) {
    resolve()
  }
}

// 预留的缓存清理钩子。若你实现了缓存，请在这里清空它，测试之间才不会互相影响。
export function resetUserCache() {
  // TODO：实现缓存后，在这里清空缓存。
  mapPromise.clear()
}

// 模拟网络请求。测试通过 getFetchCallCount 观察它被调用了多少次，
// 再调用 resolvePendingFetches 让请求完成。
export function fetchUser(id: string): Promise<User> {
  fetchCallCount += 1

  if (fetchCallCount > MAX_SAFE_CALLS) {
    return new Promise<User>(() => {})
  }
  const fetch = new Promise<User>((resolve) => {
    pendingResolvers.push(() => {
      resolve(USERS[id] ?? { id, name: `用户 ${id}` })
    })
  })
  return fetch
}

const mapPromise = new Map<string, Promise<User>>()
export function getUser(id: string): Promise<User> {
  let promise = mapPromise.get(id)
  console.log('>>111>>>',id, promise)
  if (!promise) {
    promise = fetchUser(id)
    mapPromise.set(id, promise)
  console.log('>>2222>>>',id, promise)
  }
  return promise
}

function Profile({ userId }: { userId: string }) {
  // BUG：每次 render 都会新建 promise。
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
