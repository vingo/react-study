# 学习进度

## 贯穿项目进度
| 版本 | 状态 | 完成日期 | 说明 |
|---|---|---|---|
| v1 任务看板 | 已完成 | 2026-11-16 | `apps/kanban`：Vite 8 + React 19 + TypeScript 7；useState / useEffect / useRef；localStorage 持久化与损坏数据降级；Vitest + Testing Library 18 个测试通过 |

下一步：学习 W4D1–W4D5（材料已生成）；W3D5 测验未完成；W2D1/W2D3/W2D5 与 W3D2/W3D3 的测验/练习待补；W3D4 已跳过。之后进入 v2（MSW + TanStack Query + React Router + Zustand）。

## 进行中
- **W2D1 Actions 与表单（重点）**：讲义、练习、测验已生成；练习待验收，测验待作答。
- **W2D2 Suspense 与 use()**：已判卷 3.95/9（需要重练）；练习 8/8 通过、类型检查通过，代码评审“基本掌握”。先重看讲义 3.2/3.5/3.6，再重做测验错题。
- **W2D3 TanStack Query 5**（2026-11-17）：讲义、练习、测验已生成；练习起始 5 失败 / 4 通过，参考答案 9/9 通过，类型检查通过。待完成测验与练习验收。
- **W2D5 状态管理选型（Zustand 5）**（2026-11-18）：讲义、练习、测验已生成；练习起始 8 失败 / 4 通过，参考答案 12/12 通过，类型检查通过。待完成测验与练习验收。
- **W3D1 Fiber 与协调（重点）**（2026-11-18）：讲义、练习、测验已生成；练习起始 15/15 失败，参考答案 15/15 通过。2026-11-19 判卷 7.5/9（基本掌握）；练习验收 15/15 通过，类型检查通过；ex2 的 move 判断与 ex3 的双缓冲符合约定。需补：Fiber 三指针为何不用数组、render 读旧 DOM 的解释、index key 错位机制。
- **W3D2 并发渲染**（2026-11-18）：讲义、练习、测验已生成；练习起始 5 失败 / 1 通过，参考答案 6/6 通过。2026-11-20 练习验收：6/6 通过，类型检查通过，无 act 警告；ex2 的嵌套 `startTransition`、ex3 的 `<Activity>` 用法正确。ex1 有一处语义瑕疵：`data-list-query` 应使用 `deferredQuery`，当前用了 `query`（测试未覆盖过渡期间的 DOM）。2026-11-20 判卷 5.5/9（需要复习，第 1 题薄弱）。
- **W3D3 性能与 React Compiler**（2026-11-18）：讲义、练习、测验已生成；练习起始 9 失败 / 8 通过，参考答案 17/17 通过，类型检查通过。2026-11-20 判卷 4.35/9（需要重练：第 1 题缺 Profiler 判断与结构优化，第 3 题大半未答）；练习待验收。
- **W3D5 手写 mini-react（重点中的重点）**（2026-11-18）：讲义、练习、测验已生成；练习起始 18 失败 / 1 通过，参考答案 19/19 通过。2026-11-24 练习验收：19/19 通过，类型检查通过，无 act 警告；keyed diff、hook 链表与 dispatch 实现正确。待清理：ex2/ex3 未使用的 React / @testing-library 导入（违反“源码不 import React”验收项）、ex3 死代码 `reconcileChildren222`；ex1 的 `props.children` 为 `0`/`''` 时会丢失子节点。2026-11-24 判卷（未完成）：已答部分约 0.8/9；第 1 题 B、第 2 题、第 3 题空白，暂不作为最终成绩；完成后再判。

### 第 4 周材料（已生成，待学习/验收）
- **W4D1 Server Components**（2026-11-24）：讲义 364 行、9 分测验与答案；练习 10 用例，起始 7 失败 / 3 通过，参考答案 10/10，类型检查通过。练习为纯 TS 语义模型，未安装 Next.js。2026-11-28 判卷 6.25/9（需要复习）：第 1 题 2.5/3、第 2 题 1.9/2.5、第 3 题 1.4/2.5；Suspense key 仍说反，memo 漏 children，提出“移除 server-only”作为修复，user/onLogout/apiKey 的序列化判断仍错。
- **W4D2 App Router**（2026-11-24）：讲义 496 行、9 分测验与答案；练习 10 用例，起始 8 失败 / 2 通过，参考答案 10/10，类型检查通过。覆盖文件约定、边界选择、fetch/Cache Components 缓存模型；练习为纯 TS 模型。
- **W4D3 Server Actions**（2026-11-24）：讲义 500 行、9 分测验与答案；练习 10 用例，起始 7 失败 / 3 通过，参考答案 10/10，类型检查通过。覆盖校验、鉴权/归属、revalidate/redirect 与 RSC 安全公告；练习为纯 TS 模型。
- **W4D4 React 19.3**（2026-11-24）：讲义 432 行、9 分测验与答案；练习 10 用例，起始 8 失败 / 2 通过，参考答案 10/10，类型检查通过。使用本机 React 19.3.1 的 ViewTransition、Fragment ref、真实 hydration 测试。
- **W4D5 综合复盘**（2026-11-24）：讲义 503 行（知识图谱、50 问、Kanban 白板、决策表）、9 分测验与答案；练习 12 用例，起始 10 失败 / 2 通过，参考答案 12/12，类型检查通过。含架构规划、Server Action 安全流水线、useOptimistic 乐观 UI capstone。

## 已跳过
- **W3D4 测试**（2026-11-23 决定跳过）：测试相关主题，不作为本轮学习重点。已生成的讲义、练习、测验保留供查阅：`notes/W3D4-testing.md`、`exercises/W3D4/`、`notes/W3D4-quiz.md`。

## 主题得分
| 主题 | 测验得分 | 掌握度 | 日期 |
|---|---|---|---|
| W1D1 渲染模型 | 0.5 / 7（7%） | 需要重练 | 2026-11-07 |
| W1D2 State | 3.75 / 8（47%） | 需要重练 | 2026-11-07 |
| W1D3 Effect | 3.25 / 9（36%） | 需要重练 | 2026-11-07 |
| W1D4 Ref 与 DOM | 6.0 / 8.5（71%） | 基本掌握 | 2026-11-07 |
| W1D5 组合与 Context | 3.75 / 9（42%） | 需要重练（代码通过） | 2026-11-07 |
| W2D2 Suspense 与 use() | 3.95 / 9（44%） | 需要重练（代码通过） | 2026-11-17 |
| W2D4 React Router 8 | 7.05 / 9（78%） | 基本掌握（代码 15/15） | 2026-11-18 |
| W3D1 Fiber 与协调 | 7.5 / 9（83%） | 基本掌握（代码 15/15） | 2026-11-19 |
| W3D2 并发渲染 | 5.5 / 9（61%） | 需要复习（第 1 题薄弱；代码 6/6） | 2026-11-20 |
| W3D3 性能与 Compiler | 4.35 / 9（48%） | 需要重练（第 3 题未答完） | 2026-11-20 |
| W4D1 Server Components | 6.25 / 9（69%） | 需要复习（Suspense key、序列化；练习 10/10） | 2026-11-28 |

## 薄弱点
- render 与 commit 的时序：首次 render 时 DOM 尚不存在；更新 render 读取到的是上一次 commit 的 DOM。
- 组件纯度：`reverse()` 会原地修改 props；StrictMode 双调用会让两次翻转相互抵消。
- state 保留规则：React 按树中位置、组件类型（以及 key）决定复用；同位置同类型保留 state，父节点类型变化会重置子树 state。
- state 更新队列：直接值更新会替换 pending state；更新函数才会读取上一步的 pending state，混用时严格按调用顺序计算。
- state 设计：`totalPrice` 可从 items 派生，不该单独存 state；`couponCode` 是不能由 items 推导的独立输入，应该存 state。
- 数组聚合：总价要计算 `item.price * item.quantity`，而不是读取不存在的 `item.totalPrice`。
- Effect 边界：由点击触发的 POST 放事件处理函数；随 `roomId` 同步的 WebSocket 放 Effect；由 state 推导的 UI 值在 render 中计算。
- Effect 生命周期：依赖变化时是旧 cleanup → 新 setup；卸载时执行最后一次 cleanup。
- 过期闭包：空依赖的 interval 闭包住初始 count；使用 `setCount(c => c + 1)`，并清理 interval。
- Effect 与 Effect Event：随 `roomId` 建立/断开 WebSocket 的机制用 `useEffect`；Effect 内连接成功等非响应式回调用 `useEffectEvent` 读取最新 `theme` 而不触发重连。
- Ref 的 UI 边界：修改 `ref.current` 不会重渲染；若数量要立即显示更新，使用 `useState` 和 setter。
- key 重置 state：同位置同类型默认保留 state；`key={recipient.id}` 变化会卸载并重建 Chat，随机 key 会让每次 render 都重建并丢失 state。
- reducer 纯度：`toggled` 应按 `action.id` 用 `map` 返回新数组、只复制目标 task；ID 等随机值在事件中生成后放入 action，不能在 reducer 中生成。
- `use` 条件调用与 try/catch：`use` 不是 Hook，可条件调用；放在 try/catch 会吞掉 Suspense 信号，pending 时错误显示错误 UI，rejection 也无法到达 Error Boundary。
- 稳定 promise：render 中 `fetch()`、async 调用或 `.then()` 都会新建 promise；挂起后从头重试会反复挂起/请求，必须按参数缓存同一实例。
- Suspense 更新语义：首次挂载一定显示 fallback；普通 setState 更新显示 fallback 且 `isPending=false`；transition 更新保留旧内容且 `isPending=true`。
- key 与边界：key 应加在 Suspense 边界（或上层）以重置边界身份；不加 key 时 transition 会继续显示旧内容。
- 错误边界与重试：重试必须同时重置边界并换新 promise；只递增 attempt 无效。Error Boundary 不捕获事件/普通异步错误。
- Effect 请求竞态：旧响应后到会覆盖新结果；用 ignore 标记或 AbortController 清理；切换时保留旧内容 + isPending，避免闪烁。
- loader 404：`throw new Response(..., { status: 404 })` 的 status 是 404；`useRouteError` 读取 status/data/statusText，`errorElement` 替换它所在路由的 element，根边界会连布局一起替换。
- action 与 redirect：`redirect()` 必须 `return` 或 `throw`；裸调用会被丢弃。校验错误用 `useActionData` 读取；正常返回会触发 loader revalidate。
- 导航 pending：action 执行期间是 `submitting`，action 完成后的 loader 重验证是 `loading`；不能用 `loading` 判断提交中。
- 路由参数：path 动态段改名（`:projectId` → `:id`）后，所有 `params.projectId` 与 `useParams()` 读取处都要同步改。
- URL 作为状态：对象形式的 `setSearchParams` 会替换整个查询串；保留其他参数要先复制 `new URLSearchParams(prev)`。本地草稿 state 与 URL 状态并存会产生两份真相。
- `setSearchParams` 删除参数：`delete` 后不要无条件 `set` 同一个参数；`all`/空字符串分支要用 `else` 或提前 `return`，否则会留下 `?status=all`、`?q=` 这类脏参数。
- 前进/后退：POP 导航会重新执行 loader，组件通常不重新挂载；`useNavigationType()` 返回 `'POP'`。
- Fiber 三指针：能说出 `child`/`sibling`/`return` 与 DFS 顺序，但没说明为何不用 `children: Fiber[]`（链表可中断、只需改少量指针，数组要维护整层子节点）。
- render 读 DOM：点击后 `render` 读到的是上一次 commit 的 `textContent`（0），而本次 `count` 已是 1；render 阶段不写 DOM。
- index key 错位：能算出插入/删除后的输入框值，但没点明 state 留在“位置”上；删除 A 时 A 的 state 被 B 复用，而不是被销毁。
- key 身份语义：稳定 `key={item.id}` 保留 state 和 DOM（含焦点）；``key={`${id}-${index}`}`` 会让所有 key 失配、整层卸载重建。
- Effect cleanup 措辞：卸载时执行的是最后一次 setup 的 cleanup，不是“新 cleanup”。
- `useDeferredValue` 的观察值：`data-list-query` 应反映列表实际使用的 `deferredQuery`，而不是最新 `query`；否则过渡期间 DOM 元数据与列表内容不一致。
- transition 与受控输入：受控 input 的 `value` 更新不能放进 transition，否则输入不能可靠显示；`startTransition` 回调同步执行，慢计算不会被自动挪到后台。
- `isPending` 时序：从调用 `startTransition` 到 transition 提交期间为 `true`；新输入会中断并重启后台渲染，但不会让它提前变 `false`，输入框也不会被阻塞。
- `await` 之后的更新：transition 作用域丢失，`setResults` 变成普通紧急更新；要再包一层 `startTransition`，并用请求 id/AbortController 处理乱序。
- Suspense 与 key：不加 key 时 transition 保留已显示的旧内容；`key={query}` 让边界成为新身份，新边界挂起会显示 fallback。
- Activity 与条件渲染：Activity 隐藏只清理 Effects，保留 state 和 DOM；`{cond && <Home />}` 会卸载组件，state/DOM 全部销毁。
- Activity 的 DOM 副作用：`<video>` 等 DOM 自身状态不会因 Effect cleanup 自动停止，需在返回的 cleanup 中 `pause()`；清理逻辑写在 setup 里会导致隐藏时泄漏、显示时重复订阅。
- Profiler 读数：`actualDuration ≈ baseDuration` 说明 memo 没让 `Chart` 跳过渲染；这些数字不含 commit/paint/Effect/Profiler 外子树，`baseDuration` 只是估算。
- memo 失效与结构优化：`options`/`onSelect` 每次新建引用会让 `memo` 失效；状态下沉 + `children` 组合比逐个稳定 props 更彻底。
- `memo` 的价值条件：频繁因父组件重渲染、props 浅比较相同、渲染确实昂贵；C1 算术与 C2 宿主事件不值得，C3 排序先测量。
- `useMemo` 副作用：计算函数在 render 阶段执行，不能做 `analytics.track`；依赖漏 `status` 会一直返回旧筛选结果。
- 内层箭头函数：`onPick={() => handlePick(item.id)}` 每次 render 新建，缓存外层 `handlePick` 也救不了 `memo`；直接传 `handlePick`，由 Row 调用 `onPick(item.id)`。
- React Compiler 识别范围：只编译组件/Hook（PascalCase 或 `use` 前缀且返回 JSX/调用 Hook），普通工具函数不单独编译；memo 结果不跨组件共享。
- Compiler 与 Rules of React：遇到 mutation 会 bailout，不会自动修正；`"use no memo"` 只是诊断/临时隔离，正确做法是消除 mutation。
- 手动 memo 的去留：不能全删，Effect 依赖等场景仍需稳定引用；memo 是性能优化，不是正确性保证，且不替代 Profiler 测量。
- mini-react 验收项：源码不 import React，测试只用原生 DOM；未使用的导入不影响测试结果，但违反验收标准，应删除。
- `createElement` 的 children 判断：`props.children` 是否存在要用 `!== undefined`，不能用 truthy，否则 `0` 和空字符串会被当成“没有 children”。
- mini-react keyed diff：匹配键是“同层 + key + type”；复用 fiber 时 alternate 指向旧 fiber，DOM 与 hook state 才能跟随 key；未匹配旧 fiber 进入 deletions，commit 按新 sibling 顺序 append 实现移动。
- mini-react 元素形状：`type` 在元素顶层，不是 `props.type`；`props.id` 应为 `'app'`；文本要包成 `TEXT_ELEMENT`，`nodeValue` 保留数字。
- JSX 编译：经典 runtime 调 `React.createElement`，自动 runtime 调 `jsx` / `jsxs`；组件函数出现在元素的 `type` 字段，元素对象既不是 DOM 也不是 Fiber。
- key 重置：`<Chat key={recipient.id} />` 可让每位收件人拿到空白草稿；随机 key 每次 render 都重建，草稿、焦点、DOM 与 Effects 全部丢失。
- `'use client'` 是客户端模块图入口，不是“只在客户端执行”；Client Component 也会在服务端预渲染 HTML，Tooltip 等传递依赖会一起进入客户端 bundle。
- Suspense 的 key：`key` 放在 `<Suspense>` 上会改变边界身份，挂起时显示 fallback；不加 key 时同一边界在 transition 中保留旧内容。用户当前将两者说反了。
- memo 的 children：`children` 也是 prop，父组件每次 render 新建 `<ExpensiveTable />` 元素会击穿 `memo`；稳定 props 之外还要用状态下沉/组合从源头减少渲染。
- RSC 跨边界 props：类实例和普通函数不可序列化；Date、Set 可序列化；`apiKey` 字符串可序列化但绝不能传给客户端。序列化能力不等于安全。
- `user` / `onLogout` / `apiKey` 的序列化判断：`user` 是类实例，需先转普通 DTO；`onLogout` 是普通异步函数，不能跨边界；`apiKey` 不是“加密信息”，而是可序列化但绝不可外传的明文秘密。
- 移除 `server-only` 不是修复：Client 模块图仍会把服务端代码/依赖拉进浏览器；正确方向是 Server Component 作为 owner，把 Server UI 作为 `children` 传入 Client Shell。
- owner 与 parent：Server Component 作为 owner 把 Server UI 作为 `children` 传给 Client Shell；Client Shell 的 state 变化不会重新执行 Server child，更新需要新的服务端渲染/payload。

## 复习队列
| 题目来源 | 概念 | 下次复习日期 | 连续答对次数 |
|---|---|---|---|
| W1D1 第 1 题 | render / commit 时序与读取 DOM | 2026-11-20 | 1 |
| W1D1 第 2 题 | 不可变更新、StrictMode 双调用 | 2026-11-08 | 0 |
| W1D1 第 3 题 | state 按位置和类型保留 | 2026-11-08 | 0 |
| W1D2 第 1 题 | state 更新队列、直接值与更新函数混用 | 2026-11-08 | 0 |
| W1D2 第 3 题 | 派生数据与独立 state、reduce 聚合 | 2026-11-08 | 0 |
| W1D3 第 1 题 | render、事件处理函数与 Effect 的职责边界 | 2026-11-08 | 0 |
| W1D3 第 2 题 | Effect cleanup 与 setup 的时序 | 2026-11-19 | 0 |
| W1D3 第 3 题 | interval 过期闭包、更新函数与 cleanup | 2026-11-08 | 0 |
| W1D4 复习 1 | Effect 卸载时的最后 cleanup | 2026-11-08 | 0 |
| W1D4 复习 2 第 3 项 | useEffect 与 useEffectEvent 的职责 | 2026-11-08 | 0 |
| W1D4 第 2 题 | ref 更新不触发 render；使用 state 更新 UI | 2026-11-08 | 0 |
| W1D5 复习 1 | 直接值更新与更新函数混用的 pending state 顺序 | 2026-11-10 | 1 |
| W1D5 复习 2 | useEffect / useEffectEvent 的职责边界 | 2026-11-08 | 0 |
| W1D5 第 1 题 | 状态提升：最近公共父级、activeId、受控子组件 props | 2026-11-08 | 0 |
| W1D5 第 2 题 | 稳定 key 的 state 重置语义与随机 key 的危害 | 2026-11-08 | 0 |
| W1D5 第 3 题 | reducer 的不可变更新与纯函数约束 | 2026-11-08 | 0 |
| W2D2 第 1 题 | `use` 条件调用、try/catch 与稳定 promise | 2026-11-18 | 0 |
| W2D2 第 2 题 | Suspense fallback、transition 与 key 重置边界 | 2026-11-18 | 0 |
| W2D2 第 3 题 | Error Boundary 重试、Effect 请求竞态 | 2026-11-21 | 1 |
| W2D4 第 1 题 | 嵌套路由、Outlet、404 与 errorElement | 2026-11-19 | 0 |
| W2D4 第 2 题 | loader/action、redirect、useNavigation | 2026-11-19 | 0 |
| W2D4 第 3 题 | URL 作为状态、useSearchParams、POP | 2026-11-19 | 0 |
| W3D1 第 1 题 | Fiber 三指针、为何不用 children 数组、双缓冲 | 2026-11-21 | 0 |
| W3D1 第 2 题 | render 读上一次 commit 的 DOM、commit 才写 DOM | 2026-11-20 | 0 |
| W3D1 第 3 题 | index key 的 state 错位、key 身份语义 | 2026-11-20 | 0 |
| W3D1 复习 1 | state 更新队列：直接值替换、更新函数读 pending | 2026-11-22 | 0 |
| W3D1 复习 2 | 事件 / Effect / render 的职责边界 | 2026-11-22 | 0 |
| W3D2 第 1 题 | transition 受控输入、isPending、await 后更新、Suspense key | 2026-11-21 | 0 |
| W3D2 第 2 题 | useDeferredValue 旧值、memo、Suspense 与 debounce 区别 | 2026-11-23 | 0 |
| W3D2 第 3 题 | Activity 预渲染、Effects、媒体清理、纯文本子树 | 2026-11-22 | 0 |
| W3D2 复习 1 | render 纯度：StrictMode 双调用与生产环境的差异 | 2026-11-23 | 0 |
| W3D2 复习 2 | key 作为组件身份、随机 key 的后果 | 2026-11-21 | 0 |
| W3D3 第 1 题 | Profiler 读数、memo 失效、结构优化顺序 | 2026-11-21 | 0 |
| W3D3 第 2 题 | useMemo 依赖与副作用、内层回调、memo 取舍 | 2026-11-22 | 0 |
| W3D3 第 3 题 | React Compiler 识别范围、bailout、指令与手动 memo | 2026-11-21 | 0 |
| W3D3 复习 1 | 位置 + 类型 + key 决定 state 保留 | 2026-11-23 | 0 |
| W3D3 复习 2 | reducer 纯度、不可变更新、随机 ID 的位置 | 2026-11-22 | 0 |
| W3D5 复习 1 | state 更新队列：直接值替换、更新函数读 pending | 2026-11-29 | 1 |
| W3D5 复习 2 | key 重置草稿、随机 key 的后果 | 2026-11-25 | 0 |
| W3D5 第 1 题 | createElement 元素形状、工作循环、双缓冲 | 2026-11-25 | 0 |
| W3D5 第 2 题 | keyed diff、lastPlacedIndex、index key | 2026-11-25 | 0 |
| W3D5 第 3 题 | Hook 链表顺序、更新队列、render 纯度 | 2026-11-26 | 0 |
| W4D1 复习 1 | transition、受控输入、Suspense key | 2026-11-29 | 0 |
| W4D1 复习 2 | memo 的 children prop、状态下沉 | 2026-11-29 | 0 |
| W4D1 第 1 题 | RSC/SSR、模块图、跨边界序列化 | 2026-12-01 | 0 |
| W4D1 第 2 题 | Server/Client children 组合、owner/parent | 2026-11-29 | 0 |
| W4D1 第 3 题 | 序列化与安全、三条 RSC 误区 | 2026-11-29 | 0 |
