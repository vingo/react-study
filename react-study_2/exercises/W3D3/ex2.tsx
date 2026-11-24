// 练习 2：修好 memo 的边界（15 分钟）
//
// 现象：
// MetricBoard 已经用 memo 包了，但父组件每次 render 都会：
// - 用 buildMetrics(team) 生成新数组；
// - 新建 options 对象；
// - 新建 onInspect 函数；
// - 新建 <small> 作为 children。
// memo 做的是 props 浅比较，以上四个 prop 的引用每次都变，所以 memo 永远
// 放行。备注输入、主题变化这类与指标无关的更新，也会让整块指标重渲染。
//
// 目标：
// - 备注输入、theme 变化不重渲染 MetricBoard（也不触发它的 Profiler commit）；
// - 切换团队仍然重渲染并显示对应指标；
// - “详情”按钮仍然能把已查看的指标显示到面板外；
// - 理解 children 也是 prop：把父组件每次新建的元素传给 memo 组件，会让
//   memo 失效。把页脚移出 memo 边界（或交给稳定组件渲染），并稳定其余引用。
//
// 另外保留一个“对照实验”：CheapStatus 很便宜，但每次刷新气泡都会收到新的
// meta 对象，所以自定义比较函数每次都判定不等、每次都重渲染。测试会证明：
// 这种场景 memo 只增加比较成本，没有任何渲染收益。
//
// 测试依赖：MetricBoard 内部的 <Profiler> 计数与模块级 render 计数。
// 请保留 Profiler。不要修改测试断言。

import { Profiler, memo, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

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

// 模拟真实代码里由 map/filter 派生出的新数组：每次调用都是新引用。
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

// 对照实验：组件本身几乎零成本，但 meta 每次都是新对象。
// memo 的比较函数会运行，却永远判不等，于是每次照常渲染。
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
  children?: ReactNode
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

  // BUG：以下引用每次 render 都会重新创建，memo 形同虚设。
  const metrics = useMemo(() =>{
    return buildMetrics(team)
  },[team])
  const options = useMemo(() =>{
    return { compact: false }
  },[])
  const handleInspect = useCallback((label: string)=> {
    setInspected(label)
  }, [inspected])

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
