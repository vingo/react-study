// 参考答案：按 query 缓存 + 用 key 重置 Suspense 边界
//
// 为什么要 key：key 变化会让 Suspense 边界和 Results 子树重新挂载，
// 每个 query 从自己的 fallback 开始，结果区域的本地状态也不会串到下一个 query。
// 竞态安全不是靠 key：UI 只读取当前 query 对应的缓存 promise，旧 promise 完成
// 不会触发 setState 覆盖新结果。key 更多是“切换身份 / 重置边界”的语义。
//
// 为什么缓存放在 SearchPanel：cacheRef 在 Suspense 边界之外，
// key 变化只会重置 Results，不会清掉缓存。

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
    const cached = cacheRef.current.get(searchQuery)
    if (cached !== undefined) {
      return cached
    }

    const promise = search(searchQuery)
    cacheRef.current.set(searchQuery, promise)
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
        <Suspense key={query} fallback={<p role="status">搜索中…</p>}>
          <Results promise={getPromise(query)} />
        </Suspense>
      )}
    </section>
  )
}
