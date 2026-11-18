// 参考答案 1：useDeferredValue + useMemo
//
// 输入框的 query 保持紧急更新；列表读取 deferredQuery。
// 一次输入会产生两次 render：
// 1. 紧急 render：query 已是新值，deferredQuery 仍是旧值（列表保留旧结果）；
// 2. 后台 render：deferredQuery 追上 query，列表更新。
// useMemo 让第 1 次 render 直接复用旧列表，不重复过滤。

import { useDeferredValue, useMemo, useState } from 'react'

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
  const deferredQuery = useDeferredValue(query)
  const products = useMemo(
    () => filterProducts(deferredQuery),
    [deferredQuery],
  )

  renderLog.push({ query, listQuery: deferredQuery, count: products.length })

  const isStale = query !== deferredQuery

  return (
    <section
      aria-label="商品列表"
      data-list-query={deferredQuery}
      data-stale={isStale ? 'true' : 'false'}
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
