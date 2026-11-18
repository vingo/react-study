# W3D4：测试

> 环境：Vitest 5.1.0、@testing-library/react 16.3.3、user-event 14.6.12、jest-dom 7.0.1、jsdom 30.1.3、React 19.3、TypeScript 7。**MSW 未安装**；3.6 与 3.10 的 MSW 代码按 MSW 3 官方文档（Node ≥ 22）编写，供 Kanban v2 使用，本仓库练习用注入 fetcher / `vi.stubGlobal('fetch')` 等价模拟。承接 [W2D3](W2D3-tanstack-query.md) 的异步状态与 [W3D2](W3D2-concurrent-rendering.md) 的“渲染次数不可预测”。以下代码省略 import 和部分组件/工具函数定义，重点在测试写法。

## 1. 一句话结论

测试不是实现镜像，而是行为契约：Vitest 提供确定性运行环境，Testing Library 从可访问性树按用户视角查询，user-event 走真实交互序列，MSW 在网络边界造数据；四者合起来，让你重构 `useState`、Query、路由或组件结构时，只要用户看到的行为不变，测试就仍然是绿的。

## 2. 心智模型

```text
用户视角                        测试工具
看/听 role + name        →     getByRole('button', { name: '保存' })
读 label                 →     getByLabelText('任务标题')
点击 / 输入 / Tab        →     await user.click/type/tab()
等待网络与加载态         →     await findBy... / waitFor
                                        │
                                        ▼
                                 [ UI 组件树 ]
                                        │ fetch / XHR
                                 [ 网络边界 ] ← MSW handlers
                                 （练习：fetch stub / 注入 fetcher）

原则：查询可访问性，交互走用户路径，断言可见结果，隔离外部依赖。
```

```text
测试金字塔（本项目的取舍）
        E2E（少）            Playwright：真实浏览器 + 真实后端
      集成（适量）          路由 + TanStack Query + MSW：一条完整用户路径
    组件（多）              RTL + user-event：单组件的 UI 契约
  单元（最多）              Vitest：纯函数、reducer、校验、格式化

每个测试：beforeEach 重置 → arrange（渲染/造数据）→ act（user-event）→ assert（可见结果）→ afterEach 清理
```

## 3. 要点

### 3.1 先划边界：单元、组件、集成，各自只测自己拥有的东西

- **单元**：纯函数、reducer、校验、格式化、store 的纯逻辑。没有 DOM，没有网络，快且稳定。
- **组件**：单个组件（或一小组）的 UI 契约：给定 props/交互，用户看到什么、能操作什么。网络、时间、随机数在边界上模拟。
- **集成**：多组件 + 路由 + Query + 网络 handler，走一条用户路径（创建 → 列表出现 → 刷新仍在）。这是投入产出比最高的一层。
- **E2E**：真实浏览器、真实后端，覆盖登录、支付、上传等无法在 jsdom 里可信模拟的链路；本仓库不做。

| 层 | 适合测 | 不适合测 |
|---|---|---|
| 单元 | 状态转换、校验规则、排序/过滤 | DOM、网络、React 生命周期 |
| 组件 | 条件渲染、表单错误、键盘操作、可访问名称 | React 自身的 state/key/context 语义 |
| 集成 | 路由跳转、Query 缓存/失效、乐观更新、错误恢复 | 像素/布局/滚动 |
| E2E | 真实浏览器全链路、跨页持久化 | 细粒度分支覆盖 |

**不要重复测 React 本身**：React 的测试已经覆盖 `useState` 更新触发 render、key 变化重置 state、context 传播、自动批处理。你的测试若断言“render 发生了两次”“内部 state 变成 X”，测的是 React 或实现，不是业务。重构 `useState` → `useReducer` → Zustand 后 UI 不变，测试就不该红。

```ts
type Status = 'todo' | 'doing' | 'done'

export function nextStatus(status: Status): Status {
  return status === 'done' ? 'todo' : 'done'
}

test('已完成的任务再次切换会回到未完成', () => {
  expect(nextStatus('done')).toBe('todo')
})
```

```tsx
test('点击“完成”后，任务行显示“已完成”', async () => {
  const user = userEvent.setup()
  render(<TaskRow task={{ id: 't1', title: '写周报', done: false }} />)
  const row = screen.getByRole('listitem')

  await user.click(within(row).getByRole('button', { name: '完成任务：写周报' }))

  expect(within(row).getByText('已完成')).toBeInTheDocument()
})
```

单元测试锁定规则，组件测试锁定用户可见结果；组件测试不碰 `TaskRow` 的内部 state 或 render 次数。

### 3.2 Vitest 5：test/describe、expect、mock、fake timers

- `test` 与 `it` 等价；`describe` 分组；`beforeEach`/`afterEach` 每个用例前后执行，`beforeAll`/`afterAll` 每个文件一次。`beforeAll` 只放不随用例变化、昂贵且可复用的准备（如 `server.listen()`），可变数据一律放 `beforeEach`。
- 本仓库 `vitest.config.ts` 已配置 `environment: 'jsdom'`、`globals: true`、`setupFiles: ['./vitest.setup.ts']`；setup 只做 `import '@testing-library/jest-dom/vitest'`，给 `expect` 加上 `toBeInTheDocument`、`toBeVisible`、`toBeInvalid`、`toHaveAccessibleName` 等 DOM 断言。
- jsdom 提供 DOM API，但不是浏览器：没有布局/绘制，`getBoundingClientRect()` 全是 0，滚动/媒体查询/真实焦点行为有限。**不要在 jsdom 里断言像素、位置、动画时长**。
- CLI：`npm test` = `vitest run`（一次性）；`npm run test:watch` = `vitest`（watch）；`npm test -- W3D4` 按文件路径过滤；`npx vitest run -t "乐观更新"` 按用例名过滤；`--reporter=verbose` 看完整列表。watch 下 `f` 只跑失败、`t` 按名字过滤、`q` 退出。

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

describe('formatDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T09:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('当天到期显示“今天”', () => {
    expect(formatDueDate(new Date('2026-11-18T20:00:00'))).toBe('今天')
  })
})
```

- `vi.fn(impl?)` 创建独立 mock；`mockReturnValue`、`mockResolvedValue`、`mockRejectedValue`、`mockImplementation` 控制返回值；`mock.calls` 记录参数。
- `vi.spyOn(obj, 'method')` 包装已有方法，默认透传原实现；`mockImplementation` 替换；`vi.restoreAllMocks()` 恢复原实现。**`clearAllMocks` 只清调用记录，`resetAllMocks` 清记录并重置实现，`restoreAllMocks` 恢复被 spy 的原方法**——三者不要混用。
- `vi.mock('./api')` 会被提升到文件顶部，工厂不能引用外部变量；需要共享变量时用 `vi.hoisted`。模块 mock 适合替换 `next/navigation` 这类模块边界，**网络请求优先用 MSW**，不要 mock 自己的 API 模块，否则 URL/方法/序列化错误都测不出来。
- fake timers 只替换定时器和 `Date`，不替换 Promise；定时器回调里有 `await` 时用 `await vi.advanceTimersByTimeAsync(ms)` 或 `runAllTimersAsync`。每个 `afterEach` 必须 `vi.useRealTimers()`，否则污染后续用例。

```ts
const save = vi.fn().mockResolvedValue({ id: 't1' })
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

test('保存时把标题传给 API', async () => {
  const user = userEvent.setup()
  render(<TaskForm save={save} />)

  await user.type(screen.getByLabelText('任务标题'), '写周报')
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: '写周报' }))
  expect(errorSpy).not.toHaveBeenCalled()
})
```

### 3.3 Testing Library：查询优先级与可访问名称

优先级从高到低：

| 优先级 | 查询 | 典型用途 |
|---|---|---|
| 1 | `getByRole(role, { name })` | 按钮、链接、输入框、对话框、标题；最接近屏幕阅读器 |
| 2 | `getByLabelText` | 表单字段，用户通过 label 找到 |
| 3 | `getByPlaceholderText` | 没有 label 时的下策；placeholder 不是 label |
| 4 | `getByText` | 非交互文本、段落、列表项内容 |
| 5 | `getByDisplayValue` | 已填好的表单值 |
| 6 | `getByAltText` | 图片/区域 |
| 7 | `getByTitle` | 屏幕阅读器支持不稳定，少用 |
| 8 | `getByTestId` | 动态文本、虚拟列表等语义查询确实不可行时兜底 |

`name` 匹配的是**可访问名称**：`aria-labelledby`、`aria-label`、关联的 `<label>`、按钮/链接的文本内容、图片的 `alt` 等；默认精确匹配（空白会归一化），模糊/忽略大小写用正则，如 `{ name: /保存/i }`。`getByRole` 默认排除隐藏元素；`hidden: true` 才把 `display:none`/`aria-hidden` 的元素算进来。常用选项还有 `level`（标题级别）、`checked`、`selected`、`pressed`、`expanded`、`busy`。

```tsx
render(<TaskEditor />)

const dialog = screen.getByRole('dialog', { name: '编辑任务' })
const title = within(dialog).getByRole('textbox', { name: '标题' })
const save = within(dialog).getByRole('button', { name: '保存' })

expect(title).toHaveAccessibleName('标题')
expect(save).toBeEnabled()
expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
```

- `within(subtree)` 把查询限制在对话框/行内，避免同名元素多个匹配；`screen` 是绑定到 `document.body` 的 `within`。
- `getBy*` 找不到或找到多个就抛错；`queryBy*` 找不到返回 `null`，只用于断言“不存在”；`findBy*` 返回 Promise，找不到会重试（见 3.5）。
- 不用 `container.querySelector('.class')`、`element.classList`、`component.state`：这些是用户看不见的实现细节，重构 CSS/状态结构就会误报，而且不会暴露可访问性问题。`data-testid` 是最后手段，不是默认。
- 查询失败时先 `screen.debug()` 看 DOM；确认元素确实在可访问性树里，而不是被 `display:none`/`aria-hidden` 排除。

### 3.4 user-event vs fireEvent：模拟真实交互，而不是直接改值

- `userEvent.setup()` 每个测试创建独立实例（键盘/剪贴板/指针状态互不污染）；setup 本身同步返回，不需要 `await`，需要 `await` 的是 `click`/`type`/`tab` 等交互方法。
- `user.type` 逐字符触发 focus、keydown、input、keyup 等事件序列；`user.keyboard('{Enter}')` 处理特殊键；`user.tab()` 走真实 Tab 顺序；还有 `clear`、`selectOptions`、`upload`、`hover`、`dblClick`。
- `fireEvent` 只派发一个底层事件，不模拟完整序列。`fireEvent.change(input, { target: { value: 'x' } })` 不会经过键盘/焦点/输入法，容易放过真实 bug。它适合 `scroll`、`resize`、`drop`、`load/error`、自定义事件等 user-event 没有封装的事件。
- 用 fake timers 时，user-event 内部的 `delay` 会卡住；`userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` 让它推进假时钟。

```tsx
test('键盘 Tab 到保存并回车提交', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  render(<TaskForm onSave={onSave} />)

  const input = screen.getByRole('textbox', { name: '任务标题' })
  const save = screen.getByRole('button', { name: '保存' })

  await user.type(input, '写周报')
  await user.tab()
  expect(save).toHaveFocus()
  await user.keyboard('{Enter}')

  expect(onSave).toHaveBeenCalledWith({ title: '写周报' })
})
```

`fireEvent.change` 只改值，不会验证焦点顺序、Tab 是否可达、Enter 是否提交；这些正是键盘用户每天走的路径。

### 3.5 异步：findBy、waitFor、waitForElementToBeRemoved 与 act

| API | 用途 | 关键点 |
|---|---|---|
| `findBy*` | 等元素出现 | `getBy*` + 重试，默认 timeout 1000ms；最后一个参数可传 `{ timeout }` |
| `waitFor` | 等非元素条件/复合断言 | 回调必须抛错才会重试；`expect` 正好会抛；不要在回调里做副作用 |
| `waitForElementToBeRemoved` | 等元素消失 | 传入元素或返回元素的回调；调用时元素必须已经存在，否则抛错 |

绝不 `await new Promise(r => setTimeout(r, 500))`：固定睡眠在慢 CI 上不够、在快机器上白等，还会让测试变慢变 flaky。要控制“何时完成”，用可手动 resolve 的 deferred，而不是猜时间。

```tsx
test('加载完成后显示任务，加载态消失', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(tasks)))
  render(<TaskList />)

  expect(screen.getByRole('status')).toHaveTextContent('加载中')
  expect(await screen.findByText('写周报')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument(),
  )
})
```

**act 警告的成因**：React 的 state 更新必须在一个 `act` 作用域里 flush，RTL 已经包住 `render`、`fireEvent` 和 user-event；但测试函数同步部分结束后，fetch/timer/promise 的后续回调再触发更新，就落在作用域外，于是出现 “An update to X inside a test was not wrapped in act(...)”。它不是可以静音的噪音：通常意味着断言可能跑在更新之前。

修复顺序：

1. 每个 user-event 调用都 `await`；
2. 用 `await screen.findBy*` / `await waitFor(...)` 等到 UI 稳定；
3. 外部手动控制的 promise/timer，用 `await act(async () => { ... })` 包住“导致更新”的那一步；
4. 测试结束前 `unmount()`/`cleanup()`，让未完成的请求和 Query 清理（queryFn 用 `AbortSignal` 时取消）；
5. 不要把整个测试包进 `act`，也不要拿 `act` 当 `sleep` 用。

```tsx
const deferred = createDeferred<Task[]>()
render(<TaskList load={() => deferred.promise} />)

await act(async () => {
  deferred.resolve([{ id: 't1', title: '写周报', done: false }])
  await deferred.promise
})

expect(screen.getByText('写周报')).toBeInTheDocument()
```

**Suspense / transition / Activity 的测试注意点**：

- Suspense：数据未就绪时，首次挂载会显示 fallback；用 `await findBy...` 等真实内容，用 `waitForElementToBeRemoved(fallback)` 等 fallback 消失。若 promise 已同步 resolve 或缓存命中，fallback 可能不出现，所以不要断言“fallback 必然出现”，断言最终内容即可。
- transition：`startTransition` 的更新可能保留旧 UI、被高优先级更新打断、render 多次。**不要断言精确渲染次数或耗时**，只断言最终 UI，或断言稳定的 pending 标记（`isPending`、`aria-busy`、可见的“更新中”）。要观察中间态，用 deferred 控制 promise 何时 resolve。
- `<Activity mode="hidden">`：子树仍挂载、state 保留，但 React 会把它从可访问性树隐藏（通常 `display:none`），effect 会清理。`getByRole` 默认找不到它；用 `getByText(...).not.toBeVisible()` 或 `getByRole(..., { hidden: true })` 断言隐藏，**不要用 `queryByText(...).not.toBeInTheDocument()` 断言“已卸载”**——它没有卸载。
- StrictMode 会双调用 render/effect；测试里默认不包 StrictMode。若要包，断言幂等结果，不要断言调用次数。

### 3.6 请求模拟：MSW 3 的原理与用法，以及本练习的 fetch mock

> **本仓库未安装 MSW**（`package.json` 没有 `msw`）。下面的 MSW 3 代码是按官方文档写的参考实现，直接运行会报模块找不到；Kanban v2 执行 `npm i -D msw`（Node ≥ 22，本机 24.22 满足）后再接入。W3D4 练习用“注入 fetcher”或 `vi.stubGlobal('fetch', ...)`，两者等价地把网络边界替换掉，只是没有 MSW 的路由/协议能力。

MSW 3 的最小接入：

```ts
// src/mocks/handlers.ts —— MSW 3 的 http 从 msw/http 导入
import { http, HttpResponse } from 'msw/http'

export const handlers = [
  http.get('/api/tasks', () =>
    HttpResponse.json([{ id: 't1', title: '写周报', done: false }]),
  ),
  http.post('/api/tasks', async ({ request }) => {
    const body = (await request.json()) as { title: string }
    return HttpResponse.json({ id: 't2', ...body }, { status: 201 })
  }),
]
```

```ts
// src/mocks/node.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
export const server = setupServer(...handlers)

// vitest.setup.ts
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

`server.use(...)` 的 handler 会**插到最前面**，同一个测试内后 `use` 的优先；`afterEach(resetHandlers)` 清掉运行时 handler，`afterAll(close)` 恢复 Node 原生请求模块。`listen()` 是同步的。

```ts
import { delay } from 'msw/utils/delay'

// 单个测试内覆盖：后 use 的 handler 优先
server.use(
  http.get('/api/tasks', async () => {
    await delay(200)
    return HttpResponse.json({ message: 'boom' }, { status: 500 })
  }),
)

// 网络失败：fetch 以 TypeError 拒绝，而不是 500
server.use(http.get('/api/tasks', () => HttpResponse.error()))
```

- `HttpResponse.json(body, { status: 500 })` 是 **HTTP 错误**：`fetch` 正常 resolve，应用必须检查 `response.ok`；`HttpResponse.error()` 是**网络错误**：`fetch` 以 `TypeError: Failed to fetch` reject。两者在 UI 上通常对应不同错误文案，测试要分开。
- `delay(200)` 控制响应耗时；MSW 3 在 Node 下会忽略无参 `delay()` 的“真实延迟”，显式毫秒有效；`delay('infinite')` 让请求一直 pending，适合测加载态/超时，但测试结束前要 `resetHandlers` + `unmount`（必要时用 `AbortSignal` 中止），别留下悬挂请求。
- `params` 读路径参数，`await request.json()` 读请求体，`new URL(request.url).searchParams` 读查询参数。handler 用相对路径时，按当前 document 的 `location.href` 解析；纯 Node 环境需要配置 base URL，或直接写绝对 URL。

本练习环境的等价写法（无需安装 MSW）：

```ts
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(tasks)))
})
afterEach(() => vi.unstubAllGlobals())
```

**MSW 在 Node/jsdom 下如何拦截**：`setupServer` 来自 `msw/node`，底层用 `@mswjs/interceptors` 替换 Node 的 `http.ClientRequest`、`https`、`fetch`（undici）和 `XMLHttpRequest` 等请求发起模块。Vitest 的 jsdom 环境仍在同一个 Node 进程里，DOM 是 jsdom 提供的，网络最终走这些模块，所以 `fetch`、XHR、axios 都会被拦截，被 handler 命中的请求不会真的出网。浏览器端 `setupWorker` 才用 Service Worker；两端可以复用同一组 handlers。**没有 Service Worker 参与 node/jsdom 测试**。

**为什么优于全局 fetch stub**：

- 拦截在网络层，真实构造 `Request`/`Response`，能暴露 URL、方法、header、body 序列化错误；fetch stub 只替换 `globalThis.fetch`，axios/XHR 或提前捕获的 fetch 引用会绕过。
- 一份 handlers 同时服务浏览器开发、Node 测试和 Vitest，按 URL/method 路由；stub 要在每个测试里手写路由和响应。
- `server.use` 做单测试覆盖，`resetHandlers` 自动回收；`onUnhandledFrame: 'error'` 能抓住拼错的 endpoint，stub 通常会静默返回同一个假数据。
- 但 stub 不是一无是处：给一个只接收 `fetch` 函数的纯 hook 做单元测试、或本练习这种没有 MSW 的环境，`vi.stubGlobal` 更轻；关键是**只在边界替换，并确保每个测试恢复**。

MSW 3 的入口有变化：`http`/`HttpResponse` 从 `msw/http`，`setupServer` 从 `msw/node`，`delay` 从 `msw/utils/delay`；`onUnhandledRequest` 改名为 `onUnhandledFrame`。不要照抄 MSW 2 的 `import { http } from 'msw'`。

### 3.7 测试隔离：每个测试都能单独运行

模块级状态在同一个测试文件内会跨用例保留：Zustand 单例 store、模块级 QueryClient、`localStorage`、全局 `fetch`、假时钟、MSW 运行时 handler、`document.body`。隔离不是“跑全量时碰巧过”，而是**任意顺序、单独运行都通过**。

```ts
beforeEach(() => {
  localStorage.clear()
  useBoardStore.setState(useBoardStore.getInitialState(), true)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  server.resetHandlers() // 未装 MSW 时删掉
})
```

```tsx
function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}
```

- RTL 在 `globals: true` 时自动注册 `afterEach(cleanup)`；如果关掉 globals，需要手动 `cleanup()`。`cleanup` 会卸载组件、跑 effect 清理、移除 Query 观察者；若 queryFn 用了 `AbortSignal`，未完成请求也会被取消。
- QueryClient **每个测试新建**，不要模块级共享；测试默认 `retry: false`（否则错误用例要等 3 次重试）、`gcTime: 0`（避免缓存和定时器跨用例）、`refetchOnWindowFocus: false`（jsdom 的 focus 事件会额外触发请求）。
- Zustand 用 `getInitialState()` + `setState(initial, true)` 整体替换；不要在测试里直接改初始对象或数组，否则下一次 reset 仍然是脏的。
- `localStorage` 在同一个测试文件内不会自动清空；`beforeEach` 清掉。测试持久化时反过来：写入 → `unmount()` → 重新 `render()` → 断言读回。
- `vi.restoreAllMocks()` 恢复 spy；`vi.unstubAllGlobals()` 恢复 `vi.stubGlobal`；`vi.clearAllTimers()` + `vi.useRealTimers()` 清掉假定时器。只调用 `clearAllMocks` 不会恢复实现或全局 stub。
- 日期/随机数也要固定：`vi.setSystemTime(...)`、注入 id 工厂，或 `vi.stubGlobal('crypto', ...)`；否则断言里的 id/时间每次都变。
- 每个用例独立 arrange-act-assert，不依赖上一个用例的 DOM、store、缓存或请求计数；`beforeAll` 只放不随用例变化的昂贵准备。

### 3.8 表单与可访问性：label、role、aria、错误提示、键盘

表单测试是最能体现“按用户行为测试”的地方：用户通过 label 找到输入框，用键盘输入，提交后听到/看到错误。查询和断言都围绕这些语义，而不是 `name` 属性或 CSS class。

```tsx
const [error, setError] = useState('')
return (
  <form onSubmit={(e) => {
    e.preventDefault()
    const title = new FormData(e.currentTarget).get('title')?.toString().trim()
    if (!title) return setError('请输入标题')
    setError('')
    onCreate(title)
  }}>
    <label htmlFor="title">任务标题</label>
    <input id="title" name="title" aria-invalid={!!error} aria-describedby={error ? 'title-error' : undefined} />
    {error && <p id="title-error" role="alert">{error}</p>}
    <button>添加</button>
  </form>
)
```

```tsx
test('空标题提交显示错误，修正后可用键盘提交', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  render(<TaskForm onCreate={onCreate} />)

  await user.click(screen.getByRole('button', { name: '添加' }))
  expect(screen.getByRole('alert')).toHaveTextContent('请输入标题')

  const input = screen.getByRole('textbox', { name: '任务标题' })
  expect(input).toBeInvalid()
  await user.type(input, '写周报{Enter}')
  expect(onCreate).toHaveBeenCalledWith('写周报')
})
```

- `label` 必须和 input 关联（`htmlFor` + `id`，或把 input 包在 label 里）；placeholder 不是 label，不能替代。
- 按钮的可访问名称来自文本；只有图标的按钮要 `aria-label`。对话框用 `aria-labelledby`/`aria-label` 命名，`getByRole('dialog', { name })` 才能命中。
- 错误提示用 `role="alert"`（立即播报）或 `role="status"`（礼貌播报），同时给输入框 `aria-invalid` 和 `aria-describedby` 指向错误文本；`toBeInvalid()`、`toHaveAccessibleDescription()` 可以直接断言这些语义。
- 提交通常用 `await user.click(button)` 或 `await user.keyboard('{Enter}')`，不要 `fireEvent.submit(form)`：后者绕过按钮点击、焦点和原生校验，测不到用户实际如何触发提交。
- 键盘路径要测：`user.tab()` 的焦点顺序、`toHaveFocus()`、`{Escape}` 关闭对话框、方向键切换选项。不要断言 CSS class 或内联样式。
- 异步校验的错误用 `await screen.findByRole('alert')`；`disabled` 用 `toBeDisabled()`，不要查 class。

### 3.9 测试策略：核心路径优先，覆盖率不是目标

排序而不是平铺：

1. **核心用户路径**：创建、编辑、完成/取消、删除、筛选、刷新后仍在。
2. **失败与边界**：空列表、空标题、超长文本、接口 500、网络失败、重试、并发点击。
3. **可访问性与键盘**：label、role、错误提示、Tab/Enter/Escape。
4. **回归**：每个修过的 bug 留一条会先红后绿的测试。
5. **性能/视觉**：不放在 jsdom 单测里——用 Playwright/Chromatic/Lighthouse，性能用 React Profiler 或 benchmark。

```tsx
test('回归：标题只有空格时不能创建任务', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  render(<TaskForm onCreate={onCreate} />)

  await user.type(screen.getByRole('textbox', { name: '任务标题' }), '   ')
  await user.keyboard('{Enter}')

  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('请输入标题')
})
```

- **快照少用**：整棵组件的 `toMatchSnapshot()` 会对任何 DOM 改动都要求更新快照，无法表达行为意图，diff 噪音大；只对稳定、小而完整序列化的输出用 inline snapshot。
- **测行为而不是内部 state**：断言用户看到/读到的 UI；store/reducer 作为独立单元测。测试里读 `useBoardStore.getState()` 只能作为辅助，不能替代 UI 断言。
- **覆盖率是诊断，不是 KPI**：行覆盖率高不代表断言有效；一个只 `render` 不断言的测试也能 100%。用覆盖率找未测分支，优先覆盖关键业务分支和错误路径。
- **回归测试**：先写一个失败测试复现 bug，再修；修完保留，防止下次回归。不要修完就删。
- **不过度 mock**：网络、时间、随机、`localStorage`、浏览器 API 在边界模拟；不要 mock 子组件或整个 feature，否则集成测试的价值没了。库自身的行为交给库的测试。
- **确定性**：无 sleep、无顺序依赖、无共享可变状态；flaky 测试比没有测试更糟，因为它会训练团队忽略红色。

### 3.10 落到 Kanban v2：MSW handlers + TanStack Query 的测试设计

Kanban v2 的接口按资源设计 handlers：

| 方法/路径 | 行为 | 测试关注 |
|---|---|---|
| `GET /api/tasks` | 列表 | loading、空列表、500、网络失败、重试 |
| `POST /api/tasks` | 创建 | 201、请求体、列表失效/出现 |
| `PATCH /api/tasks/:id` | 更新/完成 | 乐观更新、失败回滚、失效 |
| `DELETE /api/tasks/:id` | 删除 | 立即移除、失败恢复 |

目录建议：`src/mocks/handlers.ts`（handlers + 内存数据工厂）、`src/mocks/node.ts`（`setupServer`）、`src/test/renderWithClient.tsx`（每个测试新 QueryClient）、`vitest.setup.ts`（listen/reset/close）。

```tsx
test('列表请求失败显示错误，重试后恢复', async () => {
  server.use(http.get('/api/tasks', () =>
    HttpResponse.json({ message: 'boom' }, { status: 500 }),
  ))
  const user = userEvent.setup()
  renderWithClient(<TaskBoard />)

  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败')
  server.use(http.get('/api/tasks', () => HttpResponse.json(tasks)))

  await user.click(screen.getByRole('button', { name: '重试' }))
  expect(await screen.findByText('写周报')).toBeInTheDocument()
})
```

```tsx
test('乐观更新立即生效，失败后回滚', async () => {
  const pending = createDeferred<Response>()
  server.use(http.patch('/api/tasks/:id', () => pending.promise))
  const user = userEvent.setup()
  renderWithClient(<TaskBoard />)
  const checkbox = await screen.findByRole('checkbox', { name: '写周报' })
  await user.click(checkbox)
  await waitFor(() => expect(checkbox).toBeChecked())
  pending.resolve(HttpResponse.json({ message: 'boom' }, { status: 500 }))

  expect(await screen.findByRole('alert')).toHaveTextContent('更新失败')
  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name: '写周报' })).not.toBeChecked(),
  )
})
```

- Query key 和 URL 保持一致：`['tasks']` 对应 `GET /api/tasks`，`['tasks', id]` 对应 `GET /api/tasks/:id`；mutation 成功后 `invalidateQueries({ queryKey: ['tasks'] })`，MSW 的同一份内存数据会服务下一次 GET，测试只需等 UI 更新。
- loading：Query 初始 `isPending` 为 true；用 `getByRole('status')`/骨架断言，然后 `await findBy...`。要卡住请求用 `delay('infinite')` 或 deferred，但结束前 `resetHandlers()` + `unmount()`，并用 `AbortSignal` 中止未完成请求。
- error：500 显示业务错误；`HttpResponse.error()` 显示网络错误文案；两者分开测。重试按钮用 `server.use` 换成成功 handler，再 `await user.click`。
- 乐观更新：`onMutate` 里 `cancelQueries` + 快照 + `setQueryData`，所以点击后立即 checked；`onError` 回滚快照；`onSettled` 失效重拉。测试先断言“请求还没 resolve 就已更新”，再 resolve 失败响应，断言回滚和错误提示。
- 路由：用 `createMemoryRouter` + `RouterProvider` 包住 `<TaskBoard />`，测试导航、URL 查询参数、返回/前进；不要用真实 `window.history` 猜状态。
- 持久化：localStorage 测试用“写入 → `unmount` → 重新 render → 断言读回”；损坏 JSON 的降级路径也值得一条测试。
- 断言优先看 UI；不要以 `expect(fetch).toHaveBeenCalledWith(...)` 为主。MSW 按 URL/method 匹配 handler，请求体是否合法要在 handler 里自己检查；需要观察请求时用 `server.events.on('request:start', ...)` 调试，不要把调用次数写死。
- **msw 尚未安装**：v2 开始时 `npm i -D msw`，Node ≥ 22；本仓库 W3D4 练习继续用注入 fetcher / `vi.stubGlobal`，不要直接 import `msw`。

## 4. 常见误区

| 错误写法 | 正确写法 | 原因 |
|---|---|---|
| `container.querySelector('.task')` | `screen.getByRole('listitem')` / `within` | class 是实现细节，重构即碎，且不验证可访问性 |
| 所有元素都用 `getByTestId` | 优先 role/name/label/text | testid 用户不可见，掩盖 a11y 问题；仅动态文本等兜底 |
| `fireEvent.change(input, { target: { value: 'x' } })` | `await user.type(input, 'x')` | 只派发 change，缺 focus/keydown/input，测不到真实输入路径 |
| `fireEvent.submit(form)` | `await user.click(button)` / `user.keyboard('{Enter}')` | 绕过按钮点击、焦点和原生校验 |
| `await new Promise(r => setTimeout(r, 500))` | `await screen.findBy...` / `waitFor` | 固定睡眠慢且 flaky；CI 慢时不够、快时浪费 |
| 异步更新后立刻 `getByText` | `await screen.findByText` | 更新在微任务/定时器后，首次查询时还没提交 |
| `expect(renderCount).toBe(2)` / transition 精确计时 | 断言最终 UI / pending 标记 | 并发渲染可多次 render/丢弃，次数和时间不稳定 |
| `act(() => deferred.resolve(...))` | `await act(async () => { ... })` 或 await findBy | 同步 act 不 flush promise，警告仍在 |
| 共享一个 QueryClient 给所有测试 | 每个测试新建 client（`retry:false`、`gcTime:0`） | 缓存/重试/定时器跨用例泄漏，产生顺序依赖 |
| `server.listen()` 后不 reset | `afterEach(() => server.resetHandlers())` | 测试内 `server.use` 覆盖会泄漏到下一个测试 |
| `vi.clearAllMocks()` 当成恢复 | `vi.restoreAllMocks()` / `vi.unstubAllGlobals()` | clear 只清调用记录，不恢复 spy 实现或全局 stub |
| 只断言 store/internal state | 断言用户可见 UI；store 单独做单元测试 | 重构实现就红，测试没有行为契约 |
| 大组件 `toMatchSnapshot()` | 针对性断言；小而稳定的 inline snapshot | 任何 DOM 改动都要求更新快照，无法表达行为意图，diff 噪音大 |
| fake timers 留着不关，或 user-event 超时 | `afterEach(vi.useRealTimers)`；`userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` | user-event 内部 delay 依赖真实定时器，会卡住 |
| MSW 3 从 `msw` 导入 `http` / 用 `onUnhandledRequest` | `import { http } from 'msw/http'`；`onUnhandledFrame` | v3 改了入口与选项名 |
| Activity hidden 内容 `queryByRole` 找不到就以为卸载 | `getByText(...).not.toBeVisible()` / `getByRole(..., { hidden: true })` | Activity 保留 DOM/state，只从可访问性树隐藏 |
| 断言 `toHaveBeenCalledWith` 含随机 id/时间 | `expect.objectContaining` + stub 时间/随机 | 脆弱且不可重复 |

## 5. 三句话自测

1. **组件测试应该查什么、断言什么？** 先按 role/name/label 查用户可感知的元素，再用 user-event 走真实交互，最后断言可见结果；不要查 class/内部 state，也不要断言 render 次数，因为那些是 React 的实现而不是你的行为契约。
2. **`findBy` / `waitFor` / `waitForElementToBeRemoved` 怎么选，act 警告怎么修？** 等元素出现用 `findBy`，等非元素条件/复合断言用 `waitFor`，等元素消失用 `waitForElementToBeRemoved`；绝不 sleep，act 警告用 `await` user-event/findBy 或 `await act(async () => ...)` 包住外部 promise 的 resolve。
3. **MSW 3 的最小接入是什么，为什么比全局 fetch stub 好？** `setupServer(...handlers)` + `beforeAll(listen)` / `afterEach(resetHandlers)` / `afterAll(close)`，handlers 用 `http.get/post` 和 `HttpResponse.json`；它在网络层拦截 fetch/XHR/axios，复用真实 `Request`/`Response` 和同一套 handlers，而 fetch stub 只替换全局 fetch、需要手写路由且容易与实现耦合——本练习未装 MSW，所以用注入 fetcher / `vi.stubGlobal('fetch')` 等价模拟。

## 6. 官方阅读

- https://vitest.dev/guide/
- https://testing-library.com/docs/queries/about/
- https://mswjs.io/docs/quick-start
