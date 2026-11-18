import { Profiler } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  ThemeToggle,
  TaskCountBadge,
  TaskList,
  resetTaskStore,
  useTaskStore,
} from './ex1'

beforeEach(() => {
  resetTaskStore()
})

// 用 React 自带的 Profiler 统计每个子树真正提交（渲染）的次数。
// 初始挂载算 1 次；没有 commit 就不会调用 onRender。
function renderProbes() {
  let countRenders = 0
  let listRenders = 0

  render(
    <>
      <Profiler id="count" onRender={() => { countRenders += 1 }}>
        <TaskCountBadge />
      </Profiler>
      <Profiler id="list" onRender={() => { listRenders += 1 }}>
        <TaskList />
      </Profiler>
      <ThemeToggle />
    </>,
  )

  return {
    countRenders: () => countRenders,
    listRenders: () => listRenders,
  }
}

test('切换主题只更新主题相关组件，任务数量和列表不重渲染', () => {
  const probes = renderProbes()

  expect(screen.getByText('任务总数：2')).toBeInTheDocument()
  expect(screen.getByText('当前主题：浅色')).toBeInTheDocument()
  expect(probes.countRenders()).toBe(1)
  expect(probes.listRenders()).toBe(1)

  fireEvent.click(screen.getByRole('button', { name: '切换到深色' }))

  expect(screen.getByText('当前主题：深色')).toBeInTheDocument()
  expect(probes.countRenders()).toBe(1)
  expect(probes.listRenders()).toBe(1)
})

test('重命名任务只更新列表，数量没变时计数组件不重渲染', () => {
  const probes = renderProbes()

  act(() => {
    useTaskStore.getState().renameTask('t1', '写周报（修订）')
  })

  expect(screen.getByText('写周报（修订）（未完成）')).toBeInTheDocument()
  expect(screen.getByText('任务总数：2')).toBeInTheDocument()
  expect(probes.listRenders()).toBe(2)
  expect(probes.countRenders()).toBe(1)
})

test('新增任务同时更新数量和列表', () => {
  const probes = renderProbes()

  act(() => {
    useTaskStore.getState().addTask('准备演示')
  })

  expect(screen.getByText('任务总数：3')).toBeInTheDocument()
  expect(screen.getByText('准备演示（未完成）')).toBeInTheDocument()
  expect(probes.countRenders()).toBe(2)
  expect(probes.listRenders()).toBe(2)
})

test('未订阅主题的列表在主题切换时保持不动', () => {
  const probes = renderProbes()

  act(() => {
    useTaskStore.getState().toggleTheme()
  })

  expect(screen.getByText('当前主题：深色')).toBeInTheDocument()
  expect(probes.listRenders()).toBe(1)
  expect(screen.getByText('写周报（未完成）')).toBeInTheDocument()
})
