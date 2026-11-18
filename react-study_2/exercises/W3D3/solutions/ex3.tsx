// 参考答案 3：useMemo / useCallback + memo 表格边界
//
// - stats 只依赖 items / threshold：搜索、展开帮助、选中行都不会重算；
// - rows 只依赖 items / search：改阈值不会重新过滤；
// - StockTable 用 memo 包起来，rows 在无关更新中保持同一引用；
// - onSelect 用 useCallback 稳定，选中时只有 selectedId 变化会进入表格；
// - 表格单独成组件，使父组件的帮助面板、统计等状态变化不再触碰行渲染。
//
// 如果以后开启 React Compiler，这类组件内的 useMemo / useCallback 大多会
// 由编译器自动生成；但“哪些数据该放哪一层、派生值依赖什么”仍需你自己
// 设计正确，测试所验证的数据流不会因为编译器而消失。

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

const StockTable = memo(function StockTable({
  rows,
  selectedId,
  onSelect,
}: StockTableProps) {
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

  const stats = useMemo(
    () => computeInventoryStats(items, threshold),
    [items, threshold],
  )
  const rows = useMemo(() => filterStock(items, search), [items, search])
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

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

      <StockTable
        rows={rows}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      <button type="button" onClick={addItem}>
        添加商品
      </button>
    </section>
  )
}
