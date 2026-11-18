import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  SETTINGS_STORAGE_KEY,
  SettingsPanel,
  resetSettingsStore,
  useSettingsStore,
} from './ex3'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetSettingsStore()
})

type StoredSettings = {
  state: Record<string, unknown>
  version: number
}

function readStored(): StoredSettings | null {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
  return raw === null ? null : (JSON.parse(raw) as StoredSettings)
}

test('修改主题和字号会写入 localStorage，且只持久化这两个字段', () => {
  render(<SettingsPanel />)

  fireEvent.click(screen.getByRole('button', { name: '切换到深色' }))
  fireEvent.click(screen.getByRole('button', { name: '大号' }))

  const saved = readStored()
  expect(saved).not.toBeNull()
  expect(saved?.state).toEqual({ theme: 'dark', fontSize: 'large' })
})

test('侧边栏与临时备注只属于当前会话，不写入存储', () => {
  render(<SettingsPanel />)

  fireEvent.click(screen.getByRole('button', { name: '展开侧边栏' }))
  fireEvent.change(screen.getByLabelText('临时备注'), {
    target: { value: '只属于这次会话' },
  })

  expect(
    screen.getByRole('complementary', { name: '侧边栏' }),
  ).toBeInTheDocument()

  const saved = readStored()
  expect(saved).not.toBeNull()
  expect(saved?.state).toEqual({ theme: 'light', fontSize: 'medium' })
  expect(saved?.state).not.toHaveProperty('sidebarOpen')
  expect(saved?.state).not.toHaveProperty('sessionNote')
})

test('模拟刷新：从 localStorage 恢复主题与字号', async () => {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      state: { theme: 'dark', fontSize: 'large' },
      version: 0,
    }),
  )

  await act(async () => {
    await useSettingsStore.persist.rehydrate()
  })

  render(<SettingsPanel />)

  expect(screen.getByText('当前主题：深色')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '大号' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('恢复只覆盖持久化字段，当前会话状态保持原样', async () => {
  // 先把当前会话状态改成非默认值，再模拟从存储恢复。
  useSettingsStore.setState({ sidebarOpen: true, sessionNote: '本次会话草稿' })

  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      state: { theme: 'dark', fontSize: 'large' },
      version: 0,
    }),
  )

  await act(async () => {
    await useSettingsStore.persist.rehydrate()
  })

  render(<SettingsPanel />)

  expect(screen.getByText('当前主题：深色')).toBeInTheDocument()
  expect(
    screen.getByRole('complementary', { name: '侧边栏' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('临时备注')).toHaveValue('本次会话草稿')
})
