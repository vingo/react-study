// 练习 1：修复 selector 订阅范围（15 分钟）
//
// 现象：
// 1. 点击“切换到深色”只改变 theme，任务数量没变，但“任务总数”组件仍然重渲染。
// 2. 重命名任务后列表应该更新，但数量没变，“任务总数”组件也白重渲染了一次。
//
// 原因：TaskCountBadge 用 `useTaskStore()` 订阅了整个 store。
// Zustand 5 在每次 setState 后都会把整个 state 交给订阅者；返回的 state 对象
// 引用变了，组件就会重渲染，哪怕它只用到 tasks.length。
//
// 要求：
// 1. 把 TaskCountBadge 改成窄 selector，只订阅 tasks 的长度（一个数字）。
// 2. 不要改变组件渲染的文本/可访问名称，也不要修改测试断言。
// 3. TaskList / ThemeToggle 的写法是对的，可以作为参考。
//
// 提示：selector 返回原始值（number/string/boolean）时，Zustand 用 Object.is
// 比较前后两次结果，值相同就不会通知组件。若一个组件确实要一次取多个字段，
// 可以用 `useShallow`（from 'zustand/react/shallow'）包住返回对象的 selector。

import { create } from 'zustand'

export type Task = {
  id: string
  title: string
  done: boolean
}

export type Theme = 'light' | 'dark'

export type TaskState = {
  tasks: Task[]
  theme: Theme
  toggleTheme: () => void
  renameTask: (id: string, title: string) => void
  addTask: (title: string) => void
}

function createInitialTasks(): Task[] {
  return [
    { id: 't1', title: '写周报', done: false },
    { id: 't2', title: '修复登录 bug', done: true },
  ]
}

export const useTaskStore = create<TaskState>()((set) => ({
  tasks: createInitialTasks(),
  theme: 'light',

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  renameTask: (id, title) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, title } : task,
      ),
    })),

  addTask: (title) =>
    set((state) => ({
      tasks: [
        ...state.tasks,
        { id: `t${state.tasks.length + 1}`, title, done: false },
      ],
    })),
}))

/** 测试用：恢复初始数据，避免用例之间互相污染。 */
export function resetTaskStore() {
  useTaskStore.setState({ tasks: createInitialTasks(), theme: 'light' })
}

export function TaskCountBadge() {
  // BUG：订阅了整个 store。theme 变化时 state 引用变化，这里就会重渲染。
  // TODO 1：改为只订阅任务数量。
  const state = useTaskStore((state) => state.tasks.length)


  return <p>任务总数：{state}</p>
}

export function TaskList() {
  const tasks = useTaskStore((state) => state.tasks)

  return (
    <ul aria-label="任务列表">
      {tasks.map((task) => (
        <li key={task.id}>
          {task.title}（{task.done ? '已完成' : '未完成'}）
        </li>
      ))}
    </ul>
  )
}

export function ThemeToggle() {
  const theme = useTaskStore((state) => state.theme)
  const toggleTheme = useTaskStore((state) => state.toggleTheme)

  return (
    <div>
      <p>当前主题：{theme === 'dark' ? '深色' : '浅色'}</p>
      <button type="button" onClick={toggleTheme}>
        {theme === 'dark' ? '切换到浅色' : '切换到深色'}
      </button>
    </div>
  )
}

export function TaskBoard() {
  return (
    <section aria-label="任务面板">
      <TaskCountBadge />
      <ThemeToggle />
      <TaskList />
    </section>
  )
}
