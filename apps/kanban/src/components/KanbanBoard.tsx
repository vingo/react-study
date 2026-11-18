import { useEffect, useMemo, useRef, useState } from 'react'
import { TASK_STATUSES } from '../constants'
import { loadTasks, saveTasks } from '../storage'
import { createTaskId } from '../task-id'
import type { Task, TaskDraft, TaskStatus } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { TaskColumn } from './TaskColumn'
import { TaskEditor } from './TaskEditor'

type EditorState = { mode: 'create' } | { mode: 'edit'; task: Task } | null

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [editor, setEditor] = useState<EditorState>(null)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)

  const createButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditorOpenRef = useRef(false)
  const isEditorOpen = editor !== null

  // 任务数组是唯一数据源：每次变化后同步到 localStorage。
  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  // 编辑器关闭后把焦点还给「新建任务」，避免焦点丢到 body。
  useEffect(() => {
    if (wasEditorOpenRef.current && !isEditorOpen) {
      createButtonRef.current?.focus()
    }
    wasEditorOpenRef.current = isEditorOpen
  }, [isEditorOpen])

  // 列内任务数和完成数是派生数据，直接从 tasks 计算，不单独存 state。
  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] }
    for (const task of tasks) groups[task.status].push(task)
    return groups
  }, [tasks])

  const doneCount = tasksByStatus.done.length

  function handleCreate(draft: TaskDraft) {
    const task: Task = {
      id: createTaskId(),
      title: draft.title,
      description: draft.description,
      status: draft.status,
      createdAt: new Date().toISOString(),
    }
    setTasks((current) => [...current, task])
    setEditor(null)
  }

  function handleUpdate(draft: TaskDraft) {
    if (editor?.mode !== 'edit') return

    const taskId = editor.task.id
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, ...draft } : task)),
    )
    setEditor(null)
  }

  function handleMove(taskId: string, status: TaskStatus) {
    setTasks((current) => {
      const task = current.find((item) => item.id === taskId)
      if (!task || task.status === status) return current

      return current.map((item) => (item.id === taskId ? { ...item, status } : item))
    })
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return

    const taskId = pendingDelete.id
    setTasks((current) => current.filter((task) => task.id !== taskId))
    setEditor((current) =>
      current?.mode === 'edit' && current.task.id === taskId ? null : current,
    )
    setPendingDelete(null)
  }

  return (
    <div className="kanban-board">
      <header className="board-header">
        <div>
          <h1>任务看板</h1>
          <p className="board-summary">
            共 {tasks.length} 个任务 · 已完成 {doneCount} 个
          </p>
        </div>
        <button
          ref={createButtonRef}
          type="button"
          className="button button--primary"
          onClick={() => setEditor({ mode: 'create' })}
        >
          新建任务
        </button>
      </header>

      {editor && (
        <TaskEditor
          // 编辑不同任务时用 key 卸载重建表单，避免上一条任务的输入残留。
          key={editor.mode === 'edit' ? editor.task.id : 'create'}
          initialTask={editor.mode === 'edit' ? editor.task : undefined}
          onSubmit={editor.mode === 'edit' ? handleUpdate : handleCreate}
          onCancel={() => setEditor(null)}
        />
      )}

      <div className="board-columns">
        {TASK_STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            onEdit={(task) => setEditor({ mode: 'edit', task })}
            onDelete={setPendingDelete}
            onMove={handleMove}
            onDropTask={handleMove}
          />
        ))}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          task={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}
