/**
 * 在事件处理函数中生成稳定 ID。不要在 render 或 reducer 中生成。
 */
export function createTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
