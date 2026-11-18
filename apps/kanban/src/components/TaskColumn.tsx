import type { DragEvent } from 'react'
import { STATUS_LABELS } from '../constants'
import type { Task, TaskStatus } from '../types'
import { TaskCard } from './TaskCard'

type TaskColumnProps = {
  status: TaskStatus
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onMove: (taskId: string, status: TaskStatus) => void
  onDropTask: (taskId: string, status: TaskStatus) => void
}

export function TaskColumn({
  status,
  tasks,
  onEdit,
  onDelete,
  onMove,
  onDropTask,
}: TaskColumnProps) {
  const label = STATUS_LABELS[status]
  const headingId = `column-${status}-heading`

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/plain')
    if (taskId) onDropTask(taskId, status)
  }

  return (
    <section
      className={`task-column task-column--${status}`}
      aria-labelledby={headingId}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="task-column__header">
        <h2 id={headingId} className="task-column__title">
          {label}
        </h2>
        <span className="task-column__count" title={`${tasks.length} 个任务`}>
          {tasks.length}
        </span>
      </header>

      {tasks.length === 0 ? (
        <p className="task-column__empty">暂无任务</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
