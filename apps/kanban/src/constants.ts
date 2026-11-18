import type { TaskStatus } from './types'

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done']

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}
