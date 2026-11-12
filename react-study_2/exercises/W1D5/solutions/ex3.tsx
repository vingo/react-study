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
      return [...tasks, action.task]
    case 'toggled':
      return tasks.map((task) =>
        task.id === action.id ? { ...task, done: !task.done } : task,
      )
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
  return <button onClick={() => dispatch({
    type: 'added', task: { id: 'write', text: '写练习', done: false },
  })}>新增练习</button>
}

export default function TaskApp() {
  return <TasksProvider><TaskList /><AddTaskButton /></TasksProvider>
}
