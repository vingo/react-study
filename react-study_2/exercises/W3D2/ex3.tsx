// 练习 3：用 <Activity> 实现 tab keep-alive（20 分钟）
//
// 现状：条件渲染只挂载当前 tab。切走时组件被卸载，输入草稿、计数等本地
// state 全部丢失；切回来是一个全新的实例。
//
// 目标：用 React 19.3 的 <Activity mode="visible" | "hidden"> 同时保留两个
// tab：
// - 隐藏的 tab 仍然留在 DOM 中，但由 React 设置 display: none；
// - 隐藏时它的 Effects 执行 cleanup（停止订阅/定时器等）；
// - 切回 visible 时 state 原样恢复，Effects 重新 setup（mount 日志再次出现）。
//
// 测试依赖：两个面板必须始终在 DOM 中，data-testid 分别为
// "notes-panel" 和 "stats-panel"；Effects 的日志写入 activityLog。
// 不要修改测试里的断言。

import { Activity, useEffect, useState } from 'react'

const activityLog: string[] = []

export function getKeepAliveLog(): string[] {
  return activityLog
}

export function resetKeepAliveLog(): void {
  activityLog.length = 0
}

function NotesPanel() {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    activityLog.push('notes:mount')
    return () => {
      activityLog.push('notes:cleanup')
    }
  }, [])

  return (
    <section data-testid="notes-panel" aria-label="笔记面板">
      <h2>笔记</h2>
      <label>
        草稿
        <input
          aria-label="笔记草稿"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <p>当前草稿：{draft || '（空）'}</p>
    </section>
  )
}

function StatsPanel() {
  const [likes, setLikes] = useState(0)
  const [note, setNote] = useState('')

  useEffect(() => {
    activityLog.push('stats:mount')
    return () => {
      activityLog.push('stats:cleanup')
    }
  }, [])

  return (
    <section data-testid="stats-panel" aria-label="统计面板">
      <h2>统计</h2>
      <button type="button" onClick={() => setLikes((value) => value + 1)}>
        点赞
      </button>
      <output aria-label="点赞数">{likes}</output>
      <label>
        备注
        <input
          aria-label="统计备注"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
    </section>
  )
}

export default function KeepAliveTabs() {
  const [tab, setTab] = useState<'notes' | 'stats'>('notes')

  return (
    <section aria-label="Keep alive 示例">
      <div role="tablist" aria-label="面板切换">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          onClick={() => setTab('notes')}
        >
          笔记
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stats'}
          onClick={() => setTab('stats')}
        >
          统计
        </button>
      </div>

      {/* BUG：条件渲染会卸载另一个 tab，state 与 Effect 都随之丢失。 */}
      {/* {tab === 'notes' ? <NotesPanel /> : <StatsPanel />} */}
      <Activity mode={tab === 'notes' ? 'visible' : 'hidden'} ><NotesPanel /></Activity>
      <Activity mode={tab === 'stats' ? 'visible' : 'hidden'}><StatsPanel /></Activity>

    </section>
  )
}
