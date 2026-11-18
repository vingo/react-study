// 参考答案 2：async transition + isPending
//
// startTransition 的异步 action 会一直保持 pending，直到整个异步流程结束。
// 当前文档要求：await 之后的 setState 要再包一层 startTransition，才能继续
// 作为 transition 更新。因此：
// - 加载期间 activeTab 与 content 都不变，旧内容与旧高亮保留；
// - isPending 为 true，可以渲染“切换中…”；
// - 完成后两个 setState 作为 transition 一起提交，更新内容与高亮。
// 过滤框的 setFilter 不在 transition 中，任何一次输入都是紧急更新。

import { useState, useTransition } from 'react'

export type TabId = 'overview' | 'activity'

export type TabData = {
  tab: TabId
  heading: string
  body: string
}

export const TAB_DATA: Record<TabId, TabData> = {
  overview: {
    tab: 'overview',
    heading: '概览内容',
    body: '这里是项目概览，加载很快。',
  },
  activity: {
    tab: 'activity',
    heading: '动态内容',
    body: '这里是团队动态，需要异步加载。',
  },
}

type PendingLoad = {
  tab: TabId
  resolve: (data: TabData) => void
}

const pendingLoads: PendingLoad[] = []
let loadCount = 0

export function loadTabData(tab: TabId): Promise<TabData> {
  loadCount += 1
  return new Promise<TabData>((resolve) => {
    pendingLoads.push({ tab, resolve })
  })
}

export function resolveTabLoad(tab: TabId): boolean {
  const index = pendingLoads.findIndex((load) => load.tab === tab)
  if (index === -1) {
    return false
  }
  const [load] = pendingLoads.splice(index, 1)
  load.resolve(TAB_DATA[tab])
  return true
}

export function getTabLoadCount(): number {
  return loadCount
}

export function resetTabLoads(): void {
  pendingLoads.length = 0
  loadCount = 0
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'activity', label: '动态' },
]

export default function TransitionTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [content, setContent] = useState<TabData>(TAB_DATA.overview)
  const [filter, setFilter] = useState('')
  const [isPending, startTransition] = useTransition()

  function selectTab(next: TabId) {
    if (next === activeTab) {
      return
    }

    startTransition(async () => {
      const data = await loadTabData(next)
      // 当前文档要求：await 之后的 state 更新要再包一层 startTransition。
      startTransition(() => {
        setActiveTab(next)
        setContent(data)
      })
    })
  }

  return (
    <section aria-label="标签页示例">
      <div role="tablist" aria-label="内容标签页">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <label>
        过滤
        <input
          aria-label="过滤内容"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>

      {isPending && <p role="status">切换中…</p>}

      <article
        aria-label="标签页内容"
        data-tab={content.tab}
        data-active-tab={activeTab}
      >
        <h2>{content.heading}</h2>
        <p>{content.body}</p>
      </article>
    </section>
  )
}
