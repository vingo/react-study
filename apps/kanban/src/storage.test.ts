import { describe, expect, it } from 'vitest'
import { STORAGE_KEY, loadTasks, parseStoredTasks, saveTasks } from './storage'
import type { Task } from './types'

const validTask: Task = {
  id: 'task-1',
  title: '写周报',
  description: '总结本周进展',
  status: 'doing',
  createdAt: '2026-11-16T09:00:00.000Z',
}

function brokenStorage(): Storage {
  return {
    getItem() {
      throw new Error('storage is blocked')
    },
    setItem() {
      throw new Error('storage is blocked')
    },
    removeItem() {},
    clear() {},
    key() {
      return null
    },
    length: 0,
  }
}

describe('parseStoredTasks', () => {
  it('没有数据时返回空数组', () => {
    expect(parseStoredTasks(null)).toEqual([])
  })

  it('JSON 损坏时返回空数组', () => {
    expect(parseStoredTasks('{not valid json')).toEqual([])
  })

  it('顶层不是数组时返回空数组', () => {
    expect(parseStoredTasks(JSON.stringify({ tasks: [] }))).toEqual([])
    expect(parseStoredTasks(JSON.stringify('tasks'))).toEqual([])
  })

  it('过滤字段缺失或非法的记录', () => {
    const raw = JSON.stringify([
      validTask,
      null,
      'not a task',
      { ...validTask, id: 'task-2', status: 'blocked' },
      { ...validTask, id: 'task-3', title: '   ' },
      { ...validTask, id: 'task-4', createdAt: 'not-a-date' },
      { ...validTask, id: 'task-5', description: undefined },
      { id: 'task-6', title: '缺少其他字段' },
    ])

    expect(parseStoredTasks(raw)).toEqual([validTask])
  })

  it('重复 id 只保留第一条记录', () => {
    const raw = JSON.stringify([
      validTask,
      { ...validTask, title: '重复的任务' },
      { ...validTask, id: 'task-2', title: '另一个任务' },
    ])

    expect(parseStoredTasks(raw)).toEqual([
      validTask,
      { ...validTask, id: 'task-2', title: '另一个任务' },
    ])
  })

  it('忽略记录中的未知字段', () => {
    const raw = JSON.stringify([{ ...validTask, extra: 'ignored' }])
    const [task] = parseStoredTasks(raw)

    expect(task).toEqual(validTask)
    expect(task).not.toHaveProperty('extra')
  })
})

describe('loadTasks / saveTasks', () => {
  it('可以往返读写任务', () => {
    saveTasks([validTask])

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([validTask]))
    expect(loadTasks()).toEqual([validTask])
  })

  it('存储不可用时不抛错', () => {
    const storage = brokenStorage()

    expect(loadTasks(storage)).toEqual([])
    expect(() => saveTasks([validTask], storage)).not.toThrow()
  })
})
