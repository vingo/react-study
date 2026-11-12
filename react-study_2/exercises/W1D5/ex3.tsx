// 练习 3：Reducer + Context（20 分钟）
// 完成 reducer 的 added、toggled 分支。不要修改传入的数组或 task。
// state 和 dispatch 已通过两个 React 19 Context 提供；理解为何读取 state 和只 dispatch 的组件可分开消费。

import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useReducer,
} from 'react'

type Task = { id: string; text: string; done: boolean }
type Action =
  | { type: 'added'; task: Task }
  | { type: 'toggled'; id: string }

const initialTasks: Task[] = [{ id: 'read', text: '阅读 React', done: false }]

function tasksReducer(tasks: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'added':
      return [...tasks, {id: action.task.id, text: action.task.text, done: action.task.done}]
    case 'toggled':
      return tasks.map(task => task.id === action.id ? {...task, done: !task.done} : task) // TODO：返回新数组；只复制指定 task 并切换 done
    default:
      return tasks
  }
}

const TasksContext = createContext<Task[] | null>(null)
const TasksDispatchContext = createContext<Dispatch<Action> | null>(null)

function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks)
  return (
    <TasksContext value={tasks}>
      <TasksDispatchContext value={dispatch}>{children}</TasksDispatchContext>
    </TasksContext>
  )
}

function useTasks() {
  const tasks = useContext(TasksContext)
  if (tasks === null) throw new Error('useTasks 必须在 TasksProvider 内使用')
  return tasks
}

function useTasksDispatch() {
  const dispatch = useContext(TasksDispatchContext)
  if (dispatch === null) throw new Error('useTasksDispatch 必须在 TasksProvider 内使用')
  return dispatch
}

function TaskList() {
  const tasks = useTasks()
  const dispatch = useTasksDispatch()
  return <ul>{tasks.map((task) => (
    <li key={task.id}>
      <button
        aria-pressed={task.done}
        onClick={() => dispatch({ type: 'toggled', id: task.id })}
      >
        {task.done ? `完成：${task.text}` : `待办：${task.text}`}
      </button>
    </li>
  ))}</ul>
}

function AddTaskButton() {
  const dispatch = useTasksDispatch()
  function addTask() {
    // 在事件处理函数中构造 action；不要把随机 ID 放入 reducer。
    dispatch({ type: 'added', task: { id: 'write', text: '写练习', done: false } })
  }
  return <button onClick={addTask}>新增练习</button>
}

export default function TaskApp() {
  return <TasksProvider><TaskList /><AddTaskButton /></TasksProvider>
}
