# W4D1：Server Components（Next.js 16 App Router + React 19.3）

> 以 Next.js 16 App Router 与 React 19.3 为准。承接 [W2D2](W2D2-suspense-use.md) 的 Suspense/流式思路、[W3D3](W3D3-performance-compiler.md) 的组件边界与「把客户端边界尽量下沉」。本练习环境**没有安装 Next.js**，只安装 React、Vitest、Testing Library 等；练习用纯 TS/React 模拟 RSC 的**语义**，不是运行真实的 Next.js 应用。

## 1. 一句话结论

Server Component 在服务端执行，结果被序列化成 **RSC payload**，浏览器只收到渲染结果和 Client Component 的引用，不会收到 Server Component 的源码；`'use client'` 画的是**模块图**边界，跨过它传数据只能靠**可序列化 props**，而 Server UI 要嵌进 Client UI 时，正确方式是由上层的 Server Component 通过 `children` 等 props 传入“已经渲染好的内容”，而不是让 Client Component 直接 import Server Component。

## 2. 心智模型

先分清三个不同的东西：**代码在哪执行**、**代码是否发到浏览器**、**HTML 是谁生成的**。它们不等价。

```text
模块图（决定代码是否打包到浏览器）
  app/page.tsx（Server）──import──> app/chart.tsx（Client 边界）
        │                                  │
        │                                  ├─ import ─> format.ts   → 进入 client bundle
        │                                  └─ import ─> button.tsx  → 进入 client bundle
        └──import──> lib/db.ts（server-only，只能留在 server graph）

渲染树（决定父子关系与 children 槽）
  Page（Server，owner）
  └─ Modal（Client，parent）
     └─ Cart（Server，由 Page 创建，作为 children 传入）
         浏览器只拿到 Cart 的渲染输出，不拿到 Cart 的组件代码

一次直接访问的时序
  Server：渲染 Server Components
        → 生成 RSC payload（Server 输出 + Client 占位 + props）
        → 用 payload 与 Client Components 生成初始 HTML
  浏览器：先用 HTML 显示非交互预览
        → 下载 Client Components 的 JS
        → 用 RSC payload 对齐组件树
        → hydration，绑定事件，变成可交互
```

最重要的判断顺序：

1. 这段代码**需要** state、事件、浏览器 API、Effect 吗？需要才考虑 Client Component。
2. 它是否在处理**机密数据**或只该在服务端运行的依赖？是就留在 Server Component，并考虑 `server-only`。
3. 需要把 Server UI 放进 Client UI 吗？用 `children` 等 props 传**服务端已渲染的结果**，不要从 Client 模块 import Server 模块。
4. 传给 Client Component 的每个值都能跨边界序列化吗？会不会把 secret 带进 RSC payload？

## 3. 要点

### 3.1 RSC 与 SSR 不是同一件事

SSR（传统的服务端渲染）解决的是“先给浏览器一段 HTML，让首屏更快出现，再下载同一套组件 JS 去 hydration”。开启 SSR 并不会自动让组件代码消失：组件仍然会进入浏览器 bundle，只是先在服务端跑一遍生成 HTML。

RSC（React Server Components）解决的是“有些组件根本不需要把代码发到浏览器”。Server Component 在与客户端应用、SSR 服务器都**不同的环境**中提前渲染（可以在构建时，也可以在每次请求时）；它的输出被编码成 RSC payload。Server Component 的源码和它 import 的服务端依赖不会进入 client bundle。Client Component 的代码仍然会进入 client bundle，并在首屏 SSR 时生成 HTML、在浏览器 hydration。

Next.js 16 App Router 把两者组合起来：

- 服务端把 Server Components 渲染成 RSC payload。
- RSC payload 与 Client Components 一起被用来预渲染 HTML。
- 浏览器先显示 HTML；RSC payload 用来对齐 Server/Client 组件树；Client Components 的 JS 用来 hydration。
- 后续客户端导航时，通常只取新的 RSC payload，不再为这一段生成新的 HTML；Client Components 直接在浏览器渲染。

```tsx
// app/posts/[id]/page.tsx —— 默认是 Server Component
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)
  return (
    <main>
      <h1>{post.title}</h1>
      <LikeButton likes={post.likes} />
    </main>
  )
}
```

```tsx
// app/ui/like-button.tsx —— Client Component：需要 useState 和 onClick
'use client'

import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  const [count, setCount] = useState(likes)
  return <button onClick={() => setCount((n) => n + 1)}>赞 {count}</button>
}
```

`Page` 的代码、`getPost` 的代码和数据库访问都不会进浏览器；`LikeButton` 的代码会进客户端 bundle。`likes` 这个数字会作为 props 出现在 RSC payload 中，所以它必须是可序列化的，也**必须不包含秘密**。

官方文档把两者区分得很清楚：“Server-rendered”描述 HTML 是怎么产生的；Server Component 描述组件代码在哪里运行、是否发到浏览器。一个 Client Component 也可以在服务端被预渲染成 HTML，但它依然叫 Client Component。

### 3.2 `'use client'` 是模块边界，不是“只在浏览器运行”开关

`'use client'` 必须写在文件最顶部、任何 import 之前，作用于**整个模块**：

- 该模块是客户端模块图的入口。
- 它 import 的模块（传递依赖）也会进入客户端图，不需要在每个文件重复写指令。
- 它只标记模块图，不标记渲染树。一个 Client Component 的子组件如果没有 `'use client'`，也可能因为被 Client Component import 而成为 Client Component。
- Client Component 在首屏仍可能在服务端被渲染成 HTML；指令说明的是“这段代码属于客户端图”，不是“这段代码永远不在服务端执行”。

```tsx
// app/ui/editor.tsx
'use client'

import { useState } from 'react'
import { formatDate } from './format' // format.ts 也会进入 client bundle
import Toolbar from './toolbar'      // toolbar.tsx 即使没写指令，也是 Client Component

export default function Editor({ updatedAt }: { updatedAt: string }) {
  const [text, setText] = useState('')
  return (
    <section>
      <Toolbar />
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <small>{formatDate(updatedAt)}</small>
    </section>
  )
}
```

边界两侧的 import 规则：

- **Server Component 可以 import Client Component。** 服务端图拿到的不是组件函数本体，而是一个 client reference；真正运行 Client Component 的是客户端。`app/page.tsx` 可以 import `LikeButton` 并渲染 `<LikeButton />`。
- **Client Component 的传递依赖都会进客户端图。** 所以不要在 Client Component 里 import 一个只该在服务端使用的模块，例如包含数据库连接、`fs`、私钥、`server-only` 的模块。
- **Client 模块图不能 import server-only 模块。** 真实 Next.js 在构建期报错；这保护的是“不要意外把服务端代码/秘密打进浏览器”。
- **Server Component 不能把纯客户端模块（client-only）当作服务端代码执行。** 需要浏览器 API 或 state 的部分，必须经 `'use client'` 标记为客户端入口，再由服务端以组件引用的方式使用；直接在 Server 环境调用 `window`/`localStorage` 之类的代码会失败，`client-only` 包也可以标记这类模块。注意：Server Component **可以** import 带 `'use client'` 的 Client Component，这两件事不矛盾。

另一个常见误区：**Server Component 没有对应的指令**。`'use server'` 不是“标记 Server Component”，它标记的是 Server Functions（可以从 Client Component 调用的服务端函数）。App Router 里的页面、布局默认就是 Server Component，不需要写任何指令。

一个模块可以在服务端图与客户端图里都被使用，Next.js 会按环境分别编译它。所以“这个文件是 server 还是 client”本身不精确；更准确的说法是“这个**使用方式**属于哪个图”。练习里的 `classifyModules` 用“是否被客户端入口到达”做简化的二元分类，是一个语义模型。

### 3.3 跨边界数据：props 必须可序列化

RSC payload 会经过网络到达浏览器，因此 Server -> Client 的 props 不能是任意 JS 值。React 官方列出的可序列化类型包括：

- 原始值：string、number、bigint、boolean、undefined、null，以及通过 `Symbol.for` 注册的全局 Symbol。
- 可迭代容器：String、Array、Map、Set、TypedArray、ArrayBuffer（其内部值也要可序列化）。
- `Date`。
- 普通对象：对象字面量创建、属性值递归可序列化。
- Server Functions（`'use server'` 的函数引用）。
- Client/Server Component 元素（JSX）。
- `Promise`（用于流式数据等场景）。

明确不支持的类型包括：

- 普通函数（没有 `'use server'` 标记，也不是从 client module 导出的引用）。
- 类、类实例（除上述内建类型），以及 null 原型对象。
- 未注册的 Symbol。

```tsx
// Server Component
const order = {
  id: 'o-1',
  total: 299,
  createdAt: new Date(),       // 真实 RSC 支持 Date
  tags: new Set(['vip']),      // 真实 RSC 支持 Set
}

<ClientSummary
  order={order}
  onSelect={(id) => console.log(id)} // ❌ 普通函数不能跨边界
/>
```

函数不能过去，但交互可以这样解决：

- 把事件处理逻辑放进 Client Component 内部。
- 在客户端交互后调用 Server Function（`'use server'`）或 API。
- 需要“服务器把一个行为交给客户端”时，使用 Server Function 引用，而不是任意闭包。

注意 RSC 的“可序列化”不等于 JSON：它支持 Date、Map、Set、Promise、JSX 等 JSON 不支持的值；具体支持表以 React 当前文档为准，**不要把它当作任意 JS 对象的通用深拷贝**。本练习的 ex2 刻意只模拟一个子集：标量、Date、数组、普通对象；函数、Symbol、类实例、Map/Set、循环引用都拒绝。练习的规则比真实 RSC 更严格，这是为了把“边界上只能传数据”练熟。

### 3.4 最重要的安全事实：RSC payload 会到浏览器

“Server Component 在服务端执行”不等于“它的数据不会被用户看到”。只要一个值作为 props 传给 Client Component，它就会进入 RSC payload，最终可以被浏览器看到。**序列化不是脱敏，边界不是权限系统。**

```tsx
// ❌ 即使组件叫 ServerComponent，这个 key 也已经泄露
const user = await db.user.findUnique({ where: { id } })
return <ClientProfile user={user} apiKey={process.env.API_KEY} />
```

安全做法：

- Server Component 可以访问数据库、文件系统、内部服务、环境变量；把**最小必要字段**整理成 DTO 后再交给 Client Component。
- 不要把整行数据库记录、密码哈希、token、内部审计字段塞进 props。
- 用 `server-only` 包标记只该在服务端运行的模块：`import 'server-only'`。如果它被 Client Component 引入，Next.js 会在构建期报错。`server-only`/`client-only` 包在 Next.js 里可选，Next.js 内部会处理这些导入并提供清晰错误。
- 环境变量默认只在服务端可用；`NEXT_PUBLIC_` 前缀的变量会被发送到客户端。**不要**用 `NEXT_PUBLIC_` 放秘密。
- React 还提供实验性的 Taint API（`experimental_taintObjectReference`、`experimental_taintUniqueValue`），可以防止指定对象/值被传给 Client；它是额外的护栏，不能替代在数据访问层做字段筛选。

```tsx
// lib/orders.ts —— 服务端数据访问层
import 'server-only'

export async function getOrderForClient(id: string) {
  const row = await db.order.findUnique({ where: { id } })
  // 只返回 UI 需要的字段，去掉 passwordHash/internalNote/成本价等
  return { id: row.id, total: row.total, status: row.status }
}
```

`server-only` 防的是“错误的 import 被构建进客户端”；它防不了“你主动把敏感值放进 props”或“你用 `NEXT_PUBLIC_` 暴露了秘密”。这两件事需要代码审查和数据最小化。

### 3.5 组合：用 `children` 把 Server UI 嵌进 Client Shell

最容易犯的错误，是 Client Component 直接 import Server Component：

```tsx
// ❌ 错误方向：Client 模块图向下 import 一个服务端模块
'use client'

import { Cart } from './cart' // cart.tsx 读取数据库或 import 'server-only'

export function Modal() {
  return <Cart />
}
```

为什么错：

- `Modal` 属于客户端图，它 import 的所有内容都会被拉进客户端 bundle。
- `Cart` 如果依赖数据库/`server-only`，构建会失败；如果它恰好能被打包，那它实际上已经变成了客户端代码，不再是 Server Component。
- 模块图边界不能靠“组件名字叫 Server”来绕过。

正确方向：**由 Server Component 拥有 Server UI，并把已经渲染好的 JSX 作为 children 传进 Client Shell。**

```tsx
// app/ui/modal.tsx
'use client'

import { useState, type ReactNode } from 'react'

export function Modal({
  title,
  children,
}: {
  title: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div role="dialog">
      <header>
        {title}
        <button onClick={() => setOpen(false)}>关闭</button>
      </header>
      {open && children}
    </div>
  )
}
```

```tsx
// app/page.tsx —— Server Component
import { Cart } from '@/app/ui/cart'
import { Modal } from '@/app/ui/modal'

export default function Page() {
  return (
    <Modal title="购物车">
      <Cart />
    </Modal>
  )
}
```

关键在 owner 与 parent 的分离：

- **owner** 是 JSX 写在谁的定义里。这里 `Page` 是 `<Modal>` 与 `<Cart>` 的 owner。
- **parent** 是渲染树里直接包含它的人。`Modal` 是 `Cart` 的 parent。
- `Cart` 的 owner 是 Server Component，所以 `Cart` 在服务端渲染；`Modal` 只是 parent，它拿到的是 `Cart` 的**渲染结果**，而不是 `Cart` 的代码。
- Client state（比如 `open`）变化只会重渲染 Client 的 `Modal`；`children` 是服务端已经生成并传下来的内容，不会因为这个 client state 变化而重新执行 Server Component。要更新这部分，需要在服务端重新渲染并产生新的 RSC payload（导航、重新验证等）。

同样的模式也用于 Context Provider：Server Component 不能创建 context，但可以渲染一个从 Client 模块 import 的 Provider，并把 Server 子树作为 `children` 放进去。Provider 应尽量往树下放，包住真正需要它的部分。

```tsx
// app/theme-provider.tsx
'use client'

import { createContext } from 'react'

export const ThemeContext = createContext<'light' | 'dark'>('light')

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext value="dark">{children}</ThemeContext>
}
```

### 3.6 App Router 的日常判断

- `app/layout.tsx`、`app/page.tsx` 默认是 Server Component；它们 import 且没有经过客户端边界的普通组件，也会在服务端渲染。
- 只有需要 `useState`、事件、Effect、浏览器 API、自定义 Hook 的文件才加 `'use client'`。
- 不要把整个页面都标成 Client Component：把交互孤岛下沉，让静态部分留在 Server，减小 client bundle。
- Client Component 也可以渲染另一个 Client Component；`'use client'` 只需要放在客户端子树的入口处，不需要每个文件都写。
- 组件库作者应在依赖 client-only 功能的入口文件上写 `'use client'`；使用方就不必再包一层。
- 复合组件（例如 `Menu.Item`）跨边界时静态属性可能丢失：Server Component import Client Component 拿到的是 client reference，不是函数本体；在 Server Component 里直接使用 `Menu.Item` 可能得到 `undefined`。这类客户端复合组件应在 Client Component 内部使用，或改成具名导出。

一个常用的性能判断：**把 `'use client'` 推到尽可能靠近叶子交互的位置**。页面壳、数据读取、静态内容留在 Server，只有输入框、弹窗开关、图表交互等进入 client bundle。这不是“Server 一定更快”的教条，而是减少浏览器需要下载、解析、hydration 的代码。

### 3.7 本练习的语义模型与真实 Next.js 的差异

本练习环境没有安装 Next.js，也没有真实 bundler。三个练习分别模拟：

- `ex1`：模块图分类。用 `useClient` 和 `isServerOnly` 标记，模拟“客户端图的传递闭包”和“客户端图不得 import server-only”。真实 Next.js 的模块可以同时属于两个图，由 bundler 分环境编译；这里简化为二选一。
- `ex2`：props 序列化。模拟一个严格子集：标量（含 bigint）、Date、数组、普通对象可过；函数、Symbol、类实例、Map/Set、循环引用拒绝。真实 React 19 比这个子集宽得多，例如支持 Map/Set/Promise、全局 Symbol、JSX 和 Server Function 引用。
- `ex3`：RSC payload 的玩具格式。Server 输出是纯数据，Client 只留占位，`children` 槽保留并递归序列化。它用于理解“Client 接收 Server UI 的输出”，不是 Next.js 的真实 wire format，也不处理流式分块、Server Function 引用等细节。

所以：练习测试通过，只能证明你理解了语义；不要把练习中的类型/限制当成 React 的完整规则。真正的 API 以官方文档和实际 Next.js 构建为准。

## 4. 常见误区

| 错误认知 / 写法 | 正确理解 | 原因 |
|---|---|---|
| RSC 就是 SSR 的新名字 | RSC 和 SSR 是不同层面的机制 | SSR 生成 HTML 但仍发送组件 JS；RSC 让 Server Component 代码不进客户端 bundle，发送 RSC payload |
| Client Component 只在浏览器执行 | 首屏时 Client Component 也会在服务端预渲染成 HTML | “Client”表示它也进入浏览器并 hydration，不表示服务端不执行它 |
| Server Component 一定在服务端执行，所以数据一定安全 | 只要作为 props 传给 Client，值就进入 RSC payload | 序列化会到达浏览器；安全靠最小化数据、DTO、`server-only` 和审查 |
| `'use client'` 只影响写了它的那个组件 | 它作用于整个模块及其传递依赖 | 客户端模块图会把 import 的模块一起打包 |
| Server Component 不能 import Client Component | 可以 import，拿到的是 client reference | 常规做法就是 Server 页面渲染 Client 交互组件 |
| Client Component 可以 import Server Component 来复用 | 方向上不允许；应让 Server Component 作为 owner 传 children | Client 模块图不能导入服务端模块；否则会把服务端代码拉进 bundle 或构建失败 |
| 用了 RSC 就不需要 hydration | 仍然需要，Client Components 需要在浏览器 hydration | RSC 不减掉交互组件的水合，只减掉 Server 组件的代码 |
| `'use server'` 是 Server Component 的标记 | `'use server'` 标记 Server Functions | Server Component 没有指令；App Router 的页面默认就是 Server Component |
| 所有 props 都能从 Server 传给 Client | 只有可序列化值可以 | 函数、类实例、未注册 Symbol 等会报错；见官方 serializable types |
| 随便传 Date/Map 一定失败 | 真实 RSC 支持部分富类型 | Date、Map、Set、Promise 等有支持；但本练习的 ex2 是更严格子集 |
| `server-only` 能自动脱敏 props | 它只在错误 import 时阻止构建 | 它不检查你主动传出的敏感字段；数据最小化才是关键 |
| 把整个页面标成 `'use client'` 最省事 | 应把 client 边界下沉到交互叶子 | 否则整页组件和依赖进入 client bundle，失去 RSC 的体积收益 |
| Server 传给 Client 的 children 每次 Client state 变化都会重新执行 | children 是服务端已渲染的输出，client state 变化不会重新执行 Server 组件 | 只有重新请求/重新渲染服务端树才会产生新 payload |
| 在 Client Component 里直接 import 数据库工具也没关系 | 会把数据库代码打进浏览器，通常还会构建失败 | 客户端代码必须按完全不可信的浏览器环境设计 |

## 5. 面试口径

**问：RSC 和 SSR 的区别是什么？**

答：SSR 是“先在服务端把组件渲染成 HTML”的优化，组件代码仍会送到浏览器并在客户端 hydration；RSC 是组件类型和模块边界机制，Server Component 在独立环境提前执行，输出 RSC payload，源码和它的服务端依赖不进 client bundle。Next.js 会把两者组合：用 RSC payload 和 Client Components 生成首屏 HTML，再 hydration Client Components；后续导航主要传 RSC payload。RSC 不是 SSR 的替代品，二者解决不同问题。

**问：`'use client'` 到底标记了什么？为什么 Client Component 不能直接 import Server Component？**

答：它标记客户端模块图的入口，作用于整个文件及其传递依赖；它不表示组件只在浏览器运行，Client Component 首屏也会被预渲染成 HTML。模块图边界决定代码是否进入 client bundle。Client 模块图不能 import 服务端模块，否则会把服务端代码拉进浏览器或触发 `server-only` 构建错误。要让 Server UI 嵌进 Client UI，应由 Server Component 作为 owner，把 Server 组件作为 `children` 传给 Client Component；Client 只看到渲染结果，不 import 它的代码。

**问：Server 传 Client 的 props 有哪些限制？如何避免泄密？**

答：props 必须可序列化。真实 RSC 支持原始值、Date、Map、Set、Promise、全局 Symbol、JSX、Server Functions 等，不支持普通函数、类实例、null 原型对象和未注册 Symbol。更重要的是：props 会进入 RSC payload 到浏览器，所以不要传数据库整行、密码哈希、token 或服务端密钥；在服务端整理 DTO、用 `server-only` 防止错误 import、避免 `NEXT_PUBLIC_` 保管秘密，并用审查/taint 作为额外防线。

## 6. 延伸阅读

- Next.js：Server and Client Components（Next.js 16 App Router 主文档）
  https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js：The Server and Client Boundary（模块图、渲染环境、owner/parent）
  https://nextjs.org/docs/app/guides/server-and-client-boundary
- Next.js：`use client` API Reference
  https://nextjs.org/docs/app/api-reference/directives/use-client
- Next.js：Data Security（server-only、taint、Server -> Client 数据安全）
  https://nextjs.org/docs/app/guides/data-security
- React：Server Components
  https://react.dev/reference/rsc/server-components
- React：`'use client'` 与可序列化类型
  https://react.dev/reference/rsc/use-client
- React：Server Functions（区分 Server Component 与 Server Function）
  https://react.dev/reference/rsc/server-functions

练习入口：`exercises/W4D1/README.md`。先独立做题，再看 `solutions/`；测试是验收标准，不要修改断言。
