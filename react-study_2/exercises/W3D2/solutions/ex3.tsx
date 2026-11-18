// 参考答案 3：<Activity> keep-alive
//
// <Activity mode="hidden"> 的子树：
// - React 仍然保留 fiber 与 DOM，把可见的宿主节点设为 display: none !important；
// - 卸载（cleanup）它的 Effects，但保留组件 state；
// - mode 切回 "visible" 时，用保留的 state 重新渲染，并重新 setup Effects。
//
// 因此两个面板始终是同一对组件实例：草稿、计数不会因为切换而丢失，
// 而订阅类 Effect 在隐藏期间确实被停掉了。

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

      <Activity mode={tab === 'notes' ? 'visible' : 'hidden'}>
        <NotesPanel />
      </Activity>
      <Activity mode={tab === 'stats' ? 'visible' : 'hidden'}>
        <StatsPanel />
      </Activity>
    </section>
  )
}
