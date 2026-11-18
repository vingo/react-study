// W2D3 测试工具（不需要修改）
//
// 每个练习的测试都用这里创建全新的 QueryClient，避免缓存跨用例泄漏：
// - retry: false      失败立即进入 error 状态，测试不必等待重试
// - gcTime: 0         查询卸载后立刻回收，不留跨用例的缓存/定时器
// - refetchOnWindowFocus: false  避免 jsdom 的 focus 事件造成额外请求
//
// createDeferred 用来把“请求何时完成”交给测试控制，从而断言 pending、
// 乐观更新和失败回滚这些时序敏感的行为。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

/**
 * 渲染 UI，并用一个全新的 QueryClientProvider 包裹。
 * 需要手动操作同一个 client 时，可以从返回值里取 `client`。
 */
export function renderWithQueryClient(
  ui: ReactElement,
  client: QueryClient = createTestQueryClient(),
) {
  return {
    client,
    ...render(ui, { wrapper: createWrapper(client) }),
  }
}

/** 可在测试中手动 resolve / reject 的 promise。 */
export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
