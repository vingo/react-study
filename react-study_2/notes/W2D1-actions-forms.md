# W2D1：Actions 与表单

> **备注：重点**
>
> 以 React 19.3 / react-dom 19.3 为准。Vite 客户端项目里的 action 都是客户端函数；
> Server Action 只点边界，第 4 周 Next.js 再展开。

## 一句话结论

React 19 把表单提交从“受控 state + onSubmit”改成“函数 action + transition”：`<form action={fn}>`
自动把 `FormData` 传给 `fn`、自动进入 transition、成功后重置非受控字段；要结果状态用
`useActionState`，要按钮 pending 用 `useFormStatus`，要即时反馈用 `useOptimistic`。

## 心智模型

```text
用户提交 <form action={fn}>
          │
          ▼
React 自动 startTransition
          │
          ├─ fn(formData) 开始执行
          │    ├─ 子组件 useFormStatus → pending = true
          │    └─ useOptimistic → 先显示“预期结果”
          │
          ├─ 成功：真实 state 更新；非受控字段重置为 defaultValue
          │        optimistic 与真实值在同一 render 对齐
          │
          └─ 抛错：取消排队 action → 最近 Error Boundary
                   optimistic 回到真实值（回滚）
          ▼
transition 结束 → pending = false
```

记住有“两层状态”：真实 state 是唯一真相；optimistic state 只是 action 期间的临时覆盖层。
action 结束后临时层自动消失，不会再多一次“清理 render”。

## 要点

### 1. `<form action={fn}>`：函数 action 接收 FormData

```tsx
function SearchForm() {
  async function search(formData: FormData) {
    const query = String(formData.get('query') ?? '')
    await new Promise((r) => setTimeout(r, 800)) // 假装请求
    console.log('搜索：', query)
  }
  return (
    <form action={search}>
      <input name="query" defaultValue="react" />
      <button type="submit">搜索</button>
    </form>
  )
}
```

`action` 也可以是 URL 字符串，此时是原生 HTML 表单提交；只有传函数才进入 React 的 Action 流程。
只有带 `name` 的控件才会进入 `FormData`；`get()` 返回 `string | File | null`，数字要自己转换。
函数 action 由 React 在 transition 中调用，所以不需要 `onSubmit`、`e.preventDefault()` 或
`value/onChange`。成功后 React 重置**非受控**字段到它们的 `defaultValue`：上面的输入框会回到
`"react"`，不是清空；想清空就写 `defaultValue=""`。受控字段不归它管，见
[W1D4 受控与非受控](W1D4-refs-dom.md)。

### 2. `useActionState`：给 action 加结果状态

```tsx
type NameState = { error: string | null; name: string }
async function saveName(_prev: NameState, fd: FormData): Promise<NameState> {
  const name = String(fd.get('name') ?? '').trim()
  if (name.length < 3) return { error: '至少 3 个字符', name }
  await new Promise((r) => setTimeout(r, 600))
  return { error: null, name: '' }
}
function NameForm() {
  const [s, formAction, isPending] = useActionState(saveName, { error: null, name: '' })
  return <form action={formAction}>
    <input name="name" defaultValue={s.name} disabled={isPending} />
    <button disabled={isPending}>{isPending ? '保存中…' : '保存'}</button>
    {s.error && <p role="alert">{s.error}</p>}
  </form>
}
```

签名是 `(prevState, formData) => nextState`，返回 `[state, formAction, isPending]`。`initialState`
只在第一次 dispatch 之前生效，之后 `prevState` 是上一次的返回值；返回类型必须与初始值一致。它像
`useReducer`，但允许副作用和 async，StrictMode 不会双调用；纯 UI 状态仍用 `useReducer`
（见 [W1D5](W1D5-composition-context.md)）。官方文档现在把第二个返回值叫 `dispatchAction`，
传给 `<form action>` 时习惯命名 `formAction`，名字不影响行为。

预期内的校验错误应当**返回**成 state，而不是抛错。注意：action 只要没有抛错就算“成功”，即使它
返回了错误，表单也会重置，所以这里把 `name` 一并返回并塞回 `defaultValue`，才能保住用户输入。
多个 `formAction` 调用会排队串行执行，前一次结果作为后一次的 `prevState`；连点 4 次各 1 秒的请求
就要约 4 秒，想立即反馈应配合 `useOptimistic`。第三个参数 `permalink` 只用于 Server Function 的
渐进增强，页面可交互后就不起作用。注意：表单重置的是字段，不是 `useActionState` 的 state；
要重置 state，需在 action 里返回初始值，或给使用它的组件换一个 `key` 重新挂载。

### 3. 非表单场景：用 `startTransition` 调用 action

```tsx
function LoadMore() {
  const [page, loadMore, isPending] = useActionState(
    async (prev: number) => {
      await new Promise((r) => setTimeout(r, 500))
      return prev + 1
    },
    1,
  )
  return (
    <button disabled={isPending} onClick={() => startTransition(() => loadMore())}>
      第 {page} 页{isPending && '（加载中…）'}
    </button>
  )
}
```

action 的第二个参数是 dispatch 时传入的任意 payload，非表单时不必是 `FormData`。`formAction`
必须从 Action 里调用：要么传给 `<form action>` / 组件的 `action` prop（React 自动包
transition），要么自己用 `startTransition` 包住。直接在 `onClick` 里调用会触发开发期错误
“An async function with useActionState was called outside of a transition”，而且 `isPending`
不会可靠更新。

### 4. `useFormStatus`：必须从 `<form>` 的子组件里调用

```tsx
import { useFormStatus } from 'react-dom'
function SubmitButton() {
  const { pending, data } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? `提交 ${String(data?.get('email') ?? '')}…` : '提交'}
    </button>
  )
}
function SignupForm() {
  async function signup(_fd: FormData) {
    await new Promise((r) => setTimeout(r, 800))
  }
  return <form action={signup}><input name="email" /><SubmitButton /></form>
}
```

返回 `{ pending, data, method, action }`：`pending` 是父级表单是否正在提交；`data` 是本次提交的
`FormData`（没有活动提交时为 `null`）；`method` 是 `'get' | 'post'`；`action` 是父级 `<form>`
收到的函数引用（URL action 或没有 action 时为 `null`）。函数 action 的实际 HTTP 方法是 `POST`。

它读取的是**祖先** `<form>` 提供的状态。若在渲染 `<form>` 的同一个组件里调用，hook 执行时这个
form 还只是“将要返回的 JSX”，不是祖先，所以 `pending` 永远不会变 true；即使外面还有一层 form，
它跟踪的也是外面那层，而不是本组件渲染的这层。把它抽成 `<SubmitButton />` 放进 form 内即可。

### 5. `useOptimistic`：action 期间的临时覆盖层

```tsx
type Todo = { id: string; text: string; sending?: boolean }
function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [optimistic, addOptimistic] = useOptimistic(todos, (cur: Todo[], t: Todo) => [...cur, { ...t, sending: true }])
  async function formAction(fd: FormData) {
    const todo = { id: crypto.randomUUID(), text: String(fd.get('text') ?? '') }
    addOptimistic(todo) // form action 已在 transition 内，无需再包
    await new Promise((r) => setTimeout(r, 800))
    startTransition(() => setTodos((prev) => [...prev, todo]))
  }
  return <>
    <ul>{optimistic.map((t) => <li key={t.id}>{t.text}{t.sending && '…'}</li>)}</ul>
    <form action={formAction}><input name="text" /><button>添加</button></form>
  </>
}
```

`useOptimistic(value, updateFn)` 的 `value` 是真实值；`updateFn(currentState, actionPayload)` 只在
pending 期间参与计算。没有 pending 时 `optimistic === value`。如果真实 `todos` 在请求期间变了，
React 会用最新的 `todos` 重新执行 `updateFn`，所以它必须是**纯函数**：不能改参数、不能生成随机
ID、不能读时间；ID 在 action 里生成后传进去。

`addOptimistic` 只能从 action 或 `startTransition` 中调用，且不能写在 render 里。放在普通
`onClick` 里开发期会警告，乐观值闪一下就回退。action 成功且真实 state 已更新时，两层在同一
render 对齐；action 失败且真实 state 没变时，乐观层消失，UI 自动回滚到更新前的样子（可在 action
里 `catch` 后展示错误）。另外，`await` 之后再 `setTodos` 目前仍需再包一层 `startTransition`，
这是文档明确要求的。

### 6. 按钮级 `formAction` 与 `requestFormReset`

```tsx
function ArticleForm() {
  async function publish(fd: FormData) { console.log('发布', fd.get('content')) }
  async function saveDraft(fd: FormData) { console.log('草稿', fd.get('content')) }
  return (
    <form action={publish}>
      <textarea name="content" defaultValue="未命名" />
      <button type="submit">发布</button>
      <button type="submit" name="intent" value="draft" formAction={saveDraft}>存草稿</button>
    </form>
  )
}
```

`formAction` 只覆盖“这个按钮”提交时使用的 action；没有它的提交按钮仍走 form 的 `action`。两者
拿到的 `FormData` 相同，而且触发提交的按钮自身 `name/value` 也会被包含（上面会多出
`intent=draft`）。每次函数 action 成功，React 仍会重置该表单的非受控字段。

如果不用 `action`，而是自己写 `onSubmit` + `startTransition`，React 不会自动重置；可在 transition
内调用 `requestFormReset(form)` 获得同样的行为。它只接受 React 渲染的 form；受控字段仍需自己
更新 state 或在 `onReset` 里处理。

### 7. 与传统 `onSubmit + useState` 的对比与选型

```tsx
function LegacyForm() {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try { await new Promise((r) => setTimeout(r, 600)) } finally { setSaving(false) }
  }
  return (
    <form onSubmit={onSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <button disabled={saving}>{saving ? '保存中…' : '保存'}</button>
    </form>
  )
}
```

传统写法并非“错”，它给你完全控制，也适合需要逐字符校验的受控输入；代价是 pending、FormData、
重置、错误处理都要手写。选型可以记成：

| 场景 | 建议 |
|---|---|
| 纯本地、同步完成、无 pending | `onSubmit + useState` 足够 |
| 异步提交，需要 pending / 错误 / 自动重置 | `<form action>` + `useActionState` |
| 一个表单多个提交意图 | 按钮级 `formAction` |
| 需要立即反馈、失败可回滚 | `useOptimistic` |
| 服务端缓存、失效、重试 | TanStack Query（W2D3） |

action 表单里仍可使用受控字段做实时校验，只是要记住“自动重置只作用于非受控字段”。

### 8. action 抛错、错误边界与 pending 复位

```tsx
import { ErrorBoundary } from 'react-error-boundary'

function TaskForm() {
  async function save(fd: FormData) {
    const res = await fetch('/api/tasks', { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`保存失败：${res.status}`) // 未预期错误
  }
  return (
    <ErrorBoundary fallback={<p>提交失败，请重试</p>}>
      <form action={save}><input name="title" /><button>保存</button></form>
    </ErrorBoundary>
  )
}
```

这里的 `ErrorBoundary` 可来自 `react-error-boundary`，也可换成项目自己的边界组件。action 抛出的
错误会传播到最近的 Error Boundary；`useActionState` 还会取消所有排队中的 action。
区分两类错误：**预期内**的校验/业务错误应返回成 state，让表单继续可用；**未预期**的异常才 throw。
错误边界一旦展示 fallback，会卸载表单子树，用户输入随之丢失，点“重试”重置边界后是全新挂载。

pending 不会永久卡住：transition 以成功或失败结束，`isPending` 都会回到 false。但如果边界已经
把组件卸载，pending 也就没有意义了。想让用户改完再提交，优先在 action 内 `catch` 并返回错误 state，
而不是抛给边界。

### 9. 客户端 action 与 Server Action 的边界

```tsx
'use server'
export async function createTask(formData: FormData) {
  const title = String(formData.get('title') ?? '')
  if (!title) return { error: '标题必填' }
  // 在服务器重新校验权限、写数据库
  return { error: null }
}
```

普通函数写在客户端组件里，就在浏览器执行，可以闭包读取 props/state；标了 `'use server'` 的函数
在服务器执行，只接收可序列化的参数和 `FormData`，不能闭包客户端变量。使用 Server Function 时，
`initialState`、action 参数和返回值也都要可序列化。Server Action 必须自己做输入校验和鉴权，
不能信任 `FormData`；`permalink` 和“JS 加载前也能提交”的渐进增强也只适用于
它。Vite 纯客户端项目里没有 Server Action，以上都按客户端 action 理解；Next.js 16 的细节第 4 周讲。

## 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| 在渲染 `<form>` 的同一组件里 `useFormStatus()` | 抽成 form 的子组件 | hook 只读取祖先 form，同组件渲染的 form 不是祖先，pending 永远不可靠 |
| `onClick={() => formAction()}` | `startTransition(() => formAction())` 或传给 `action` | 不在 transition 中，开发期报错且 `isPending` 不更新 |
| `useActionState((formData) => ...)` | `(prevState, formData) => ...` | 第一个参数被前一次 state 占用，FormData 在第二位 |
| 在 `useOptimistic` 的 reducer 里 `crypto.randomUUID()` | 在 action 里生成 ID 再传入 | reducer 可能用最新真实值重跑，必须纯；随机值会破坏身份与可预测性 |
| 在普通 `onClick` 里 `addOptimistic(x)` | 放进 action 或 `startTransition` | 没有 transition 托住临时层，会先闪一下再回退 |
| 校验失败时 `throw new Error(...)` | `return { error }` 错误状态 | 抛错会进 Error Boundary 并卸载表单，用户输入丢失 |
| 期望受控 input 被 action 自动重置 | 用 `defaultValue` 的非受控字段，或自己重置 state | 自动重置只处理非受控字段 |
| 自己写 `onSubmit` 却等 React 自动重置 | 在 transition 内 `requestFormReset(form)` | `onSubmit` 路径不会自动重置 |
| action 成功后不更新真实 state，只靠乐观值 | 成功后更新真实 `todos` 等 | 乐观值是临时的，transition 结束就回到真实值 |

## 三句话自测

1. `<form action={fn}>` 的函数 action 接收 `FormData`、自动在 transition 中执行，并在成功后把非受控字段重置为 `defaultValue`；受控字段不受影响。
2. `useActionState` 的 action 签名是 `(prevState, formData) => nextState`，返回 `[state, formAction, isPending]`；非表单场景必须用 `startTransition` 调用 `formAction`，否则 pending 不可靠。
3. `useFormStatus` 只报告父级 `<form>` 的状态，必须放在渲染该 form 的子组件里；`useOptimistic` 的 reducer 必须纯，setter 只能在 action/transition 中调用，action 结束后乐观层会回滚或与真实 state 对齐。

## 官方阅读

- https://react.dev/reference/react-dom/components/form
- https://react.dev/reference/react/useActionState
- https://react.dev/reference/react/useOptimistic
