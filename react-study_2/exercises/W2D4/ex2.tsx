// 练习 2：补全 loader 与 action（15 分钟）
//
// 现状：
// - 列表页的 loader 写死返回 DEFAULT_TASKS，完全不看传入的 store；
// - 详情页的 loader 没有读取 params.taskId，永远返回第一条任务；
// - 新建页的 action 读取了 FormData，但不校验空标题，成功后也不跳转。
//
// 要求：
// 1. listTasks：返回 store.tasks 的副本（不要返回同一个对象引用）。
// 2. loadTask：按 params.taskId 查找；找不到时
//    `throw new Response('Not Found', { status: 404 })`，由 errorElement 展示。
// 3. createTask：
//    - 读取 FormData 的 title 并 trim；
//    - 空标题时返回 `{ error: '标题不能为空' }`，页面用 useActionData 展示；
//    - 成功创建后 `return redirect('/')` 回到列表，列表 loader 会重新执行。
//
// 不要修改测试断言，也不要改变 store 的结构和路由路径。
// 提示：loader/action 的第二个参数里能拿到 params；action 的 request 是标准 Request，
// `await request.formData()` 读取 <Form method="post"> 提交的字段。

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

/** 每个测试创建自己的 store，避免用例之间共享可变数据。 */
export function createTaskStore(initialTasks: Task[] = DEFAULT_TASKS): TaskStore {
  return {
    tasks: initialTasks.map((task) => ({ ...task })),
    nextId: 100 + initialTasks.length,
  }
}

export async function listTasks(store: TaskStore): Promise<Task[]> {
  // TODO 1：返回 store.tasks 的副本，让列表反映 store 的真实内容。
  // void store
  return store.tasks.map((task) => ({ ...task }))
}

export async function loadTask(
  store: TaskStore,
  taskId: string | undefined,
): Promise<Task> {
  // TODO 2：按 taskId 在 store.tasks 中查找；找不到时抛出 404 Response。
  const taskInfo = store.tasks.find(task=> task.id === taskId) 
  if (!taskInfo){
    throw new Response('Not Found', { status: 404 })
  }
  return taskInfo
}

export async function createTask(
  store: TaskStore,
  request: Request,
): Promise<{ error: string } | Response | null> {
  const formData = await request.formData()
  const title = String(formData.get('title') ?? '').trim()

  // TODO 3a：trim；空标题返回 { error: '标题不能为空' }。
  if (!title) {
    return {
      error: '标题不能为空'
    }
  }
  // TODO 3b：成功后 redirect('/')，而不是留在新建页。
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
