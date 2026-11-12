# W1D5：组件组合、状态提升、key、useReducer 与 Context

## 一句话结论
状态应放在需要协调它的组件的最近公共父级；先用显式 props 和 `children` 组合组件，复杂更新再用 `useReducer`，跨很多层都需要的数据才用 Context。

## 心智模型

```text
children / props：父组件明确地把数据和行为传给子组件

        Accordion
      activeId: 'account'       ← 唯一真相来源
        /          \
  Panel(account)  Panel(orders)
  isOpen=true     isOpen=false
  onShow ────────────────→ setActiveId(...)

key：同一个位置的“身份标签”
<Chat key="ada" /> → <Chat key="grace" />
     卸载旧 state       挂载新 state

reducer + Context：复杂状态在 Provider 中，远处组件读取 state / dispatch action
```

## 1. 用 `children` 组合，而不是堆积配置 prop

父组件嵌在标签内的 JSX 会作为 `children` 传给子组件。它适合卡片、布局、边框等“留一个洞给调用方填”的视觉容器。

```tsx
import type { ReactNode } from 'react'

type CardProps = { title: string; children: ReactNode }
function Card({ title, children }: CardProps) {
  return <section><h2>{title}</h2><div>{children}</div></section>
}

<Card title="账户"><Profile /><SecuritySettings /></Card>
```

不要把每一种内容都设计成 `leftIcon`、`body`、`footer`、`extra` 等越来越多的专用 prop。优先让调用方组合 JSX；确实需要命名插槽时再设计明确的 prop。

## 2. 状态提升：一个事实只存一处

当两个兄弟组件必须协调，例如手风琴只能打开一个面板，把各自的 `isOpen` 移到两者的最近公共父组件。父级保存最少状态 `activeId`，子级接收派生的 `isOpen` 和回调。

```tsx
function Accordion() {
  const [activeId, setActiveId] = useState<string | null>(null)
  return <>
    <Panel isOpen={activeId === 'account'} onShow={() => setActiveId('account')} />
    <Panel isOpen={activeId === 'orders'} onShow={() => setActiveId('orders')} />
  </>
}
```

这叫受控组件：父组件控制值，子组件通过回调请求改变。先找“需要同步变化的组件”的最近公共父级，不要急着用 Context。props 传两三层通常比隐藏的数据流更容易维护。

## 3. 用 key 有意重置 state

默认情况下，React 在相同树位置保留相同类型组件的 state。若切换收件人时草稿不能带到另一个人，给组件以收件人 ID 为 key：

```tsx
function Messenger({ contact }: { contact: Contact }) {
  return <Chat key={contact.id} contact={contact} />
}
```

key 改变会让 React 将整个子树看成新实例，卸载旧 `Chat` 并重置它和所有后代的 state。不要为“让组件重新渲染”而随机生成 key；随机 key 会使每次 render 都丢失 state 和 DOM。

## 4. useReducer：把“如何更新”从事件中抽离

当多个事件以不同方式更新同一复杂 state 时，reducer 把状态转换集中成纯函数。事件处理函数只描述发生了什么（action）。

```tsx
type Action =
  | { type: 'added'; id: string; text: string }
  | { type: 'deleted'; id: string }

type Task = { id: string; text: string }
function tasksReducer(tasks: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'added': return [...tasks, { id: action.id, text: action.text }]
    case 'deleted': return tasks.filter(task => task.id !== action.id)
    default: throw new Error(`未知 action: ${(action as { type: string }).type}`)
  }
}

const [tasks, dispatch] = useReducer(tasksReducer, [])
dispatch({ type: 'added', id: crypto.randomUUID(), text: '学习 React' })
```

reducer 和 state updater 一样，在 render 期间由 React 调用，因此必须是纯函数：不修改传入的 state，不请求、不写 storage、不生成随机 ID、不依赖当前时间。将 ID 在事件处理函数中生成后放进 action。

`useState` 适合独立、简单的更新；`useReducer` 适合许多事件共享同一复杂状态转换。不是所有 state 都该换 reducer。

## 5. Context：跨层共享，不是全局状态的默认方案

Context 解决 prop drilling。先创建 Context，Provider 提供值，后代用 `useContext` 读取：

```tsx
const TasksContext = createContext<Task[] | null>(null)
const TasksDispatchContext = createContext<Dispatch<Action> | null>(null)

function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, dispatch] = useReducer(tasksReducer, [])
  return <TasksContext value={tasks}>
    <TasksDispatchContext value={dispatch}>{children}</TasksDispatchContext>
  </TasksContext>
}
```

React 19 可写 `<TasksContext value={tasks}>`；旧的 `<TasksContext.Provider value={tasks}>` 仍可用，但未来会被弃用。把 state 与 dispatch 拆成两个 Context，可让只 dispatch 的组件不因 tasks 值变化而消费 state Context。Provider 的 `value` 改变时，所有消费该 Context 的后代会重新 render，`memo` 不能阻止新 context 值的接收。

为避免 Provider 缺失时的静默 `null` 错误，封装 Hook：

```tsx
function useTasks() {
  const tasks = useContext(TasksContext)
  if (tasks === null) throw new Error('useTasks 必须在 TasksProvider 内使用')
  return tasks
}
```

## 常见误区

| 误区 | 正确做法 |
|---|---|
| 兄弟组件各存一份互相矛盾的 `isOpen` | 提升为父级一个 `activeId` |
| 用 Context 取代所有 props | 局部显式 props 优先；深层共享或广泛消费再用 Context |
| reducer 里 `tasks.push(...)` 后返回 tasks | 返回新数组/对象，reducer 保持纯粹 |
| reducer 内 `crypto.randomUUID()` | 在事件处理函数生成 ID，放进 action |
| 为强制刷新写 `key={Math.random()}` | 仅在业务身份变化需要重置 state 时用稳定 key |
| Context 默认值用空数组，Provider 忘记包裹时悄悄显示空 UI | 用 `null` + 自定义 Hook 立即报错 |

## 三句话自测
1. 需要同步的兄弟组件共享的状态放在最近公共父级，父级作为唯一真相来源，子级通过 props 和回调受控。
2. key 是同级组件的身份，key 改变会卸载并重建该组件及其子树，因而重置 state。
3. reducer 是纯状态转换函数；Context 只解决跨层传递，复杂共享 state 常用 reducer + state/dispatch 两个 Context。

## 官方阅读
- https://react.dev/learn/passing-props-to-a-component
- https://react.dev/learn/sharing-state-between-components
- https://react.dev/learn/preserving-and-resetting-state
- https://react.dev/learn/extracting-state-logic-into-a-reducer
- https://react.dev/learn/passing-data-deeply-with-context
- https://react.dev/learn/scaling-up-with-reducer-and-context
