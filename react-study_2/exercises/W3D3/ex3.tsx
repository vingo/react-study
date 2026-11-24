// 练习 3：缓存可派生的昂贵统计，并稳定列表边界（20 分钟）
//
// 现象：
// InventoryDashboard 每次 render 都会：
// - 调用 computeInventoryStats(items, threshold) 重新聚合全部库存；
// - 调用 filterStock(items, search) 重新过滤列表；
// - 把新数组和内联 onSelect 传给 StockTable，导致表格跟着重渲染。
// 因此“展开帮助”这种完全无关的切换，也会做一遍昂贵统计和整表 render。
//
// 目标：
// - 用 useMemo 缓存统计，依赖只包含真正相关的 items / threshold；
// - 用 useMemo 缓存过滤结果，依赖 items / search；
// - 用 useCallback 稳定 onSelect，并让 StockTable 成为 memo 边界；
// - 结果必须正确：搜索、阈值、选择、添加商品都要更新对应的 UI。
//
// 测试依赖模块级计数：
// - getStatsComputationCount()：computeInventoryStats 的调用次数；
// - getFilterComputationCount()：filterStock 的调用次数；
// - getTableRenderCount()：StockTable 的 render 次数。
// 测试只数调用次数，不依赖真实耗时。不要修改测试断言。

import { memo, useCallback, useMemo, useState } from 'react'

export type StockItem = {
  id: string
  name: string
  units: number
  unitPrice: number
}

export const INITIAL_STOCK: StockItem[] = [
  { id: 'i-1', name: '机械键盘', units: 12, unitPrice: 399 },
  { id: 'i-2', name: '显示器', units: 4, unitPrice: 1299 },
  { id: 'i-3', name: '鼠标', units: 20, unitPrice: 99 },
  { id: 'i-4', name: '耳机', units: 3, unitPrice: 599 },
  { id: 'i-5', name: '笔记本支架', units: 8, unitPrice: 149 },
  { id: 'i-6', name: '摄像头', units: 2, unitPrice: 349 },
]

export type InventoryStats = {
  totalUnits: number
  lowStockCount: number
  totalValue: number
}

let statsComputations = 0
let filterComputations = 0
let tableRenders = 0

// 纯聚合函数。真实项目里可能是多轮 O(n) / O(n²) 统计；
// 测试只统计调用次数，不测真实耗时。
export function computeInventoryStats(
  items: StockItem[],
  threshold: number,
): InventoryStats {
  statsComputations += 1

  let totalUnits = 0
  let lowStockCount = 0
  let totalValue = 0
  for (const item of items) {
    totalUnits += item.units
    totalValue += item.units * item.unitPrice
    if (item.units < threshold) {
      lowStockCount += 1
    }
  }
  return { totalUnits, lowStockCount, totalValue }
}

export function filterStock(items: StockItem[], search: string): StockItem[] {
  filterComputations += 1

  const keyword = search.trim().toLowerCase()
  if (keyword === '') {
    return items
  }
  return items.filter((item) => item.name.toLowerCase().includes(keyword))
}

export function getStatsComputationCount(): number {
  return statsComputations
}

export function getFilterComputationCount(): number {
  return filterComputations
}

export function getTableRenderCount(): number {
  return tableRenders
}

export function resetDashboardCounters(): void {
  statsComputations = 0
  filterComputations = 0
  tableRenders = 0
}

type StockTableProps = {
  rows: StockItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const StockTable = memo(function StockTable({ rows, selectedId, onSelect }: StockTableProps) {
  tableRenders += 1

  return (
    <table aria-label="库存明细">
      <tbody>
        {rows.map((item) => (
          <tr
            key={item.id}
            data-selected={selectedId === item.id ? 'true' : 'false'}
          >
            <td>{item.name}</td>
            <td>{item.units}</td>
            <td>¥{item.unitPrice}</td>
            <td>
              <button type="button" onClick={() => onSelect(item.id)}>
                选择 {item.name}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
})

export default function InventoryDashboard() {
  const [items, setItems] = useState<StockItem[]>(INITIAL_STOCK)
  const [threshold, setThreshold] = useState(5)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  // BUG：每次 render 都重新聚合、重新过滤。
  const stats = useMemo(()=> {
    return computeInventoryStats(items, threshold)
  }, [items, threshold]) 
  const rows = useMemo(()=> { return filterStock(items, search) },[items, search])

  function addItem() {
    setItems((current) => [
      ...current,
      {
        id: `i-${current.length + 1}`,
        name: `新增商品 ${current.length + 1}`,
        units: 2,
        unitPrice: 100,
      },
    ])
  }

  const onSelect = useCallback((id: string) => {
      setSelectedId(id)
  },[])

  return (
    <section aria-label="库存看板">
      <header>
        <h1>库存看板</h1>
        <button type="button" onClick={() => setHelpOpen((value) => !value)}>
          帮助
        </button>
      </header>

      {helpOpen && <p role="note">低于阈值的商品需要补货。</p>}

      <label>
        低库存阈值
        <input
          aria-label="低库存阈值"
          type="number"
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </label>

      <label>
        搜索
        <input
          aria-label="搜索库存"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <section aria-label="库存统计">
        <p>总库存：{stats.totalUnits}</p>
        <p>低库存：{stats.lowStockCount}</p>
        <p>总价值：¥{stats.totalValue}</p>
      </section>

      <p>当前选中：{selectedId ?? '无'}</p>

      {/* BUG：新数组 + 内联回调 + 未 memo 的表格，父组件任何更新都会重渲染。 */}
      <StockTable
        rows={rows}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      <button type="button" onClick={addItem}>
        添加商品
      </button>
    </section>
  )
}
