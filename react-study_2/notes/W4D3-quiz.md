# W4D3 课前测验：Server Actions

先独立作答，不查资料、不运行代码；把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W4D3.md`，做完前不要打开。

本卷共 9 分：2 道复习题（各 0.5 分），3 道新主题题（3 + 2.5 + 2.5 分）。以 React 19.3、react-dom 19.3 与 Next.js 16 的当前文档为准。练习环境**没有安装 Next.js**，涉及框架的题目按“真实 Next.js 项目”作答，不要假设本机运行结果。安全公告只写你确定的内容；不确定编号就写影响类型和防护原则，不要编造。

## 复习 1：useActionState 与 useFormStatus（0.5 分｜来自 W2D1）

```tsx
function SaveButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? '保存中…' : '保存'}</button>
}

function CardForm() {
  const [state, isPending, formAction] = useActionState(saveCard, { error: null })
  const { pending } = useFormStatus()

  return (
    <form action={formAction}>
      <input name="title" />
      <SaveButton />
      <button disabled={pending}>外层按钮</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}

async function saveCard(formData: FormData) {
  // ...
}
```

1. `useActionState` 的返回顺序哪里错了？`saveCard` 实际收到的第一个参数是什么？正确签名应该是什么？
2. `SaveButton` 和 `CardForm` 里的 `pending` 哪一个可靠？提交期间「外层按钮」会不会被禁用？为什么？

**你的答案：**

## 复习 2：路由 action 的校验与 redirect（0.5 分｜来自 W2D4）

```tsx
export async function createTaskAction({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const title = String(form.get('title') ?? '').trim()

  if (!title) {
    return data({ errors: { title: '标题不能为空' } }, { status: 400 })
  }

  const task = await api.createTask({ title })
  return redirect(`/tasks/${task.id}`)
}
```

1. 校验失败为什么返回 `data(..., { status: 400 })`，而不是返回普通对象？错误在组件里怎么读回？
2. 成功路径为什么 `return redirect(...)`，而不是返回 `task`？这和 Server Action 里的 `redirect` 有什么共同点？

**你的答案：**

## 第 1 题：一个“看起来能跑”的 Server Action（3 分）

```tsx
'use client'

export function CardForm({ card }: { card: Card }) {
  const [state, action, pending] = useActionState(updateCard, { error: null })

  return (
    <form action={action}>
      <input type="hidden" name="cardId" value={card.id} />
      <input type="hidden" name="assignee" value={card.assignee} />
      <input name="title" defaultValue={card.title} />
      <select name="status" defaultValue={card.status}>
        <option value="todo">待办</option>
        <option value="doing">进行中</option>
        <option value="done">完成</option>
      </select>
      <button disabled={pending}>{pending ? '保存中…' : '保存'}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
```

```ts
'use server'

import { db } from '@/lib/db'

export async function updateCard(prevState: unknown, formData: FormData) {
  const cardId = String(formData.get('cardId'))
  const title = formData.get('title') as string
  const status = formData.get('status') as 'todo' | 'doing' | 'done'
  const assignee = String(formData.get('assignee'))

  const card = await db.card.update({
    where: { id: cardId },
    data: { title, status, assignee },
  })

  return { error: null, card }
}
```

1. 列出这个 action 至少 4 个安全或正确性问题，并说明攻击者/用户如何触发（提示：session、权限、隐藏字段、输入类型、返回值、缓存）。
2. 写出正确的服务端核心流程（TS 伪代码即可）：session 从哪里来、如何解析和校验 `FormData`、如何做授权/所有权检查、成功后做什么、校验失败返回什么。
3. 这个 action 的参数和返回值里，哪些值能跨 Server Action 的序列化边界？`card` 应该原样返回吗？应该返回什么？
4. 前端 `pending` 和 `disabled` 能否作为安全边界？为什么？

**你的答案：**

## 第 2 题：公开端点与越权（2.5 分）

```ts
'use server'

export async function moveCard(formData: FormData) {
  const session = await auth()
  if (!session?.user) {
    return { error: 'UNAUTHENTICATED' }
  }

  const cardId = String(formData.get('cardId'))
  const projectId = String(formData.get('projectId')) // 隐藏字段
  const assignee = String(formData.get('assignee'))   // 隐藏字段
  const status = String(formData.get('status'))

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) {
    return { error: 'NOT_FOUND' }
  }

  await db.card.update({
    where: { id: cardId },
    data: { assignee, status },
  })

  return { ok: true }
}
```

团队的说法：

- “按钮只给项目成员渲染，viewer 的按钮是 disabled，所以不用在 action 里再查。”
- “`projectId` 和 `assignee` 是隐藏字段，用户看不到，不会被改。”
- “Next.js 已经做了 CSRF 校验，所以这个 action 是安全的。”

1. 为什么 Server Action 是公开端点？这段代码缺少哪些认证/授权检查？解释 IDOR，以及“隐藏字段”“disabled 按钮”“页面级检查”为什么都不是安全边界。
2. 写出授权核心：session 从哪里读、如何确认卡属于该项目、如何确认当前用户是成员/有权限、哪些字段允许客户端提交、失败时对 store/数据库的要求。
3. Next.js 内建的 CSRF/Origin 校验、POST 限制、1MB body limit、加密 action ID 各能防什么？它们不能替代什么？再补两条这个 action 还应做的防护（rate limit、错误信息等）。

**你的答案：**

## 第 3 题：缓存失效、redirect 与三个 Hook（2.5 分）

```ts
'use server'

export async function updateCard(_prev: unknown, formData: FormData) {
  const cardId = String(formData.get('cardId') ?? '')
  await db.card.update({ where: { id: cardId }, data: { title: '新标题' } })

  revalidateTag('cards')
  redirect('/board')
}
```

```tsx
'use client'

const [state, formAction, isPending] = useActionState(updateCard, initialState)
const [optimisticCards, moveOptimistic] = useOptimistic(cards, reducer)
```

1. Next.js 16 里 `revalidateTag` 的签名是什么？`revalidateTag('cards')` 有什么问题？`revalidateTag(tag, 'max')`、`updateTag(tag)`、`revalidatePath(path)`、`refresh()` 分别适合什么场景？用户必须立刻看到自己的修改时选哪个？
2. `redirect` 在 Server Action 里是普通返回值还是控制流异常？为什么不能包在 `try/catch` 里？`revalidateTag` / `revalidatePath` 应该放在 `redirect` 之前还是之后？如果反过来会怎样？
3. `useActionState`、`useFormStatus`、`useOptimistic` 在这个更新流程里各自负责什么？`useOptimistic` 的 reducer 必须满足什么条件？action 失败时乐观层会怎样？`useFormStatus` 必须放在哪里？
4. 2025-12 起 React/Next.js 公布了 RSC/Server Actions 相关的安全公告。至少说出一个你能确定的 CVE 编号及其影响类型，并写出两条工程动作。若记不清编号，就写影响类型和防护原则，不要编造。

**你的答案：**
