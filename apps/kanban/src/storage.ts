import { TASK_STATUSES } from './constants'
import type { Task, TaskStatus } from './types'

export const STORAGE_KEY = 'kanban.tasks.v1'

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
}

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.description === 'string' &&
    isTaskStatus(candidate.status) &&
    typeof candidate.createdAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.createdAt))
  )
}

/**
 * 解析 localStorage 中的原始字符串。任何损坏或不完整的记录都会被丢弃，
 * 而不是让整个页面崩溃。
 */
export function parseStoredTasks(raw: string | null): Task[] {
  if (raw === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const seenIds = new Set<string>()
  const tasks: Task[] = []

  for (const entry of parsed) {
    if (!isTask(entry) || seenIds.has(entry.id)) continue
    seenIds.add(entry.id)
    tasks.push({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      status: entry.status,
      createdAt: entry.createdAt,
    })
  }

  return tasks
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function loadTasks(storage?: Storage): Task[] {
  try {
    const target = storage ?? getStorage()
    if (!target) return []
    return parseStoredTasks(target.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function saveTasks(tasks: Task[], storage?: Storage): void {
  try {
    const target = storage ?? getStorage()
    if (!target) return
    target.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // 存储不可用或超出配额时静默降级，内存中的任务仍然可用。
  }
}
