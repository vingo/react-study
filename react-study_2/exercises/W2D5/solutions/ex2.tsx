// 参考答案 2：按归属放置状态
//
// - 主题/侧边栏/收藏跨组件共享 → Zustand 全局 store；
// - 筛选关键词要能刷新、分享、前进后退 → URL（useSearchParams）；
// - 编辑草稿只属于当前编辑器 → 局部 useState，组件卸载即丢弃。
//
// 练习 2：状态归属与 store actions（15 分钟）
//
// 场景：工作台里同时有三类状态：
// - 全局：主题、侧边栏开合、收藏的任务（跨页面/跨组件共享）；
// - URL：任务筛选关键词 q（刷新、分享链接、前进后退都要能还原）；
// - 局部：编辑标题时的草稿（只属于当前编辑器，关闭就该丢弃）。
//
// 现状与要求：
// 1. `togglePin` 是空实现。补全为不可变增删：已收藏则移除，未收藏则加入。
// 2. `selectPinnedCount` 永远返回 0。补全派生 selector，返回收藏数量。
// 3. TaskBrowser 把 URL 的 q 复制进了局部 state（BUG）。改为直接读/写 URL：
//    - 输入框的值来自 `searchParams.get('q')`；
//    - 输入时用 `setSearchParams` 更新 q，空字符串删除 q；
//    - 不要用 useState 保存筛选关键词。
// 4. TaskEditor 的草稿已经是局部 state，保持原样——不要把它搬进 Zustand store。
//
// 不要修改测试断言，也不要改变按钮/输入框/区域的可访问名称。
//
// 提示：
// - 不可变更新用 `filter` / 展开运算；不要 `push` / `splice` 原数组。
// - 修改 URL 搜索参数前先 `new URLSearchParams(searchParams)` 复制一份。
// - 派生值（收藏数量）从源状态计算，不要另存一份 count。

import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { create } from 'zustand'

export type Task = {
  id: string
  title: string
  done: boolean
}

export const TASKS: Task[] = [
  { id: 't1', title: '写周报', done: false },
  { id: 't2', title: '修复登录 bug', done: true },
  { id: 't3', title: '评审 PR', done: true },
  { id: 't4', title: '准备演示', done: false },
]

export type Theme = 'light' | 'dark'

export type WorkspaceState = {
  theme: Theme
  sidebarOpen: boolean
  pinnedIds: string[]
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  togglePin: (id: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  theme: 'light',
  sidebarOpen: false,
  pinnedIds: [],

  setTheme: (theme) => set({ theme }),

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  togglePin: (id) =>
    set((state) => ({
      pinnedIds: state.pinnedIds.includes(id)
        ? state.pinnedIds.filter((pinnedId) => pinnedId !== id)
        : [...state.pinnedIds, id],
    })),
}))

/** 测试用：恢复初始数据，避免用例之间互相污染。 */
export function resetWorkspaceStore() {
  useWorkspaceStore.setState({
    theme: 'light',
    sidebarOpen: false,
    pinnedIds: [],
  })
}

/** 派生 selector：收藏数量来自 pinnedIds，不单独存一份 count。 */
export const selectPinnedCount = (state: WorkspaceState): number =>
  state.pinnedIds.length

export function Header() {
  const theme = useWorkspaceStore((state) => state.theme)
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen)
  const setTheme = useWorkspaceStore((state) => state.setTheme)
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar)

  return (
    <header>
      <p>当前主题：{theme === 'dark' ? '深色' : '浅色'}</p>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '切换到浅色' : '切换到深色'}
      </button>
      <button type="button" onClick={toggleSidebar} aria-expanded={sidebarOpen}>
        侧边栏
      </button>
    </header>
  )
}

export function Sidebar() {
  const sidebarOpen = useWorkspaceStore((state) => state.sidebarOpen)

  if (!sidebarOpen) {
    return null
  }

  return (
    <aside aria-label="侧边栏">
      <p>快速筛选</p>
    </aside>
  )
}

export function PinnedCount() {
  const count = useWorkspaceStore(selectPinnedCount)

  return <p>已收藏 {count} 个任务</p>
}

export function TaskCard({ task }: { task: Task }) {
  // 编辑器的开关和草稿都属于局部 state：TaskEditor 卸载即丢弃。
  const [editing, setEditing] = useState(false)
  const pinned = useWorkspaceStore((state) => state.pinnedIds.includes(task.id))
  const togglePin = useWorkspaceStore((state) => state.togglePin)

  return (
    <li>
      <span>{task.title}</span>
      <button
        type="button"
        aria-pressed={pinned}
        onClick={() => togglePin(task.id)}
      >
        收藏 {task.title}
      </button>

      {editing ? (
        <TaskEditor task={task} onClose={() => setEditing(false)} />
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          编辑 {task.title}
        </button>
      )}
    </li>
  )
}

export function TaskEditor({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const [draft, setDraft] = useState(task.title)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <label>
        草稿 {task.title}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <button type="button" onClick={onClose}>
        取消
      </button>
      <button type="submit">保存</button>
    </form>
  )
}

export function TaskBrowser() {
  const [searchParams, setSearchParams] = useSearchParams()

  // URL 是筛选关键词的唯一来源：输入框的值、过滤结果都从它派生。
  const query = searchParams.get('q') ?? ''

  function updateQuery(next: string) {
    const params = new URLSearchParams(searchParams)

    if (next === '') {
      params.delete('q')
    } else {
      params.set('q', next)
    }

    setSearchParams(params)
  }

  const visibleTasks = TASKS.filter((task) =>
    task.title.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <section aria-label="任务浏览器">
      <label>
        筛选任务
        <input
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
        />
      </label>

      <p>共 {visibleTasks.length} 个任务</p>

      <ul aria-label="任务列表">
        {visibleTasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </ul>
    </section>
  )
}

export function Workspace() {
  return (
    <div>
      <Header />
      <Sidebar />
      <main>
        <PinnedCount />
        <TaskBrowser />
      </main>
    </div>
  )
}
