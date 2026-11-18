// 练习 1：修复 index key 导致的状态错位（15 分钟）
//
// 现象：任务队列里每一行都有自己的局部 state（展开/收起 + 备注草稿）。
// - 把“实现列表”置顶后，展开状态和草稿留在了原来的行号上；
// - 删除“设计接口”后，草稿跑到了“补充测试”那一行；
// - 在顶部插入新任务后，同样是第 2 行的草稿跑到了第 1 行。
//
// 原因：列表用数组下标作为 key。React 协调（reconcile）同层子节点时，
// 先按 key 匹配；index key 意味着“第 0 个还是第 0 个”，即使数据换了位置，
// React 也会复用旧 fiber，于是 fiber 上的局部 state 跟着“行号”走，而不是跟着任务走。
//
// 要求：
// 1. 用任务的稳定 id 作为 key，让 state 跟随任务本身。
// 2. 不要修改测试断言，不要改变按钮/输入框的可访问名称。
// 3. 不要把展开状态或草稿提升到父组件来绕过问题——本题要练的是 key 的身份语义。
//
// 提示：React 判断“是不是同一个组件实例”的依据是同层位置 + 组件类型 + key。
// 稳定 id key 会让重排变成“移动同一个实例”，index key 会让它变成
// “把新数据塞进旧位置”。

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
  // 这两个 state 属于“某一个任务行”，不应该属于“第几行”。
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
        {tasks.map((task, index) => (
          // BUG：用下标当 key。任务重排/插入/删除后，位置上的实例被复用，
          // 局部 state（展开、草稿）留在旧行号上。
          // TODO：改成任务自己的稳定 id。
          <QueueItem
            key={index}
            task={task}
            onMoveToTop={moveToTop}
            onRemove={remove}
          />
        ))}
      </ul>
    </section>
  )
}
