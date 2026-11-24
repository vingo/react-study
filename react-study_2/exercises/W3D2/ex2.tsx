// 练习 2：补全 Tab 切换的 transition pending UI（15 分钟）
//
// 现状：点击另一个 tab 时直接 setActiveTab，高亮立刻切换，但内容仍是旧的；
// 加载期间没有任何 pending 反馈，用户不知道点击是否生效。
//
// 目标：用 useTransition 把“切换 tab + 写入新内容”包成一次 transition。
// 要求：
// - 加载完成前保留旧 tab 的内容，并且旧 tab 仍显示为选中；
// - 加载期间显示 role="status" 的“切换中…”提示（isPending）；
// - 加载完成后显示新内容、新 tab 选中，pending 提示消失；
// - 紧急输入（过滤框）在 pending 期间必须立即更新，不能被 transition 阻塞。
//
// loadTabData 由测试控制：promise 初始 pending，测试调用 resolveTabLoad 放行。
// 不要在 render 中调用 loadTabData。
//
// 提示：React 19 支持异步 action：startTransition(async () => { ... })。
// isPending 会覆盖整个异步流程；但 await 之后的 state 更新按当前文档
// 还要再包一层 startTransition，才能继续作为 transition 更新。

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

// 测试用：返回一个受控 promise，初始 pending。
export function loadTabData(tab: TabId): Promise<TabData> {
  loadCount += 1
  return new Promise<TabData>((resolve) => {
    pendingLoads.push({ tab, resolve })
  })
}

// 测试用：放行某个 tab 的加载。没有对应 pending 时返回 false。
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
    // BUG：直接 setState，高亮立即切换；没有 pending 反馈。
    startTransition(async() => {
      const data= await loadTabData(next)
      startTransition(()=> {
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
