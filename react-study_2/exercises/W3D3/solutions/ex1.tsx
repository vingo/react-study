// 参考答案 1：memo + useMemo + useCallback
//
// - PerformanceReport 用 memo 包起来：备注输入只让父组件 render，子组件
//   在 props 浅比较相等时直接 bail out，函数不会执行，Profiler 也不会 commit；
// - options 用 useMemo 按 density 缓存，density 不变时引用稳定；
// - onSelect 用 useCallback 缓存，选中状态变化仍然通过 selectedId prop 传入；
// - 区域聚合用 useMemo 按 rows / region 缓存：切换密度或选中行只重渲染，
//   不重复做同一区域的统计。
//
// 另一种同样正确的做法是把备注输入下沉到独立组件（状态下沉），或者把
// 报表的静态部分组合成 children 以缩小 memo 边界；测试只关心可观察行为。

import { Profiler, memo, useCallback, useMemo, useState } from 'react'

export type Region = '华东' | '华南' | '华北'

export type RegionRow = {
  id: string
  region: Region
  owner: string
  amount: number
}

export const REGION_ROWS: RegionRow[] = [
  { id: 'r-1', region: '华东', owner: '陈晨', amount: 1200 },
  { id: 'r-2', region: '华东', owner: '李莉', amount: 800 },
  { id: 'r-3', region: '华南', owner: '王五', amount: 1500 },
  { id: 'r-4', region: '华南', owner: '赵六', amount: 700 },
  { id: 'r-5', region: '华北', owner: '孙七', amount: 950 },
  { id: 'r-6', region: '华北', owner: '周八', amount: 450 },
]

export type RegionSummary = {
  region: Region
  count: number
  total: number
}

let summaryComputations = 0

export function summarizeRegion(
  rows: RegionRow[],
  region: Region,
): RegionSummary {
  summaryComputations += 1

  let count = 0
  let total = 0
  for (const row of rows) {
    if (row.region === region) {
      count += 1
      total += row.amount
    }
  }
  return { region, count, total }
}

export type Density = 'compact' | 'comfortable'

export type ReportRender = {
  region: Region
  total: number
  selectedId: string | null
  density: Density
}

const renderLog: ReportRender[] = []
let reportRenders = 0
let profilerCommits = 0

export function getReportRenderCount(): number {
  return reportRenders
}

export function getReportProfilerCommits(): number {
  return profilerCommits
}

export function getReportRenderLog(): ReportRender[] {
  return renderLog
}

export function getSummaryComputationCount(): number {
  return summaryComputations
}

export function resetPerformanceLogs(): void {
  renderLog.length = 0
  reportRenders = 0
  profilerCommits = 0
  summaryComputations = 0
}

function recordReportCommit(): void {
  profilerCommits += 1
}

type ReportProps = {
  rows: RegionRow[]
  region: Region
  options: { density: Density }
  selectedId: string | null
  onSelect: (id: string) => void
}

const PerformanceReport = memo(function PerformanceReport({
  rows,
  region,
  options,
  selectedId,
  onSelect,
}: ReportProps) {
  const summary = useMemo(
    () => summarizeRegion(rows, region),
    [rows, region],
  )
  const visibleRows = useMemo(
    () => rows.filter((row) => row.region === region),
    [rows, region],
  )

  reportRenders += 1
  renderLog.push({
    region,
    total: summary.total,
    selectedId,
    density: options.density,
  })

  return (
    <Profiler id="performance-report" onRender={recordReportCommit}>
      <section
        aria-label="区域业绩报表"
        data-region={region}
        data-density={options.density}
      >
        <p aria-label="区域汇总">
          共 {summary.count} 条，合计 ¥{summary.total}
        </p>
        <ul aria-label="区域业绩明细">
          {visibleRows.map((row) => (
            <li
              key={row.id}
              data-selected={selectedId === row.id ? 'true' : 'false'}
            >
              <span>
                {row.owner}：¥{row.amount}
              </span>
              <button type="button" onClick={() => onSelect(row.id)}>
                选择 {row.owner}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </Profiler>
  )
})

export default function SalesDashboard() {
  const [region, setRegion] = useState<Region>('华东')
  const [density, setDensity] = useState<Density>('compact')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const options = useMemo(() => ({ density }), [density])
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  return (
    <section aria-label="销售看板">
      <label>
        区域
        <select
          aria-label="区域"
          value={region}
          onChange={(event) => setRegion(event.target.value as Region)}
        >
          <option value="华东">华东</option>
          <option value="华南">华南</option>
          <option value="华北">华北</option>
        </select>
      </label>

      <label>
        备注
        <input
          aria-label="备注"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <p>备注预览：{note || '（空）'}</p>

      <label>
        <input
          type="checkbox"
          aria-label="紧凑模式"
          checked={density === 'compact'}
          onChange={(event) =>
            setDensity(event.target.checked ? 'compact' : 'comfortable')
          }
        />
        紧凑模式
      </label>

      <p>当前选中：{selectedId ?? '无'}</p>

      <PerformanceReport
        rows={REGION_ROWS}
        region={region}
        options={options}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
    </section>
  )
}
