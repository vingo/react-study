// 参考答案 1：用稳定 id 作为 key
//
// index key 让 React 按“第几个位置”复用 fiber，重排/插入/删除后，
// 局部 state 会留在旧位置上。任务有稳定 id 时，key={task.id} 让同一个
// 任务在重排前后仍是同一个组件实例，state 自然跟着任务走。
//
// 注意：这里只改了 key。不要通过把 expanded / note 提升到父组件、
// 或把 state 塞进任务对象来“绕过”问题——那样并没有理解 key 的身份语义。

import { useRef, useState } from 'react'

export type QueueTask = {
  id: string
  title: string
}

const INITIAL_TASKS: QueueTask[] = [
  { id: 'task-a', title: '设计接口' },
  { id: 'task-b', title: '实现列表' },
  { id: 'task-c', title: '补充测试' },
]

type QueueItemProps = {
  task: QueueTask
  onMoveToTop: (id: string) => void
  onRemove: (id: string) => void
}

function QueueItem({ task, onMoveToTop, onRemove }: QueueItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')

  return (
    <li>
      <h3>{task.title}</h3>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? `收起 ${task.title}` : `展开 ${task.title}`}
      </button>

      {expanded && (
        <label>
          备注 {task.title}
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      )}

      <button type="button" onClick={() => onMoveToTop(task.id)}>
        置顶 {task.title}
      </button>
      <button type="button" onClick={() => onRemove(task.id)}>
        删除 {task.title}
      </button>
    </li>
  )
}

export function TaskQueue() {
  const [tasks, setTasks] = useState<QueueTask[]>(INITIAL_TASKS)
  const nextId = useRef(4)

  function moveToTop(id: string) {
    setTasks((current) => {
      const target = current.find((task) => task.id === id)
      if (!target) {
        return current
      }
      return [target, ...current.filter((task) => task.id !== id)]
    })
  }

  function remove(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  function insertAtTop() {
    const number = nextId.current
    nextId.current += 1
    setTasks((current) => [
      { id: `task-${number}`, title: `新任务 ${number}` },
      ...current,
    ])
  }

  return (
    <section aria-label="任务队列">
      <button type="button" onClick={insertAtTop}>
        插入新任务
      </button>

      <ul>
        {tasks.map((task) => (
          <QueueItem
            key={task.id}
            task={task}
            onMoveToTop={moveToTop}
            onRemove={remove}
          />
        ))}
      </ul>
    </section>
  )
}
