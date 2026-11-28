# W4D3：Server Actions（Next.js 16 + React 19.3）

> 以 React 19.3 / react-dom 19.3、Next.js 16 的当前文档为准。承接
> [W2D1](W2D1-actions-forms.md) 的 `<form action>`、`useActionState`、
> `useFormStatus`、`useOptimistic`，这一课把执行位置换到服务器，重点讲
> **公开端点、校验、鉴权、缓存失效和安全边界**。
>
> 本练习环境**没有安装 Next.js 16**，也没有 RSC/Flight 运行时。`exercises/W4D3`
> 用纯 TypeScript 模拟 Server Action 的服务端核心，测试直接调用函数，不启动
> Next.js、不发真实网络请求。不要为了练习改共享配置或安装依赖。

## 1. 一句话结论

Server Action 是“被 React Action 机制调用的 Server Function”：客户端通过
action ID 发一个 POST（携带 `FormData` 或可序列化参数），服务器执行后把返回值
和（可选的）重新渲染的 RSC payload 放在同一个响应里；因此它首先是**一个任何人都
能直接 POST 的公开端点**，必须在函数内部重新做 session、权限、所有权和输入校验，
再用 `revalidatePath` / `revalidateTag` / `updateTag` 失效缓存，最后才
`redirect` 或返回结构化 state。

## 2. 心智模型

```text
客户端
  <form action={serverAction}>            // React 自动包 transition
  或 startTransition(() => serverAction(...))
        │
        │ 1. 编译期：'use server' 把函数替换成 action ID + dispatcher
        ▼
POST 到当前页面（FormData / 可序列化参数；有 Origin/Host 校验、1MB 限制）
        │
        ▼
服务端 action 内部（顺序不能省）
  session/auth()  →  解析 FormData  →  校验/类型转换
        →  查资源 + 鉴权/所有权（cardId 只作引用，其余字段一律不可信）
        →  写数据库（DAL）
        →  revalidatePath / revalidateTag / updateTag / refresh
        →  redirect(...)（抛控制流异常）或 return state
        │
        ▼
同一响应：
  action 返回值（useActionState 的 state）
  + 需要时重新渲染的当前路由 RSC payload
        │
        ▼
客户端提交新 UI；redirect 时导航到目标路由
```

三个容易混淆的边界：

1. **编译边界**：`'use server'` 让客户端 bundle 里只剩下引用，真正的实现留在
   服务器；但“不在客户端 bundle 里”不等于“别人调不到”。
2. **信任边界**：action 的参数和 `FormData` 全部由客户端控制；session 必须从
   cookie/header 读，不能从参数读。
3. **序列化边界**：跨网络只能传可序列化值；数据库行、类实例、函数、JSX 都不能
   原样返回。

## 3. 要点

### 3.1 `'use server'`：模块级与函数级

- 模块级：文件第一行写 `'use server'`，该文件的所有导出都成为 Server Function，
  可以被 Client Component 导入调用。只放 `async` 函数；同步函数不能作为
  Server Function 导出。
- 函数级：在 Server Component 里定义一个 `async function`，函数体第一行写
  `'use server'`，再作为 prop 传给 Client Component（或直接用在 `<form>` 上）。
  **不能在 Client Component 里定义 Server Function**，只能从 `'use server'`
  模块导入。
- 指令必须是函数/模块的第一条语句（前面只能有注释），用单引号或双引号，不能
  用反引号。`'use server'` 和 `'use client'` 一样是编译指令，不是普通字符串。
- Server Function 用于**变更**，不推荐当数据获取 API；框架通常按客户端串行
  派发 action（一次一个），不要用 `Promise.all` 并行调用多个 action。需要并行
  就在一个 action 内部并行，或改用 Route Handler / Server Component 取数。

```ts
// app/actions/cards.ts
'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { updateCardForUser } from '@/data/cards'
import { parseCardForm } from '@/lib/validation'

export async function updateCardAction(
  _prev: CardState,
  formData: FormData,
): Promise<CardState> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: 'UNAUTHENTICATED' }
  }

  const parsed = parseCardForm(formData)
  if (!parsed.ok) {
    return { ok: false, fieldErrors: parsed.fieldErrors }
  }

  const result = await updateCardForUser(session.user.id, parsed.data)
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  revalidatePath('/board')
  updateTag('cards') // 用户要立刻看到自己的写入；仅 Server Action 可用
  redirect(`/cards/${result.cardId}`) // throws；不要写在 try/catch 里
}
```

客户端只需要从 `'use server'` 模块导入 action，再交给
`useActionState` 或 `<form action>`：

```tsx
const [state, formAction, pending] = useActionState(updateCardAction, { ok: false })
return <form action={formAction}><input name="title" disabled={pending} />…</form>
```

隐藏 `cardId` 可以用于“指明操作哪条资源”，但它只是引用，不是权限：服务端必须
用 session 重新查这张卡是否属于当前用户/项目。`disabled={pending}` 只是防止
重复点击的 UX，不是安全边界。

### 3.2 FormData 与三个 Hook 的分工

`<form action={fn}>` 会自动把 `FormData` 作为第一个参数传给 `fn`，并在
transition 中执行；成功后 React 自动重置**非受控**字段。只有带 `name` 的控件
才会进入 `FormData`。`get()` 返回 `string | File | null`，数字、布尔、枚举都要
自己转换和校验；多值字段用 `getAll()`。

- **`useActionState(action, initialState)`**：返回
  `[state, dispatchAction, isPending]`。action 签名变成
  `(prevState, formData) => nextState`；`initialState` 只在第一次 dispatch 前
  生效。预期内的校验错误应**返回**成 state；未预期异常才 throw 到最近 Error
  Boundary。第三个参数 `permalink` 只用于 Server Function 的渐进增强。
- **`useFormStatus()`**：从 `react-dom` 导入，返回 `{ pending, data, method,
  action }`。它只能读取**祖先** `<form>` 的状态，必须放在渲染该 form 的子组件
  里；在渲染 form 的同一个组件里调用，`pending` 永远不会变 true。
- **`useOptimistic(value, reducer?)`**：在 action 期间提供临时覆盖层。setter
  只能在 action 或 `startTransition` 里调用；reducer 必须纯，不能生成随机 ID。
  action 成功且真实数据更新后，乐观层与真实值对齐；失败或没有真实更新时，临时
  层消失，UI 回到真实值。它不是“服务端已经成功”的证明。

```tsx
function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? '移动中…' : '移动'}</button>
}

function MoveForm({ card, cards }: { card: CardDTO; cards: CardDTO[] }) {
  const [optimisticCards, moveOptimistic] = useOptimistic(
    cards,
    (current, next: CardDTO) =>
      current.map((item) => (item.id === next.id ? next : item)),
  )
  async function formAction(formData: FormData) {
    moveOptimistic({ ...card, status: 'done' })
    await moveCardAction(formData) // Server Action 返回后真实数据会更新
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="cardId" value={card.id} />
      <SubmitButton />
    </form>
  )
}
```

服务端仍是唯一真相：成功时要在 action 里写库并让缓存失效/返回新数据；不要把
“乐观 UI 已经显示成功”当成业务成功。

### 3.3 校验：FormData 不是类型系统

客户端校验（`required`、`type="email"`、禁用按钮）只能改善体验，不能作为
服务端依据。服务端要把 `FormData` 当作 `unknown`：

```ts
type FieldErrors = Partial<Record<'title' | 'status' | 'assignee', string>>
const STATUSES = ['todo', 'doing', 'done'] as const
type CardStatus = (typeof STATUSES)[number]
const isStatus = (v: string): v is CardStatus =>
  (STATUSES as readonly string[]).includes(v)

function readString(fd: FormData, key: string): string | null | undefined {
  const value = fd.get(key)
  return value === null ? null : typeof value === 'string' ? value : undefined
}

export function parseCardForm(formData: FormData):
  | { ok: true; data: { title: string; status: CardStatus; assignee: string | null } }
  | { ok: false; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {}
  const titleRaw = readString(formData, 'title')
  let title = titleRaw?.trim() ?? ''
  if (titleRaw === undefined) fieldErrors.title = '标题格式不合法'
  else if (!title) fieldErrors.title = '标题必填'
  else if (title.length > 80) fieldErrors.title = '标题不能超过 80 个字符'

  const statusRaw = readString(formData, 'status')
  const status = statusRaw && isStatus(statusRaw) ? statusRaw : null
  if (!status) fieldErrors.status = '状态不合法'

  let assignee: string | null = null
  const assigneeRaw = readString(formData, 'assignee')
  if (assigneeRaw === undefined) fieldErrors.assignee = '负责人格式不合法'
  else if (assigneeRaw !== null) {
    assignee = assigneeRaw.trim() || null
    if (assignee && assignee.length > 40) {
      fieldErrors.assignee = '负责人不能超过 40 个字符'
    }
  }

  if (!status) return { ok: false, fieldErrors: { ...fieldErrors, status: '状态不合法' } }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors }
  return { ok: true, data: { title, status, assignee } }
}
```

关键点：

- `String(formData.get('title'))` 会把 `File` 变成 `"[object File]"`，也会把
  `null` 变成 `"null"`；必须先用 `typeof` 区分。
- 空字符串、纯空白、可选字段缺失是三种不同语义；空 assignee 应归一为 `null`，
  不是错误。
- 枚举必须白名单校验；`as CardStatus` 只是类型断言，运行时不会检查。
- 一次收集所有字段错误，返回结构化 state；不要在第一处错误就 throw，更不要把
  内部异常直接回给客户端。
- `Object.fromEntries(formData)` 很方便，但会把 `$ACTION_*` 等内部字段也带进来；
  不要直接展开进数据库 `data`，要显式挑选字段。
- 用 schema 库（Zod/Valibot）也可以，但库只解决“形状”，不解决“这个用户能不能
  改这条资源”。

### 3.4 鉴权/授权：action 是公开端点

Next.js 文档明确：Server Action 默认可以被直接 POST 调用，不经过你的 UI；页面级
的登录检查、条件渲染、隐藏按钮都不会延伸到 action。必须在**每个 action 内部**
重新验证。

```ts
'use server'

import { revalidateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const STATUSES = ['todo', 'doing', 'done'] as const

export async function moveCardAction(formData: FormData) {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: 'UNAUTHENTICATED' as const }
  }

  const cardId = formData.get('cardId')
  const toStatus = formData.get('toStatus')
  if (typeof cardId !== 'string' || typeof toStatus !== 'string' ||
      !(STATUSES as readonly string[]).includes(toStatus)) {
    return { ok: false as const, error: 'INVALID_INPUT' as const }
  }

  // 身份来自 session，资源归属来自数据库；不要相信隐藏的 projectId/ownerId。
  const card = await db.card.findFirst({
    where: {
      id: cardId,
      project: { members: { some: { userId: session.user.id } } },
    },
    select: { id: true, projectId: true, status: true },
  })
  if (!card) {
    return { ok: false as const, error: 'NOT_FOUND' as const }
  }

  await db.card.update({
    where: { id: card.id },
    data: { status: toStatus }, // 只改允许的字段；assignee 不由客户端决定
  })

  revalidateTag('cards', 'max')
  return { ok: true as const }
}
```

- **认证 vs 授权**：登录只回答“你是谁”；还要回答“你是否属于这个项目、是否有
  这个角色、是否拥有这条资源”。只查 `cardId` 不查归属，就是 IDOR。
- **隐藏字段不是权限**：攻击者可以改 `assignee`、`status`、`projectId`、
  `role`、`userId`。服务端只接受白名单字段；身份和归属从 session/数据库派生。
- **前端禁用不是权限**：`disabled`、`hidden`、不渲染按钮都只影响正常用户。
- **页面级检查不是权限**：在页面里 `redirect('/login')` 只决定渲染什么 UI；
  action 仍可被单独调用。
- **返回最小 DTO**：不要把整行数据库记录（含内部字段、token、软删除标记）返回
  给客户端；只返回 UI 需要的数据。
- **DAL**：把鉴权、授权、查询集中到 `server-only` 的 Data Access Layer；action
  保持薄，只做入口编排。敏感操作（删除、转账）可要求重新认证或更强校验，并在
  检查失败时大声失败。
- **rate limit**：发邮件、写库、调用外部付费 API 的 action 要限流；框架的
  body limit 不是业务限流。

### 3.5 变更后的缓存失效与 redirect

Next.js 16 当前文档里，action 成功后可以按“影响范围”选择：

| API | 作用域 | 行为 | 适用 |
|---|---|---|---|
| `revalidatePath(path, type?)` | 某个页面/布局/Route Handler | 立即失效该路径；Server Function 中会让当前 UI 立即更新，响应可带重新渲染的 RSC payload | 只影响一个路由 |
| `revalidateTag(tag, profile)` | 某个 cache tag | 标记为 stale；`'max'` 是 stale-while-revalidate，**不会**在 action 响应里立即重渲染 | 可接受短暂旧数据的跨页内容 |
| `updateTag(tag)` | 某个 cache tag | 立即过期，下一次读取等待新数据；**只能在 Server Action 里调用** | read-your-own-writes，用户必须立刻看到自己的修改 |
| `refresh()` | 当前路由 | 重新执行当前路由的动态工作，不失效服务端缓存 | 视图依赖缓存之外的状态 |

```ts
'use server'
import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function publishCard(formData: FormData) {
  const cardId = String(formData.get('cardId') ?? '')
  await db.card.update({ where: { id: cardId }, data: { published: true } })
  revalidatePath('/board') // 看板列表；也可用 updateTag('cards') 做 read-your-own-writes
  redirect('/board') // 放在失效之后；它 throws，后面的代码不执行
}
```

注意：

- Next.js 16 里 `revalidateTag` 的签名是 `revalidateTag(tag, profile)`；单参数
  `revalidateTag('cards')` 已弃用，不要再写。`profile` 可以是 `'max'`、其它
  `cacheLife` profile，或 `{ expire: number }`。
- `revalidateTag('cards', 'max')` 是“标脏 + 后台刷新”，**不会**把重新渲染的
  RSC payload 放进 action 响应；用户下一次读取可能先看到旧值。需要立即看到自己
  的写入时用 `updateTag`（仅 action）或 `revalidatePath`。
- tags 必须先被赋给缓存数据：`fetch(url, { next: { tags: ['cards'] } })`，或在
  `'use cache'` 函数里 `cacheTag('cards')`。没有赋过 tag 的 `revalidateTag`
  不会命中任何东西。
- `revalidatePath` 的 `path` 是路由文件结构，不是浏览器可见 URL；用了 rewrites
  时要传目标路径。动态段用 `/cards/[id]` + `type: 'page' | 'layout'`。
- `redirect` 在 Server Action 中**抛出**控制流异常（`NEXT_REDIRECT`），不是
  普通返回值；必须放在 `try/catch` 外面，并且用 `return redirect(...)` 或直接
  调用，让异常继续向上传播。把 `redirect` 包进 `try/catch` 会吞掉跳转。
- 先 `revalidate*` / `updateTag`，再 `redirect`；否则目标页面可能读到旧缓存。
  `redirect` 之后的代码不会执行。
- 有 JS 时 Server Action 里的 `redirect` 走客户端导航；渐进增强表单提交时用
  303，其它情况常用 307。默认在 Server Action 中使用 `push` 历史记录。

### 3.6 安全边界：框架做了什么、没做什么

Next.js 内建的保护（截至 Next.js 16 文档）：

- **只允许 POST**：action 用 POST 调用，降低被 GET 触发的风险。
- **CSRF/Origin 校验**：比较请求的 `Origin` 与 `Host`（或
  `X-Forwarded-Host`），不匹配就拒绝；代理/CDN 场景用
  `experimental.serverActions.allowedOrigins` 配置可信来源。注意：文档说明
  **没有 `Origin` 头的请求会跳过这个比较**，所以它是纵深防御，不是认证。
- **body 大小限制**：默认 1MB，可用
  `experimental.serverActions.bodySizeLimit` 调整；上传大文件要评估。
- **加密 action ID + dead code elimination**：构建期为使用中的 action 生成加密、
  非确定性的 ID；没被使用的 action 会从客户端 bundle 移除。ID 最多缓存 14 天，
  新构建会轮换；滚动发布时旧客户端可能遇到 “Failed to find Server Action”。
- **closure 加密**：内联 action 捕获的变量会加密后发给客户端再带回服务器；
  自托管多实例要设置稳定的 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`。但官方明确说
  **不要只依赖加密**来保护敏感值。

框架没做的：

- **认证/授权**：必须自己写，且写在 action 内。
- **输入校验**：`FormData`、header、searchParams 都不可信。
- **返回值裁剪**：返回值会序列化给客户端，只返回 UI 需要的 DTO。
- **rate limit / 幂等 / 重放防护**：按业务加，尤其是写库、发邮件、扣款。
- **错误信息脱敏**：不要把 SQL、堆栈、内部主机名、密钥拼进返回 state。
- **CSRF 之外的会话安全**：SameSite cookie、session 过期、权限变更都要考虑。

闭包捕获敏感值是常见坑：

```ts
const apiKey = process.env.BILLING_API_KEY // BAD：闭包捕获，会加密后发到客户端
const chargeBad = async (fd: FormData) => {
  'use server'
  await billing.charge(apiKey, String(fd.get('amount')))
}

async function chargeSafe(fd: FormData) {
  'use server'
  const key = process.env.BILLING_API_KEY // GOOD：服务端内部读取
  await billing.charge(key, String(fd.get('amount')))
}
```

序列化边界同样重要：跨网络只能传可序列化值（原始类型、数组、普通对象、`Date`、
`Map`/`Set`、`FormData`、Server Function 等）；不要返回类实例、函数、JSX、
未注册的 Symbol。返回数据库行之前先挑选字段，既避免泄露，也避免序列化失败。

预期内错误 vs 未预期错误：校验失败、无权限、资源不存在都属于预期内分支，返回
结构化 state；数据库断连、代码 bug 等未预期异常可以 catch 后返回
`{ ok:false, error:'INTERNAL' }`，原始错误只写服务端日志（`console.error`），
不要把 message 返回给客户端；也可以 throw 给 Error Boundary，但同样不要泄露
内部细节。

### 3.7 2025-12 起与 RSC / Server Actions 相关的安全公告

只写能从官方公告核实的内容，不猜测编号：

- **CVE-2025-55182（2025-12-03，CVSS 10.0）**：React Server Components 的
  Flight 反序列化缺陷，未认证攻击者可构造请求实现远程代码执行（RCE）。影响
  `react-server-dom-webpack`、`react-server-dom-parcel`、
  `react-server-dom-turbopack` 的 19.0、19.1.0、19.1.1、19.2.0；修复版本为
  19.0.1、19.1.2、19.2.1。即使用户没有显式实现 Server Function，只要应用支持
  RSC 也可能受影响。Next.js 侧有下游公告 **CVE-2025-66478**（App Router），
  修复版本包括 16.0.7 等；该 CVE 编号后来被标记为 CVE-2025-55182 的重复，
  升级时仍以 Next.js 官方公告为准。
- **CVE-2025-55184 / CVE-2025-67779（DoS，CVSS 7.5）**：特制请求可让 Server
  Function 反序列化时进入无限循环，拖垮进程。
- **CVE-2025-55183（源码暴露，CVSS 5.3）**：特制请求可能让 Server Function
  返回其它 Server Function 的编译后源码；硬编码在源码里的秘密可能暴露，运行时
  通过 `process.env` 读取的秘密不在该范围。
- 后续修复版本为 19.0.4、19.1.5、19.2.4；2026-01 又补充了
  **CVE-2026-23864**（DoS，CVSS 7.5）。版本会继续更新，升级时以 React 和
  Next.js 官方公告为准。

工程上的结论：

1. **RSC/Server Action 端点本身就是攻击面**，不是你“没写 action”就绝对安全；
   生产项目要跟框架和运行时版本，及时升级、重新部署。
2. **框架的 Origin 校验、action ID 加密不能替代补丁**；反序列化漏洞要在运行时/
   框架层修。
3. **不要把秘密硬编码在 Server Function 源码里**；用运行时环境变量/密钥管理，
   并在公告要求时轮换密钥。
4. 本练习环境没有 Next.js/RSC 服务器，这些特定服务端 CVE 不会在这里触发；但
   真实项目必须把“依赖版本 + 安全公告”纳入上线检查。

### 3.8 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| 只做客户端校验 | 服务端重新解析、校验、转换 | `FormData` 可被任意构造；客户端校验只是 UX |
| 用隐藏字段传 `assignee`/`role`/`projectId` 并直接写库 | 只接受白名单字段；身份/归属从 session + DB 派生 | 隐藏字段可被改；这是 IDOR/提权入口 |
| 只在页面里检查登录/角色，或把 `disabled` 当权限 | 每个 action 内重新 `auth()` + 授权/所有权检查 | action 是独立 POST 端点；按钮状态只影响正常用户 |
| 返回整行数据库记录 | 返回最小 DTO | 返回值会序列化到客户端，可能泄露内部字段 |
| 校验失败 `throw new Error(...)` | `return { ok:false, fieldErrors }` | 抛错会进 Error Boundary，表单被卸载、输入丢失 |
| 把 `redirect` 包在 `try/catch` 里 | `redirect` 放在 try/catch 外，`return redirect(...)` | 它靠抛异常跳转，catch 会吞掉 |
| 先 `redirect` 再 `revalidatePath` | 先失效缓存，再 redirect | redirect 后的代码不执行，目标页可能读旧缓存 |
| `revalidateTag('cards')` | `revalidateTag('cards', 'max')` 或 `updateTag('cards')` | Next.js 16 单参数形式已弃用 |
| 以为 `revalidateTag(..., 'max')` 会立即刷新 | 需要 read-your-own-writes 时用 `updateTag` / `revalidatePath` | `'max'` 是 SWR，action 响应不带立即重渲染 |
| `useActionState((formData) => ...)` | `(prevState, formData) => ...` | 第一个参数被上一次 state 占用 |
| 在渲染 `<form>` 的同一组件里 `useFormStatus()` | 抽成 form 的子组件 | 它只读取祖先 form，同组件渲染的 form 不是祖先 |
| 在 `useOptimistic` reducer 里生成随机 ID/改参数 | ID 在 action 里生成；reducer 保持纯 | reducer 可能用最新真实值重跑 |
| 在普通 `onClick` 里调用 `setOptimistic` | 放进 action 或 `startTransition` | 没有 transition 托住，乐观值会闪回 |
| 闭包捕获 API key 并依赖加密 | 在 Server Function 内部读环境变量 | 闭包变量会发送到客户端；加密不是安全边界 |
| 把 SQL/堆栈拼进错误 state | 返回安全错误码，服务端记录原始错误 | 错误信息会泄露内部结构 |
| 认为 Next.js 的 CSRF 校验够了 | 仍然做认证、授权、限流 | Origin 校验不是认证；无 Origin 请求会跳过比较 |

### 3.9 面试口径

**问：Server Action 和 API Route 有什么区别？** Server Action 是 React Action
机制调用的 Server Function，客户端拿到 action ID + dispatcher，POST 回当前页面；
适合表单变更，同一响应可带 action 返回值 + 重新渲染的 RSC payload，客户端串行
派发。API Route 是通用 HTTP 端点，适合公开 API、非 React 调用、并行请求和自定义
状态码。两者都要自己做认证、授权、校验和限流。

**问：一个 Server Action 至少要做哪些检查？** 参数全部不可信；从 cookie/header
读 session；按资源查 DB 做授权和所有权检查（不只是登录）；白名单解析 `FormData`
并做类型转换；只返回 UI 需要的 DTO；成功后按范围失效缓存；失败时不写库、不失效、
不跳转；错误脱敏；昂贵操作限流。隐藏字段、禁用按钮、页面级重定向都不算权限。

**问：校验失败怎么返回？** 返回结构化 state（如 `{ ok:false, fieldErrors }`），
由 `useActionState` 显示；不要 throw，否则会进 Error Boundary 并卸载表单。只有
未预期异常才 throw。要保留输入时把提交值一并返回并塞回 `defaultValue`，因为
action 没抛错时 React 会重置非受控字段。

**问：Next.js 16 缓存 API 怎么选？** 单路由用 `revalidatePath`；跨页、可接受
短暂旧数据用 `revalidateTag(tag, 'max')`；必须立刻看到自己的写入用
`updateTag(tag)`（仅 Server Action）；只重跑当前路由动态工作用 `refresh()`。
`redirect` 放在这些调用之后，不要在 try/catch 里吞掉。

**问：2025-12 的 RSC 安全公告说明了什么？** RSC/Flight 反序列化端点本身就是高
风险攻击面；CVE-2025-55182 是未认证 RCE，后续还有 DoS 和源码暴露。应用层鉴权
不能替代运行时补丁；要升级 React/Next.js 相关包、重新部署、按公告轮换密钥，并
且不要把秘密硬编码在 Server Function 源码里。

**三句话自测：**（1）Server Action 是公开 POST 端点，session 从 cookie/header
读，权限和所有权在 action 内用数据库重新查；（2）`FormData` 全部不可信，用
`typeof` 区分 string/File/null，trim、白名单枚举、长度校验，错误返回 state；
（3）写库成功后按范围 `revalidate*` / `updateTag`，再 `redirect`，redirect 抛
控制流异常，必须放在 try/catch 外。

## 4. 延伸阅读（官方文档）

- https://nextjs.org/docs/app/guides/server-actions
- https://nextjs.org/docs/app/guides/forms
- https://nextjs.org/docs/app/guides/data-security
- https://nextjs.org/docs/app/api-reference/directives/use-server
- https://nextjs.org/docs/app/api-reference/functions/revalidatePath
- https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- https://nextjs.org/docs/app/api-reference/functions/updateTag
- https://nextjs.org/docs/app/api-reference/functions/refresh
- https://nextjs.org/docs/app/api-reference/functions/redirect
- https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions
- https://react.dev/reference/rsc/server-functions
- https://react.dev/reference/rsc/use-server
- https://react.dev/reference/react/useActionState
- https://react.dev/reference/react/useOptimistic
- https://react.dev/reference/react-dom/hooks/useFormStatus
- https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components
- https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components
- https://nextjs.org/blog/CVE-2025-66478
- https://nextjs.org/blog/security-update-2025-12-11
