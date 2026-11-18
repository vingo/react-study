import { useEffect, useRef } from 'react'
import type { Task } from '../types'

type ConfirmDialogProps = {
  task: Task
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ task, onCancel, onConfirm }: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <h2 id="confirm-dialog-title">删除任务</h2>
        <p id="confirm-dialog-description">
          确定要删除「{task.title}」吗？此操作无法撤销。
        </p>
        <div className="dialog__actions">
          <button ref={cancelButtonRef} type="button" className="button" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="button button--primary button--danger-solid"
            onClick={onConfirm}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
