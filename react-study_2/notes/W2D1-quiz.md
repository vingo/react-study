# W2D1 课前测验：Actions 与表单

先独立作答，不查资料、不运行代码。把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W2D1.md`，做完前不要打开。

## 复习 1：切换联系人后草稿还在吗（1 分｜来自 W1D5 第 2 题）

```tsx
function Messenger({ contact }: { contact: Contact }) {
  return <Chat contact={contact} />
}

function Chat({ contact }: { contact: Contact }) {
  const [draft, setDraft] = useState('')
  return (
    <form action={sendMessage}>
      <p>收件人：{contact.name}</p>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} />
    </form>
  )
}
```

1. 在 Ada 的对话框输入 `hello`，切到 Grace，再切回 Ada。三个时刻草稿分别显示什么？为什么？
2. 要让每位联系人第一次打开时草稿都是空的，最小改动是什么？
3. 为什么不能写 `key={Math.random()}`？如果只想在「发送成功后」清空草稿，用 key 重置合适吗？

**你的答案：**
1:  hello， hello， hello
2: 给 form表单设置 key ={contract.name}
3: 设置为`key={Math.random()}` 每次render时都会重新渲染。


## 复习 2：提交表单应该放在 Effect 里吗（1 分｜来自 W1D3 第 1 题）

```tsx
function CommentForm() {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (submitted) {
      fetch('/api/comments', { method: 'POST', body: text })
    }
  }, [submitted])

  return (
    <form onSubmit={e => { e.preventDefault(); setSubmitted(true) }}>
      <textarea value={text} onChange={e => setText(e.target.value)} />
      <button>发送</button>
    </form>
  )
}
```

1. 第一次点击「发送」会发几次请求？
2. 修改文字后再次点击「发送」，会发生什么？为什么？
3. 这段提交逻辑应放在哪里？用 React 19 的 form action 写出核心改写（不必处理 pending 和错误）。
4. 用一句话说明 render、事件处理函数（或 action）与 Effect 的职责边界。

**你的答案：**
1: 0次
2: 修改文字后，点击提交因为 submtted是true，不会触发请求
3: 
4: 组件内的变化render， 内部的操作用事件处理，effect外部交互。

## 第 1 题：Action 的状态、pending 与排队（2 分）

```tsx
import { useActionState } from 'react'

type State = { count: number; message: string }

async function increment(prev: State, formData: FormData): Promise<State> {
  const delta = Number(formData.get('delta'))
  await new Promise(resolve => setTimeout(resolve, 1000))
  return { count: prev.count + delta, message: `+${delta}` }
}

function CounterForm() {
  const [state, formAction, isPending] = useActionState(increment, {
    count: 0,
    message: '',
  })

  return (
    <form action={formAction}>
      <input name="delta" defaultValue="2" />
      <button disabled={isPending}>{isPending ? '提交中…' : '提交'}</button>
      <p>{state.count} {state.message}</p>
    </form>
  )
}
```

假设两次提交时输入框的值都是 `2`；第 2 问中两次 dispatch 都成功触发（例如双击发生在按钮禁用生效之前）。

1. 点击提交后、`await` 尚未结束时，`state` 和 `isPending` 各是什么？按钮文字和段落文字是什么？`increment` 这次被调用时收到的两个实参是什么？
2. 不等第一次结束，再快速点击一次提交。两次 `increment` 调用中的 `prev` 分别是什么？最终 `state.count` 和 `state.message` 是多少？React 是并发执行还是排队执行？
3. 有人写成 `const [state, isPending, formAction] = useActionState(...)`。运行后按钮会怎样？正确的返回顺序是什么？`useActionState` 的**第三个参数**又是什么？

**你的答案：**


## 第 2 题：提交按钮为什么一直可点（2 分）

```tsx
import { useFormStatus } from 'react-dom'

async function save(formData: FormData) {
  await new Promise(resolve => setTimeout(resolve, 1000))
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? '保存中…' : '保存'}
    </button>
  )
}

function ProfileForm() {
  const { pending, data } = useFormStatus()
  const [nickname, setNickname] = useState('')

  return (
    <form action={save}>
      <input
        name="nickname"
        value={nickname}
        onChange={e => setNickname(e.target.value)}
      />
      <SaveButton />
      <button type="submit" disabled={pending}>外层保存按钮</button>
      {pending && <p>正在提交：{String(data?.get('nickname'))}</p>}
    </form>
  )
}
```

用户输入昵称并点击「保存」。

1. 两个按钮中哪一个会在提交期间禁用？「外层保存按钮」会禁用吗？为什么？
2. `ProfileForm` 里的 `pending` 和 `data` 实际是什么值？会报错吗？
3. 如何用最小改动让页面上的提示文字和「外层保存按钮」也反映提交状态？解释这个 Hook 的作用范围：它能读到哪一层 form 的状态，哪些 form 的状态读不到。
4. 在 `SaveButton` 中，提交期间 `data.get('nickname')` 能拿到什么？用户在提交期间继续修改输入框，`data` 会跟着变吗？

**你的答案：**


## 第 3 题：乐观列表的约束与撤销时机（3 分）

```tsx
type Todo = { id: string; text: string }

function TodoList({ todos, createTodo }: {
  todos: Todo[]
  createTodo: (text: string) => Promise<void>
}) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (current: Todo[], text: string) => {
      current.push({ id: crypto.randomUUID(), text })
      return current
    }
  )

  async function handleSubmit(formData: FormData) {
    const text = String(formData.get('text'))
    addOptimisticTodo(text)
    await createTodo(text) // 可能成功，也可能 reject
  }

  return (
    <form action={handleSubmit}>
      <input name="text" />
      <button type="submit">添加</button>
      <ul>
        {optimisticTodos.map(todo => <li key={todo.id}>{todo.text}</li>)}
      </ul>
    </form>
  )
}
```

1. 这个更新函数违反了哪些规则？在开发环境的 StrictMode 或 React 重放该函数时，可能出现什么症状？写出修正后的写法（ID 应该在哪里生成？）。
2. 用户提交后、`await` 尚未结束时，列表会怎样？如果 `createTodo` reject，乐观条目什么时候消失？这是 reject 时 React 主动「回滚」，还是另有原因？
3. 如果 `createTodo` resolve 了，但父组件把真实 `todos` 更新到界面还要 500ms，列表会怎样？如何避免这种闪烁？
4. 如果 `addOptimisticTodo` 在一个既没有 `startTransition`、也不属于任何 action 的普通 `setTimeout` 回调里调用，会发生什么？

**你的答案：**
