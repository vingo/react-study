// 练习 2：给 Suspense 补上 Error Boundary（15 分钟）
//
// 现状：只有 Suspense。loadProfile() reject 时，React 找不到错误边界，会卸载整棵树，
// 页面上没有任何错误 UI，测试也等不到可操作的“重试”按钮。
//
// 要求：新增一个 class 错误边界组件，包住 Suspense：
// - pending 时仍显示 role="status" 的“加载中…”；
// - reject 后显示 role="alert" 的“加载失败，请重试”和“重试”按钮；
// - 点击“重试”后清除错误，并调用 onRetry，让 ProfilePanel 生成新的 promise；
// - 重试再次失败时仍显示错误 UI，而不是崩溃。
//
// 不要修改测试里的断言。

import { Component, ReactNode, Suspense, use, useState } from 'react'

export type User = { id: string; name: string }

type LoadProfile = () => Promise<User>

async function defaultLoadProfile(): Promise<User> {
  return { id: 'u1', name: 'Ada Lovelace' }
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

// TODO：实现 ProfileErrorBoundary（class 组件 + getDerivedStateFromError）。
// 状态里保存 error；render 时若有 error，渲染 role="alert" 的错误 UI；
// 点击“重试”时先 this.setState({ error: null })，再调用 props.onRetry()。


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

export default function ProfilePanel({ loadProfile = defaultLoadProfile }: { loadProfile?: LoadProfile }) {
  // 惰性初始化只执行一次；promise 在不会挂起的父组件中创建，
  // 因此 Suspense 重试不会重复调用 loadProfile。
  const [promise, setPromise] = useState(() => loadProfile())

  return (
    <section aria-label="用户面板">
      {/* TODO：用 ProfileErrorBoundary 包住 Suspense，
          并把 onRetry={() => setPromise(loadProfile())} 传给它。 */}
      <ProfileErrorBoundary onRetry={() => setPromise(loadProfile())}>
      <Suspense fallback={<p role="status">加载中…</p>}>
        <ProfileContent promise={promise} />
      </Suspense>
      </ProfileErrorBoundary>
    </section>
  )
}
