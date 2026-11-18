// 参考答案 2：loader 读 params/store，action 校验 + redirect
//
// - loader 在进入路由前执行，组件渲染时数据已经就绪，不需要在组件里 useEffect 取数；
// - loader 抛出 Response 会进入最近的 errorElement；
// - action 读取 FormData：校验失败返回普通对象（useActionData 可读），
//   成功返回 redirect()，Router 会导航并重新执行目标路由的 loader。

import {
  Form,
  Link,
  Outlet,
  isRouteErrorResponse,
  redirect,
  useActionData,
  useLoaderData,
  useParams,
  useRouteError,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router'

export type Task = {
  id: string
  title: string
  done: boolean
}

export type TaskStore = {
  tasks: Task[]
  nextId: number
}

export const DEFAULT_TASKS: Task[] = [
  { id: 't1', title: '写周报', done: false },
  { id: 't2', title: '修复登录 bug', done: true },
  { id: 't3', title: '评审 PR', done: false },
]

export function createTaskStore(initialTasks: Task[] = DEFAULT_TASKS): TaskStore {
  return {
    tasks: initialTasks.map((task) => ({ ...task })),
    nextId: 100 + initialTasks.length,
  }
}

export async function listTasks(store: TaskStore): Promise<Task[]> {
  return store.tasks.map((task) => ({ ...task }))
}

export async function loadTask(
  store: TaskStore,
  taskId: string | undefined,
): Promise<Task> {
  const task = store.tasks.find((item) => item.id === taskId)

  if (task === undefined) {
    throw new Response('Not Found', { status: 404 })
  }

  return { ...task }
}

export async function createTask(
  store: TaskStore,
  request: Request,
): Promise<{ error: string } | Response> {
  const formData = await request.formData()
  const title = String(formData.get('title') ?? '').trim()

  if (title === '') {
    return { error: '标题不能为空' }
  }

  store.tasks.push({ id: `t${store.nextId++}`, title, done: false })
  return redirect('/')
}

export function TasksLayout() {
  return (
    <div>
      <header>
        <h1>任务管理</h1>
        <nav aria-label="主导航">
          <Link to="/">列表</Link>
          <Link to="/tasks/new">新建任务</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export function TaskListPage() {
  const tasks = useLoaderData<Task[]>()

  return (
    <section aria-label="任务列表">
      <h2>任务列表</h2>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
            <span>{task.done ? '已完成' : '未完成'}</span>
          </li>
        ))}
      </ul>
      <Link to="/tasks/new">创建任务</Link>
    </section>
  )
}

export function TaskDetailPage() {
  const task = useLoaderData<Task>()

  return (
    <article aria-label="任务详情">
      <h2>{task.title}</h2>
      <p>状态：{task.done ? '已完成' : '未完成'}</p>
      <Link to="/">返回列表</Link>
    </article>
  )
}

export function NewTaskPage() {
  const actionData = useActionData<{ error?: string }>()

  return (
    <section aria-label="新建任务">
      <h2>新建任务</h2>
      <Form method="post">
        <label>
          任务标题
          <input name="title" />
        </label>
        <button type="submit">创建任务</button>
      </Form>
      {actionData?.error !== undefined && <p role="alert">{actionData.error}</p>}
    </section>
  )
}

export function TaskErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <p role="alert">任务不存在</p>
  }

  return <p role="alert">页面加载失败</p>
}

export function createAppRoutes(store: TaskStore): RouteObject[] {
  return [
    {
      path: '/',
      element: <TasksLayout />,
      children: [
        {
          index: true,
          element: <TaskListPage />,
          loader: () => listTasks(store),
        },
        {
          path: 'tasks/new',
          element: <NewTaskPage />,
          action: ({ request }: ActionFunctionArgs) => createTask(store, request),
        },
        {
          path: 'tasks/:taskId',
          element: <TaskDetailPage />,
          loader: ({ params }: LoaderFunctionArgs) => loadTask(store, params.taskId),
          errorElement: <TaskErrorBoundary />,
        },
      ],
    },
  ]
}
