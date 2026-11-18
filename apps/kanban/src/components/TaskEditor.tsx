import { useEffect, useRef, useState, type FormEvent } from 'react'
import { STATUS_LABELS, TASK_STATUSES } from '../constants'
import type { Task, TaskDraft, TaskStatus } from '../types'

type TaskEditorProps = {
  initialTask?: Task
  onSubmit: (draft: TaskDraft) => void
  onCancel: () => void
}

export function TaskEditor({ initialTask, onSubmit, onCancel }: TaskEditorProps) {
  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [description, setDescription] = useState(initialTask?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status ?? 'todo')
  const [error, setError] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // 打开编辑器后把焦点交给标题输入框。用 ref 做命令式 DOM 操作，
  // 而不是为此额外维护一份 state。
  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('标题不能为空')
      titleInputRef.current?.focus()
      return
    }

    setError('')
    onSubmit({
      title: trimmedTitle,
      description: description.trim(),
      status,
    })
  }

  return (
    <form className="task-editor" onSubmit={handleSubmit} noValidate>
      <h2 className="task-editor__heading">{initialTask ? '编辑任务' : '新建任务'}</h2>

      <div className="field">
        <label htmlFor="task-title">标题</label>
        <input
          id="task-title"
          ref={titleInputRef}
          value={title}
          maxLength={100}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'task-title-error' : undefined}
          placeholder="例如：整理本周学习笔记"
          onChange={(event) => {
            setTitle(event.target.value)
            if (error) setError('')
          }}
        />
        {error && (
          <p id="task-title-error" className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="task-description">描述</label>
        <textarea
          id="task-description"
          value={description}
          maxLength={500}
          rows={3}
          placeholder="补充任务细节（可选）"
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="field field--inline">
        <label htmlFor="task-status">状态</label>
        <select
          id="task-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((taskStatus) => (
            <option key={taskStatus} value={taskStatus}>
              {STATUS_LABELS[taskStatus]}
            </option>
          ))}
        </select>
      </div>

      <div className="task-editor__actions">
        <button type="submit" className="button button--primary">
          {initialTask ? '保存' : '创建任务'}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  )
}
