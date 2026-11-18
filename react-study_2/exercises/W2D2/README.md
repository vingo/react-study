# W2D2：Suspense 与 use()

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修复 render 中新建 promise 的 bug：按参数缓存 promise，避免重复请求 | 15 分钟 |
| 2 | `ex2.tsx` | 补全 Error Boundary：pending 显示 fallback，reject 显示错误 UI，重试使用新请求 | 15 分钟 |
| 3 | `ex3.tsx` | 按 query 缓存 promise，并用 `key` 隔离请求，避免旧请求覆盖新结果 | 20 分钟 |

合计约 50 分钟。

## 开始

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W2D2
```

初始状态下测试是红的，且失败来自断言（不是导入或类型错误）：ex1 的两个用例都失败；
ex2 的两个错误处理用例失败；ex3 的缓存用例失败。ex2/ex3 的正常加载用例初始就能通过，
它们用来确认你没有破坏已有的 Suspense 行为。不要修改 `*.test.tsx` 里的断言。

完成后验收（两条命令都要通过）：

```bash
npx vitest run W2D2
npx tsc --noEmit
```

## 题目说明

### 1. 稳定 promise / 缓存

`Profile` 在 render 中调用 `fetchUser(userId)`。Suspense 重试时会再 render 一次，
父组件重新渲染也会再 render 一次，于是同一个用户被反复请求。React 会打印
“A component was suspended by an uncached promise” 警告。

修复方向：用模块级 `Map` 按参数缓存 promise，并在 `resetUserCache` 中清空它
（测试用它隔离用例）。注意缓存 key 是参数，不是组件。

`fetchUser` 返回的 promise 初始是 pending 的；测试调用 `resolvePendingFetches()`
让请求完成，这样才能稳定断言 fallback 出现、内容随后出现。

### 2. Error Boundary + Suspense

Suspense 只处理“还没完成”，不处理“失败了”。promise reject 时，错误会一路冒泡；
没有错误边界，React 会卸载整棵树。

需要自己写一个 class 组件：`getDerivedStateFromError` 记录错误，错误时渲染
`role="alert"` 的提示和“重试”按钮；点击后清空错误，并调用 `onRetry` 生成新的
promise。新 promise 作为 prop 传给子树，Suspense 会重新等待它。

### 3. 请求竞态与参数切换

两个问题要一起解决：

- **缓存**：`getPromise` 按 query 查 `Map`，命中就复用，避免相同 query 重复请求。
- **边界隔离**：给 `Suspense` 加 `key={query}`，让每个 query 拥有独立的边界和
  结果子树；切换时旧边界卸载、新边界从自己的 fallback 开始，结果区域的本地状态
  也会重置。测试不强制 key；竞态安全来自“UI 只读取当前 query 的缓存 promise”，
  旧 promise 完成时没有 setState 去覆盖新结果。key 是切换身份时的边界语义。

测试用两个受控 deferred promise 精确控制 resolve 顺序，不依赖真实计时器。

## 提示

- 在 render 里创建 promise 不是稳定引用；Suspense 重试会重新执行 render。
- `use(promise)` 依赖 promise 引用稳定；缓存保证“当前这次渲染读到的 promise 就是
  应该读的那个”。`key` 负责边界/子树身份，缓存负责 promise 身份，两者解决的问题不同。
- 错误边界只能捕获子树 render 阶段抛出的错误；重试的关键是让子树重新挂载。
- 测试中收到 `act(...)` 警告通常意味着 promise 在 `act` 外 resolve 了，
  用 `await act(async () => { deferred.resolve(); await deferred.promise })` 包起来。
  React 19 下，首次渲染就挂起或切换 query 引起挂起时，也要用异步 `act` 包住
  `render` / 点击，否则 Suspense 重试不会被 flush。测试里已经处理好，不必改。
- 练习 2 的 promise 由 `ProfilePanel` 用 `useState(() => loadProfile())` 创建，
  再作为 prop 传下去。不要把它挪进挂起的子组件：首次挂起前未提交的 state 不会保留，
  重试会重新执行初始化器，导致重复请求。

`solutions/` 内是参考实现。请先自己做，卡住超过十分钟再看。完成后发“验收 W2D2”。
