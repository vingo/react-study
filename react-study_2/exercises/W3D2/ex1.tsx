// 练习 1：修复高开销筛选阻塞输入的问题（15 分钟）
//
// 现象：
// 输入框每次 change 都同步更新 query，并在同一次 render 中重新过滤整个商品
// 列表。列表越大，输入就越卡；每个字符都会让输入和列表同时重算。
//
// 目标：让输入更新保持“紧急”，列表过滤变成可中断的“后台”更新。
// 推荐使用 useDeferredValue（也可以用 useTransition，只要行为一致）。
// 不要修改测试里的断言。
//
// 可观察契约（测试依赖）：
// - filterProducts(query) 返回过滤后的商品数组；
// - ProductList 每次 render 把 { query, listQuery, count } 追加到 renderLog：
//   query 是输入框的最新值，listQuery 是本次列表实际使用的值；
// - 最终 DOM 里的列表必须与当前 query 一致，不能出现两者错位的结果。

import { useState } from 'react'

export type Product = { id: string; name: string }

const CATEGORIES = ['Phone', 'Laptop', 'Headphones', 'Keyboard']

export const PRODUCTS: Product[] = Array.from({ length: 80 }, (_, index) => {
  const category = CATEGORIES[index % CATEGORIES.length]
  const number = String(index + 1).padStart(2, '0')
  return { id: `p-${number}`, name: `${category} ${number}` }
})

export function filterProducts(query: string): Product[] {
  const keyword = query.trim().toLowerCase()
  if (keyword === '') {
    return PRODUCTS
  }
  return PRODUCTS.filter((product) =>
    product.name.toLowerCase().includes(keyword),
  )
}

export type ListRender = {
  query: string
  listQuery: string
  count: number
}

const renderLog: ListRender[] = []

export function getListRenderLog(): ListRender[] {
  return renderLog
}

export function resetListRenderLog(): void {
  renderLog.length = 0
}

function ProductList({ query }: { query: string }) {
  // BUG：列表直接使用 query 同步过滤。输入与列表在同一次 render 中完成，
  // 列表越大，输入框越卡。
  const listQuery = query
  const products = filterProducts(listQuery)

  renderLog.push({ query, listQuery, count: products.length })

  return (
    <section
      aria-label="商品列表"
      data-list-query={listQuery}
      data-stale={query === listQuery ? 'false' : 'true'}
    >
      <p role="status">{products.length} 件商品</p>
      <ul>
        {products.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </section>
  )
}

export default function ProductSearch() {
  const [query, setQuery] = useState('')

  return (
    <div>
      <label>
        搜索
        <input
          aria-label="搜索商品"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ProductList query={query} />
    </div>
  )
}
