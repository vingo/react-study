// 练习 1：让昂贵的报表只在相关数据变化时重渲染（15 分钟）
//
// 现象：
// 看板父组件里既有“区域 / 密度 / 选中行”这类与报表相关的状态，也有“备注”
// 这种与报表无关的状态。每次输入备注，父组件都会重新 render，并把内联的
// options 对象和 onSelect 函数重新创建，于是整张报表（以及区域聚合）跟着
// 重算一遍。真实数据量大时，输入一个字都会卡。
//
// 目标：
// - 无关状态（备注）变化时，PerformanceReport 不重新 render，也不重复聚合；
// - 相关变化仍然正确更新：
//   * 切换区域：重新聚合并刷新 DOM；
//   * 切换密度：只重渲染报表（外观变了），不重复聚合同一区域的数据；
//   * 点击“选择”：更新选中行，同样不重复聚合。
//
// 测试依赖：
// - PerformanceReport 每次 render 会写入 renderLog，并包在 <Profiler> 里，
//   onRender 计入 commits；请保留 Profiler；
// - summarizeRegion 每次调用都会计数（测试只数调用次数，不依赖真实耗时）。
//
// 可用手段（至少一种，可组合）：memo、useMemo、useCallback、状态下沉/组合。
// 不要修改测试断言。

import { Profiler, useState } from 'react'

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

// 纯聚合函数。真实项目里可能是 O(n) 甚至 O(n²) 的统计；
// 测试只统计它被调用的次数，不测真实耗时。
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

function PerformanceReport({
  rows,
  region,
  options,
  selectedId,
  onSelect,
}: ReportProps) {
  // BUG：每次 render 都重新聚合。父组件的无关状态变化会连带触发这里。
  const summary = summarizeRegion(rows, region)

  reportRenders += 1
  renderLog.push({
    region,
    total: summary.total,
    selectedId,
    density: options.density,
  })

  const visibleRows = rows.filter((row) => row.region === region)

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
}

export default function SalesDashboard() {
  const [region, setRegion] = useState<Region>('华东')
  const [density, setDensity] = useState<Density>('compact')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')

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

      {/* BUG：内联 options 与内联回调，且子组件没有 memo；父组件任何一次
          render 都会让整张报表重新执行。 */}
      <PerformanceReport
        rows={REGION_ROWS}
        region={region}
        options={{ density }}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
      />
    </section>
  )
}
