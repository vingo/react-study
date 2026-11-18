// 参考答案 2：稳定四个 prop，并把 children 移出 memo 边界
//
// memo 只做 props 浅比较，所以：
// - metrics 用 useMemo 按 team 缓存；
// - options 用 useMemo 缓存（这里内容恒定，依赖为空）；
// - onInspect 用 useCallback 缓存；
// - children 也是 prop：父组件每次 render 都会重新创建 <small> 元素。
//   最直接的做法是把页脚移出 MetricBoard，让 memo 的 props 里不再有
//   每次新建的元素。也可以把页脚封装成独立组件并让它自己渲染，但不要把
//   父组件里新建的 element 传给 memo 组件。
//
// CheapStatus 保留原样作为对照：它的 meta 每次都变，memo 的比较函数每次
// 都运行、每次都不等，因此没有任何渲染收益。对这么便宜的组件，正确做法
// 通常是不加 memo，或者在父组件里稳定 meta 的引用；盲目 memo 只会增加
// 浅比较的成本。

import { Profiler, memo, useCallback, useMemo, useState } from 'react'

export type TeamId = 'alpha' | 'beta'

export type Metric = {
  label: string
  value: string
}

export const TEAM_METRICS: Record<TeamId, Metric[]> = {
  alpha: [
    { label: '周活跃', value: '1,280' },
    { label: '转化率', value: '4.2%' },
  ],
  beta: [
    { label: '周活跃', value: '860' },
    { label: '转化率', value: '5.1%' },
  ],
}

export const TEAM_LABELS: Record<TeamId, string> = {
  alpha: 'Alpha 团队',
  beta: 'Beta 团队',
}

export function buildMetrics(team: TeamId): Metric[] {
  return TEAM_METRICS[team].map((metric) => ({ ...metric }))
}

export type BoardRender = {
  team: TeamId
  metricCount: number
}

const boardRenderLog: BoardRender[] = []
let boardRenders = 0
let boardCommits = 0
let cheapRenders = 0
let cheapCompares = 0

export function getBoardRenderCount(): number {
  return boardRenders
}

export function getBoardProfilerCommits(): number {
  return boardCommits
}

export function getBoardRenderLog(): BoardRender[] {
  return boardRenderLog
}

export function getCheapStatusRenderCount(): number {
  return cheapRenders
}

export function getCheapStatusCompareCount(): number {
  return cheapCompares
}

export function resetBoardLogs(): void {
  boardRenderLog.length = 0
  boardRenders = 0
  boardCommits = 0
  cheapRenders = 0
  cheapCompares = 0
}

function recordBoardCommit(): void {
  boardCommits += 1
}

const CheapStatus = memo(
  function CheapStatus({ meta }: { meta: { tick: number } }) {
    cheapRenders += 1
    return <output aria-label="轻量状态">tick {meta.tick}</output>
  },
  (prev, next) => {
    cheapCompares += 1
    return prev.meta.tick === next.meta.tick
  },
)

type MetricBoardProps = {
  team: TeamId
  metrics: Metric[]
  options: { compact: boolean }
  onInspect: (label: string) => void
}

const MetricBoard = memo(function MetricBoard({
  team,
  metrics,
  options,
  onInspect,
}: MetricBoardProps) {
  boardRenders += 1
  boardRenderLog.push({ team, metricCount: metrics.length })

  return (
    <Profiler id="metric-board" onRender={recordBoardCommit}>
      <section
        aria-label="指标面板"
        data-team={team}
        data-compact={options.compact ? 'true' : 'false'}
      >
        <h2>{TEAM_LABELS[team]}指标</h2>
        <ul aria-label="团队指标">
          {metrics.map((metric) => (
            <li key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <button type="button" onClick={() => onInspect(metric.label)}>
                详情 {metric.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </Profiler>
  )
})

export type WorkspacePanelProps = {
  theme?: 'light' | 'dark'
}

export default function WorkspacePanel({ theme = 'light' }: WorkspacePanelProps) {
  const [team, setTeam] = useState<TeamId>('alpha')
  const [note, setNote] = useState('')
  const [tick, setTick] = useState(0)
  const [inspected, setInspected] = useState<string | null>(null)

  const metrics = useMemo(() => buildMetrics(team), [team])
  const options = useMemo(() => ({ compact: false }), [])
  const handleInspect = useCallback((label: string) => {
    setInspected(label)
  }, [])

  return (
    <section aria-label="工作台" data-theme={theme}>
      <label>
        团队
        <select
          aria-label="团队"
          value={team}
          onChange={(event) => setTeam(event.target.value as TeamId)}
        >
          <option value="alpha">Alpha</option>
          <option value="beta">Beta</option>
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

      <button type="button" onClick={() => setTick((value) => value + 1)}>
        刷新气泡
      </button>
      <CheapStatus meta={{ tick }} />

      <MetricBoard
        team={team}
        metrics={metrics}
        options={options}
        onInspect={handleInspect}
      />
      <small>数据来源：本地缓存</small>

      <p>已查看：{inspected ?? '无'}</p>
    </section>
  )
}
