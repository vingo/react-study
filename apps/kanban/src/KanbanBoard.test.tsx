import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { STORAGE_KEY } from './storage'
import type { Task, TaskStatus } from './types'

type User = ReturnType<typeof userEvent.setup>

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: '示例任务',
    description: '',
    status: 'todo',
    createdAt: '2026-11-16T08:00:00.000Z',
    ...overrides,
  }
}

function getColumn(name: '待办' | '进行中' | '已完成') {
  return screen.getByRole('region', { name })
}

function readStoredTasks(): Task[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Task[]
}

async function createTask(
  user: User,
  values: { title: string; description?: string; status?: TaskStatus },
) {
  await user.click(screen.getByRole('button', { name: '新建任务' }))

  const titleInput = screen.getByLabelText('标题')
  await user.type(titleInput, values.title)

  if (values.description) {
    await user.type(screen.getByLabelText('描述'), values.description)
  }

  if (values.status) {
    await user.selectOptions(screen.getByLabelText('状态'), values.status)
  }

  await user.click(screen.getByRole('button', { name: '创建任务' }))
}

beforeEach(() => {
  localStorage.clear()
})

describe('KanbanBoard', () => {
  it('首次加载展示三列、空状态和统计', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '任务看板' })).toBeInTheDocument()
    expect(getColumn('待办')).toBeInTheDocument()
    expect(getColumn('进行中')).toBeInTheDocument()
    expect(getColumn('已完成')).toBeInTheDocument()
    expect(screen.getAllByText('暂无任务')).toHaveLength(3)
    expect(screen.getByText('共 0 个任务 · 已完成 0 个')).toBeInTheDocument()
  })

  it('新建任务：空标题被拦截，标题框自动聚焦，成功后持久化', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '新建任务' }))

    const titleInput = screen.getByLabelText('标题')
    expect(titleInput).toHaveFocus()

    await user.click(screen.getByRole('button', { name: '创建任务' }))

    expect(screen.getByRole('alert')).toHaveTextContent('标题不能为空')
    expect(titleInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('共 0 个任务 · 已完成 0 个')).toBeInTheDocument()

    await user.type(titleInput, '买牛奶')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('描述'), '顺便买面包')
    await user.selectOptions(screen.getByLabelText('状态'), 'doing')
    await user.click(screen.getByRole('button', { name: '创建任务' }))

    expect(within(getColumn('进行中')).getByText('买牛奶')).toBeInTheDocument()
    expect(within(getColumn('进行中')).getByText('顺便买面包')).toBeInTheDocument()
    expect(screen.getByText('共 1 个任务 · 已完成 0 个')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '创建任务' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新建任务' })).toHaveFocus()

    const stored = readStoredTasks()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      title: '买牛奶',
      description: '顺便买面包',
      status: 'doing',
    })
    expect(stored[0].id).toEqual(expect.any(String))
    expect(stored[0].createdAt).toEqual(expect.any(String))
  })

  it('编辑任务后卡片和 localStorage 都更新', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createTask(user, { title: '旧标题', description: '旧描述' })

    await user.click(
      within(getColumn('待办')).getByRole('button', { name: '编辑「旧标题」' }),
    )

    const titleInput = screen.getByLabelText('标题')
    expect(titleInput).toHaveValue('旧标题')
    await user.clear(titleInput)
    await user.type(titleInput, '新标题')

    const descriptionInput = screen.getByLabelText('描述')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, '新描述')

    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(within(getColumn('待办')).getByText('新标题')).toBeInTheDocument()
    expect(within(getColumn('待办')).getByText('新描述')).toBeInTheDocument()
    expect(screen.queryByText('旧标题')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()

    expect(readStoredTasks()[0]).toMatchObject({
      title: '新标题',
      description: '新描述',
    })
  })

  it('切换状态时任务移动到对应列', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createTask(user, { title: '写文档' })

    await user.selectOptions(
      within(getColumn('待办')).getByLabelText('移动「写文档」到'),
      'done',
    )

    expect(within(getColumn('已完成')).getByText('写文档')).toBeInTheDocument()
    expect(within(getColumn('待办')).queryByText('写文档')).not.toBeInTheDocument()
    expect(screen.getByText('共 1 个任务 · 已完成 1 个')).toBeInTheDocument()
    expect(readStoredTasks()[0].status).toBe('done')
  })

  it('删除任务需要确认，取消时保留任务', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createTask(user, { title: '买牛奶' })

    await user.click(
      within(getColumn('待办')).getByRole('button', { name: '删除「买牛奶」' }),
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('确定要删除「买牛奶」吗？此操作无法撤销。')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '取消' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: '取消' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('买牛奶')).toBeInTheDocument()
    expect(readStoredTasks()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '删除「买牛奶」' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '确认删除' }),
    )

    expect(screen.queryByText('买牛奶')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByText('暂无任务')).toHaveLength(3)
    expect(readStoredTasks()).toEqual([])
  })

  it('按 Escape 可以关闭删除确认框', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createTask(user, { title: '买牛奶' })

    await user.click(screen.getByRole('button', { name: '删除「买牛奶」' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('买牛奶')).toBeInTheDocument()
  })

  it('编辑不同任务时不会残留上一个任务的表单输入', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createTask(user, { title: '任务一' })
    await createTask(user, { title: '任务二' })

    await user.click(screen.getByRole('button', { name: '编辑「任务一」' }))
    expect(screen.getByLabelText('标题')).toHaveValue('任务一')
    await user.click(screen.getByRole('button', { name: '取消' }))

    await user.click(screen.getByRole('button', { name: '编辑「任务二」' }))
    expect(screen.getByLabelText('标题')).toHaveValue('任务二')
  })

  it('从 localStorage 恢复任务', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        makeTask({ id: 'restored', title: '恢复的任务', status: 'doing' }),
      ]),
    )

    render(<App />)

    expect(within(getColumn('进行中')).getByText('恢复的任务')).toBeInTheDocument()
    expect(screen.getByText('共 1 个任务 · 已完成 0 个')).toBeInTheDocument()
  })

  it('损坏的本地数据不会使页面崩溃，仍可继续新建任务', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, '{broken json')

    render(<App />)

    expect(screen.getAllByText('暂无任务')).toHaveLength(3)

    await createTask(user, { title: '损坏后新建的任务' })

    expect(screen.getByText('损坏后新建的任务')).toBeInTheDocument()
    expect(readStoredTasks()).toHaveLength(1)
  })

  it('忽略无效的本地任务记录', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        makeTask({ id: 'good', title: '有效任务' }),
        { id: 'bad-title', title: '' },
        null,
        { ...makeTask({ id: 'bad-status' }), status: 'blocked' },
      ]),
    )

    render(<App />)

    expect(screen.getByText('有效任务')).toBeInTheDocument()
    expect(screen.getByText('共 1 个任务 · 已完成 0 个')).toBeInTheDocument()
  })
})
