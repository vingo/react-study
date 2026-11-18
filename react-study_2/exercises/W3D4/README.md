# W3D4：测试（Vitest 5 + Testing Library + fetch mock）

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修 bug：补全 label / button / aria-pressed，让测试按 role + accessible name 查询 | 15 分钟 |
| 2 | `ex2.tsx` | 补全实现：loading / error / empty / success 四态与重试 | 15 分钟 |
| 3 | `ex3.tsx` | 小功能：创建任务表单的校验、pending、失败错误与失败后重试成功 | 20 分钟 |

合计约 50 分钟。测试文件是验收标准，不要修改断言；也不要修改共享的
`package.json`、`vitest.config.ts`、`tsconfig.json`，不要安装依赖。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W3D4
npx tsc --noEmit
```

如果 `node -v` 不是 24.x，先把 Node 放进 PATH（见项目根目录 `.nvmrc`）：

```bash
export PATH=/Users/maochaobo/.nvm/versions/node/v24.22.2/bin:$PATH
```

初始状态：3 个测试文件、9 个用例，**9 个全部失败**，失败全部是
`TestingLibraryElementError`（按 role / 可访问名称 / 文本找不到元素），
不是导入、语法或类型错误：

- `ex1.test.tsx`：3 失败。搜索框没有 label，`role="searchbox"` 配不上名称
  “搜索任务”；“只看未完成”是 `div`，没有 button role；它也不在 Tab 顺序里。
- `ex2.test.tsx`：3 失败。没有 `role="status"` 的 loading、没有“收件箱为空”、
  没有 `role="alert"` + 重试按钮。
- `ex3.test.tsx`：3 失败。空标题没有校验提示；提交时没有“提交中…”的 pending
  按钮；失败后没有 `role="alert"`，也没有可重试的路径。

参考答案 **9/9 通过**，无 act 警告、无未处理 rejection；起始与参考答案都通过
`npx tsc --noEmit`。

验证参考答案（覆盖后记得恢复起始文件）：

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
for n in 1 2 3; do cp W3D4/ex$n.tsx /tmp/w3d4-ex$n.starting.tsx; cp W3D4/solutions/ex$n.tsx W3D4/ex$n.tsx; done
npx vitest run W3D4
npx tsc --noEmit
for n in 1 2 3; do cp /tmp/w3d4-ex$n.starting.tsx W3D4/ex$n.tsx; done
```

最终 `npx vitest run W3D4` 应回到 9 个失败。

## 测试约定

- 查询优先级：`getByRole(role, { name })` → `getByLabelText` → 文本查询。
  `data-testid` 和 `container.querySelector` 只适合没有语义、也没有替代查询
  方式的场景；本题的控件都有用户可见的名字。
- 交互统一用 `userEvent.setup()`：点击、输入、Tab、Enter 都走真实的事件路径。
- 异步断言用 `findBy*` / `waitFor`。**不要用 `sleep`、`setTimeout` 或固定等待
  去猜时间**；请求何时完成由 fetch mock 的 deferred 精确控制。
- 不断言 render 次数、内部 state 或 hook 调用顺序。测试只回答一个问题：
  用户看到了什么、做了什么、结果是否可见。
- 每个用例相互隔离：`server.reset()` 清空路由与调用记录，`ex3` 还会
  `localStorage.clear()`。不要依赖上一个用例留下的数据。

## fetch mock 与 MSW 的对应关系

环境里**没有安装 MSW，本练习也不需要安装**。`test-utils.tsx` 用一个轻量的
fetch mock 代替：组件仍然调用全局 `fetch`，测试按 HTTP method + URL pathname
注册 handler，并返回真实的 `Response` 对象。

```ts
const server = setupFetchMock()

beforeEach(() => server.reset())
afterAll(() => server.restore())

server.on('GET', '/api/inbox', () => jsonResponse([{ id: 'm1', title: '周报' }]))
server.on('POST', '/api/tasks', () => textResponse('服务器错误', { status: 500 }))
```

| 本练习 | MSW 3.x |
|---|---|
| `server.on('GET', '/api/inbox', () => jsonResponse(data))` | `http.get('/api/inbox', () => HttpResponse.json(data))` |
| `textResponse('...', { status: 500 })` | `new HttpResponse('...', { status: 500 })` |
| `createDeferred<Response>().promise` | handler 内 `await delay(...)`，或自己控制 resolver |
| `server.reset()` | `server.resetHandlers()` |
| `setupFetchMock()` / `server.restore()` | `setupServer(...handlers)` / `server.listen()` / `server.close()` |

差异主要在“安装方式”（MSW 拦截网络层，这里替换 `globalThis.fetch`）和
“延迟控制”（MSW 用 `delay`，这里用 deferred）；handler 的匹配思路、返回
真实 `Response`、以及“每个用例重置 handler”的习惯是一样的。

**MSW 的实际接入放到 Kanban v2**：v2 要做 TanStack Query + React Router +
Zustand 的完整数据流，届时安装 MSW，用 `setupServer` 覆盖列表、创建、失败与
延迟场景，本练习的 handler 写法可以逐条迁移过去。现在不要为了练习修改
`package.json` 或 lockfile。

## 题目提示

### 1. 可访问性 bug

- 用 `<label>搜索任务<input type="search" /></label>` 让输入框获得名称
  “搜索任务”。placeholder 是“输入关键词”，它不能替代字段名。
- 把 `<div onClick>` 换成 `<button type="button">`：按钮天然进入 Tab 顺序，
  并响应 Enter / Space。
- 切换按钮用 `aria-pressed={onlyOpen}` 暴露开/关状态；测试会断言它。
- 不要只给 div 加 `role="button"` 就结束：还需要 `tabIndex`、键盘事件处理。
  换成原生 `<button>` 更简单，也更可靠。

### 2. 异步四态与重试

- 用 `attempt` state 作为 Effect 依赖。点击“重试”时 `setAttempt(a => a + 1)`，
  Effect 重新执行；在 Effect 开头 `setStatus('loading')`，用户立刻看到反馈。
- `response.ok` 为 false 时抛错并进入 error；网络错误（fetch reject）同样进入
  error。成功后再区分空数组与有数据。
- 错误 UI 需要有 `role="alert"` 的文本和名为“重试”的按钮，二者都是用户可见
  行为，测试按 role 查找。
- 用 `ignore` 标记或 `AbortController` 防止旧请求晚到后覆盖新状态；重试时
  旧请求的响应不能把 loading 改成 success。

### 3. 创建任务表单

- 先 `title.trim()` 再判空；空字符串或纯空格都显示“请输入任务标题”，并且
  **不发起请求**。
- `isSubmitting` 控制按钮：提交中 `disabled`，文案变成“提交中…”。用
  `try / catch / finally` 保证失败后复位。
- 成功后追加服务端返回的任务、清空输入；失败时保留输入并显示
  “创建失败，请重试”，用户可以直接再次点击提交。
- 测试覆盖“失败后重试成功”：同一个用例里第一次 handler 返回 500，第二次
  返回成功。不要在两次测试之间共享 `attempts` 计数器或 localStorage 数据。

`solutions/` 里是参考答案。**请先独立完成，卡住超过 10 分钟再看。**
完成后发“验收 W3D4”。
