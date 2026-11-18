// 参考答案 3：localStorage + partialize
//
// - storage 换成 localStorage，设置才能跨标签页/刷新保留；
// - partialize 只返回 theme 与 fontSize，sidebarOpen / sessionNote 不会落到
//   磁盘；rehydrate 时默认的浅合并只覆盖存储里存在的键，临时状态保持当前值。
//
// 练习 3：persist 中间件与部分持久化（20 分钟）
//
// 场景：用户设置面板里，主题和字号应该跨刷新保留；
// 侧边栏开合、临时备注只属于当前会话，不该写进 localStorage。
//
// 现状（两个 BUG）：
// 1. `createJSONStorage(() => sessionStorage)`：设置写进了会话存储，
//    关闭标签页/刷新后丢失，localStorage 里什么都没有。
// 2. 没有 `partialize`：所有可序列化字段（包括 sidebarOpen、sessionNote）
//    都会写入存储。
//
// 要求：
// 1. 改用 `createJSONStorage(() => localStorage)`。
// 2. 添加 `partialize`，只持久化 `theme` 和 `fontSize`。
// 3. 不要改变存储 key（SETTINGS_STORAGE_KEY）、action 名称或界面可访问名称。
// 4. 不需要自己写序列化/反序列化，`createJSONStorage` 已经处理 JSON。
//
// 提示：`persist` 的第二个参数里，`name` 是 storage key；
// `storage` 决定读写哪个 Storage；`partialize` 决定写入哪些字段。
// 读取时 Zustand 会把存储里的对象浅合并回当前 state，未持久化的字段
// 会保持当前值，而不是被存储覆盖。
//
// 测试里通过 `useSettingsStore.persist.rehydrate()` 模拟“刷新后从存储恢复”；
// 每个用例开始前调用 `resetSettingsStore()` 并清空 localStorage。

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const SETTINGS_STORAGE_KEY = 'w2d5-settings'

export type Theme = 'light' | 'dark'
export type FontSize = 'small' | 'medium' | 'large'

export type SettingsState = {
  theme: Theme
  fontSize: FontSize
  sidebarOpen: boolean
  sessionNote: string
  setTheme: (theme: Theme) => void
  setFontSize: (fontSize: FontSize) => void
  toggleSidebar: () => void
  setSessionNote: (note: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 'medium',
      sidebarOpen: false,
      sessionNote: '',

      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSessionNote: (sessionNote) => set({ sessionNote }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
      }),
    },
  ),
)

/** 测试用：恢复默认设置并清空当前配置的 storage，避免用例互相污染。 */
export function resetSettingsStore() {
  useSettingsStore.setState({
    theme: 'light',
    fontSize: 'medium',
    sidebarOpen: false,
    sessionNote: '',
  })
  useSettingsStore.persist.clearStorage()
}

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: '小号',
  medium: '中号',
  large: '大号',
}

export function SettingsPanel() {
  const theme = useSettingsStore((state) => state.theme)
  const fontSize = useSettingsStore((state) => state.fontSize)
  const sidebarOpen = useSettingsStore((state) => state.sidebarOpen)
  const sessionNote = useSettingsStore((state) => state.sessionNote)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const setFontSize = useSettingsStore((state) => state.setFontSize)
  const toggleSidebar = useSettingsStore((state) => state.toggleSidebar)
  const setSessionNote = useSettingsStore((state) => state.setSessionNote)

  return (
    <section aria-label="设置面板">
      <p>当前主题：{theme === 'dark' ? '深色' : '浅色'}</p>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '切换到浅色' : '切换到深色'}
      </button>

      <div role="group" aria-label="字号">
        {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={fontSize === value}
            onClick={() => setFontSize(value)}
          >
            {FONT_SIZE_LABELS[value]}
          </button>
        ))}
      </div>

      <button type="button" onClick={toggleSidebar}>
        {sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
      </button>

      {sidebarOpen && (
        <aside aria-label="侧边栏">
          <p>临时导航</p>
        </aside>
      )}

      <label>
        临时备注
        <input
          value={sessionNote}
          onChange={(event) => setSessionNote(event.target.value)}
        />
      </label>
    </section>
  )
}
