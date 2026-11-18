// 参考答案：Error Boundary + Suspense
//
// 两点容易忽略：
// 1. 错误边界必须是 class 组件（getDerivedStateFromError），函数组件没有等价 API。
// 2. promise 必须在“不会挂起”的父组件中创建，并把它作为 prop 传下去。
//    如果把 loadProfile() 放在挂起组件内部（例如 useState 初始化器），React 的
//    Suspense 重放会再次执行它，导致重复请求、promise 引用变化。
//    这里由 ProfilePanel 用 useState 惰性初始化创建；错误边界重试时生成新 promise。

import { Component, Suspense, use, useState, type ReactNode } from 'react'

export type User = { id: string; name: string }

type LoadProfile = () => Promise<User>

async function defaultLoadProfile(): Promise<User> {
  return { id: 'u1', name: 'Ada Lovelace' }
}

type BoundaryProps = { children: ReactNode; onRetry: () => void }
type BoundaryState = { error: Error | null }

class ProfileErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  handleRetry = () => {
    this.setState({ error: null })
    this.props.onRetry()
  }

  render() {
    if (this.state.error !== null) {
      return (
        <div role="alert">
          <p>加载失败，请重试</p>
          <button type="button" onClick={this.handleRetry}>
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function ProfileContent({ promise }: { promise: Promise<User> }) {
  const user = use(promise)

  return (
    <article aria-label="用户资料">
      <h2>{user.name}</h2>
      <p>{user.id}</p>
    </article>
  )
}

export default function ProfilePanel({ loadProfile = defaultLoadProfile }: { loadProfile?: LoadProfile }) {
  const [promise, setPromise] = useState(() => loadProfile())

  return (
    <section aria-label="用户面板">
      <ProfileErrorBoundary onRetry={() => setPromise(loadProfile())}>
        <Suspense fallback={<p role="status">加载中…</p>}>
          <ProfileContent promise={promise} />
        </Suspense>
      </ProfileErrorBoundary>
    </section>
  )
}
