import { act, fireEvent, render, screen } from '@testing-library/react'
import SearchPanel, { type SearchResult } from './ex3'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const reactResults: SearchResult[] = [{ id: 'r1', title: 'React 入门' }]
const vueResults: SearchResult[] = [{ id: 'v1', title: 'Vue 3 响应式' }]

async function getQuery(input: HTMLElement, query: string) {
  // 切换 query 会让 Suspense 子树挂起，用异步 act 包住才能正确 flush。
  await act(async () => {
    fireEvent.change(input, { target: { value: query } })
  })
}

test('输入 query 时显示加载状态，resolve 后显示结果且只请求一次', async () => {
  const react = createDeferred<SearchResult[]>()
  const search = vi.fn((query: string) => {
    if (query === 'react') return react.promise
    throw new Error(`未预期的 query: ${query}`)
  })

  render(<SearchPanel search={search} />)
  await getQuery(screen.getByRole('textbox', { name: '搜索' }), 'react')

  expect(screen.getByRole('status')).toHaveTextContent('搜索中…')

  await act(async () => {
    react.resolve(reactResults)
    await react.promise
  })

  expect(await screen.findByText('React 入门')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(search).toHaveBeenCalledTimes(1)
  expect(search).toHaveBeenCalledWith('react')
})

test('旧 query 晚 resolve 不会覆盖新 query 的结果', async () => {
  const react = createDeferred<SearchResult[]>()
  const vue = createDeferred<SearchResult[]>()
  const search = vi.fn((query: string) => (query === 'react' ? react.promise : vue.promise))

  render(<SearchPanel search={search} />)
  const input = screen.getByRole('textbox', { name: '搜索' })

  await getQuery(input, 'react')
  expect(screen.getByRole('status')).toHaveTextContent('搜索中…')

  await getQuery(input, 'vue')
  expect(screen.getByRole('status')).toHaveTextContent('搜索中…')

  // react 的请求晚于切换才 resolve。
  await act(async () => {
    react.resolve(reactResults)
    await react.promise
  })

  expect(screen.queryByText('React 入门')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('搜索中…')

  await act(async () => {
    vue.resolve(vueResults)
    await vue.promise
  })

  expect(await screen.findByText('Vue 3 响应式')).toBeInTheDocument()
  expect(screen.queryByText('React 入门')).not.toBeInTheDocument()
  expect(search.mock.calls.filter(([query]) => query === 'vue')).toHaveLength(1)
})

test('切换回相同 query 时复用缓存，不重复请求', async () => {
  const react = createDeferred<SearchResult[]>()
  const vue = createDeferred<SearchResult[]>()
  const search = vi.fn((query: string) => (query === 'react' ? react.promise : vue.promise))

  render(<SearchPanel search={search} />)
  const input = screen.getByRole('textbox', { name: '搜索' })

  await getQuery(input, 'react')
  await act(async () => {
    react.resolve(reactResults)
    await react.promise
  })
  expect(await screen.findByText('React 入门')).toBeInTheDocument()

  await getQuery(input, 'vue')
  await act(async () => {
    vue.resolve(vueResults)
    await vue.promise
  })
  expect(await screen.findByText('Vue 3 响应式')).toBeInTheDocument()

  await getQuery(input, 'react')
  expect(await screen.findByText('React 入门')).toBeInTheDocument()
  expect(screen.queryByText('Vue 3 响应式')).not.toBeInTheDocument()

  expect(search.mock.calls.filter(([query]) => query === 'react')).toHaveLength(1)
  expect(search.mock.calls.filter(([query]) => query === 'vue')).toHaveLength(1)
})
