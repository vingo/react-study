// 练习 3：按 query 缓存 + 避免旧请求覆盖新结果（20 分钟）
//
// 现状：每次 render 都调用 search(query)，相同 query 会重复请求。
//
// 要求：
// 1. 在 getPromise 中按 query 缓存 promise：相同 query 复用同一个 promise，不重复请求。
// 2. 给 Suspense 加上 key={query}：切换 query 时重建边界，让每个 query 从自己的
//    fallback 开始，并重置结果区域的本地状态。注意：竞态安全并不依赖 key，
//    而是因为 UI 只读取“当前 query 对应的 promise”，旧请求完成时不会 setState 覆盖新结果。
// 3. query 为空时不请求，显示“输入关键词开始搜索”。
//
// 不要修改测试里的断言。

import { Suspense, use, useRef, useState, type ChangeEvent } from 'react'

export type SearchResult = { id: string; title: string }
export type SearchFn = (query: string) => Promise<SearchResult[]>

const DATA: Record<string, SearchResult[]> = {
  react: [
    { id: 'r1', title: 'React 入门' },
    { id: 'r2', title: 'React 19 新特性' },
  ],
  vue: [{ id: 'v1', title: 'Vue 3 响应式' }],
}

async function defaultSearch(query: string): Promise<SearchResult[]> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return DATA[query] ?? []
}

function Results({ promise }: { promise: Promise<SearchResult[]> }) {
  const results = use(promise)

  return (
    <ul aria-label="搜索结果">
      {results.map((result) => (
        <li key={result.id}>{result.title}</li>
      ))}
    </ul>
  )
}

export default function SearchPanel({ search = defaultSearch }: { search?: SearchFn }) {
  const [query, setQuery] = useState('')
  const cacheRef = useRef(new Map<string, Promise<SearchResult[]>>())

  function getPromise(searchQuery: string): Promise<SearchResult[]> {
    // TODO 1：先查 cacheRef.current；没有命中才调用 search(searchQuery)，
    // 并把 promise 写入 Map，保证相同 query 只请求一次。
    let promise = cacheRef.current.get(searchQuery)
    if (!promise) {
      promise = search(searchQuery)
      cacheRef.current.set(searchQuery, promise)
    }
    return promise
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value)
  }

  return (
    <section aria-label="搜索面板">
      <label>
        搜索
        <input value={query} onChange={handleChange} />
      </label>

      {query === '' ? (
        <p>输入关键词开始搜索</p>
      ) : (
        // TODO 2：加上 key={query}，让切换 query 时 Suspense 子树重新挂载。
        <Suspense key={query} fallback={<p role="status">搜索中…</p>}>
          <Results promise={getPromise(query)} />
        </Suspense>
      )}
    </section>
  )
}
