import type { DragEvent } from 'react'
import { STATUS_LABELS, TASK_STATUSES } from '../constants'
import { formatCreatedAt } from '../date'
import type { Task, TaskStatus } from '../types'

type TaskCardProps = {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onMove: (taskId: string, status: TaskStatus) => void
}

export function TaskCard({ task, onEdit, onDelete, onMove }: TaskCardProps) {
  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.setData('text/plain', task.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <article className="task-card" draggable onDragStart={handleDragStart}>
      <div className="task-card__body">
        <h3 className="task-card__title">{task.title}</h3>
        {task.description && <p className="task-card__description">{task.description}</p>}
        <time className="task-card__time" dateTime={task.createdAt}>
          创建于 {formatCreatedAt(task.createdAt)}
        </time>
      </div>

      <div className="task-card__actions">
        <label className="sr-only" htmlFor={`status-${task.id}`}>
          移动「{task.title}」到
        </label>
        <select
          id={`status-${task.id}`}
          className="task-card__status"
          value={task.status}
          onChange={(event) => onMove(task.id, event.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="button button--ghost"
          aria-label={`编辑「${task.title}」`}
          onClick={() => onEdit(task)}
        >
          编辑
        </button>
        <button
          type="button"
          className="button button--ghost button--danger"
          aria-label={`删除「${task.title}」`}
          onClick={() => onDelete(task)}
        >
          删除
        </button>
      </div>
    </article>
  )
}
