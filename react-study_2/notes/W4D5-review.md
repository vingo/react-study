# W4D5：综合复盘：把 React 19 串成一套可复述的体系

> 以 React 19.3.1 / react-dom 19.3.1、React Compiler 1.0、TanStack Query 5、Zustand 5、React Router 8、Vitest 5.1、Testing Library 16 为准。这是四周课程的收束，不引入新的 API 堆叠。本机**没有安装 Next.js 16**；第 4 周的全栈部分按 App Router / RSC / Server Actions 的心智模型复盘，缓存 API 的签名以 Next.js 16 官方文档为准，练习用现有依赖模拟。

## 1. 一句话结论

React 19 的整套体系可以压缩成一句话：**用纯函数把状态映射成 UI，用调度决定先做哪次映射，用边界把“服务端真相、客户端缓存、交互状态”隔开，再用测试锁住这些边界**；性能优化只是在这条链路里减少不必要的工作，而不是改变链路本身。

如果面试只能讲三件事，就讲这三件：

1. **一次更新怎么走完**：事件 → 调度（lane）→ render（Fiber 工作循环，可中断）→ commit（同步写 DOM、跑 Effect）→ paint。
2. **状态放在哪里**：局部 / URL / 服务端缓存 / 客户端全局，四类状态四个 owner，绝不双写。
3. **边界在哪里**：Server / Client Component、Server Action、Query 缓存、URL、Zustand 各自能信什么、不能信什么。

## 2. 知识图谱

```text
                         ┌──────────────── 一次用户可见的更新 ────────────────┐
用户事件 / URL 导航 /     │                                                    │
服务器推送 / Action 结果  │  调度器：给 update 选 lane（紧急 / transition / idle）│
        │                │        │                                           │
        ▼                │        ▼                                           │
   setState / action ────┘   render 阶段（可中断、可重做）                     │
                                 │  Fiber 工作循环：beginWork → completeWork   │
                                 │  组件函数必须纯；读的是上一次 commit 的 DOM  │
                                 ▼                                             │
                            commit 阶段（同步、不可中断）                       │
                                 │  写 DOM → ref → layout effect → paint        │
                                 ▼                                             │
                            浏览器绘制                                          │
                         └────────────────────────────────────────────────────┘

数据与边界（从真相到视图）
  DB / 第三方服务
    │  RSC fetch（带 cache tag）            Server Action（鉴权 + 校验 + 事务）
    ▼                                             │
  Server Component 树 ──可序列化 props──► Client Component 岛屿 ──action──┘
    │                                             │
    │ 首屏 HTML / RSC payload                     ├─ TanStack Query：服务端状态缓存
    ▼                                             ├─ URL：可分享的筛选/分页/tab
  浏览器 hydration                                ├─ 局部 state：展开、草稿、拖拽
                                                  └─ Zustand：跨路由客户端全局/瞬态协作
```

课程主线顺序（也是面试叙述顺序）：

```text
渲染模型 → state / Effect → 并发 / Suspense → 数据获取（Query）
        → 路由（React Router / App Router）→ 状态管理（Zustand）
        → 性能 / Compiler → 测试 → Fiber / mini-react
```

按层拆开：

| 层 | 核心问题 | 关键机制 / API | 典型失效模式 | 对应讲义 |
|---|---|---|---|---|
| 渲染模型 | 什么时候算、什么时候写屏幕 | 纯函数、render/commit、StrictMode | render 里改 props、读旧 DOM 当新值 | W1D1 |
| state | 更新如何排队、什么该存 | 快照、批处理、更新函数、不可变更新 | 直接值覆盖 pending、派生值重复存 | W1D2 |
| Effect / ref | 如何同步外部系统 | 依赖、cleanup、`useEffectEvent`、ref 作为 prop | 用 Effect 处理点击、过期闭包 | W1D3 / W1D4 |
| 组合 | 状态放哪、如何共享 | children、状态提升、Context、key 重置 | 状态放太高、Context value 每次新引用 | W1D5 |
| 并发 | 如何保持响应 | lane、`useTransition`、`useDeferredValue`、`<Activity>` | 把受控输入放进 transition | W3D2 |
| Suspense | 渲染期如何等待 | `use()`、fallback、Error Boundary、稳定 promise | 每次 render 新建 promise、try/catch 吞信号 | W2D2 |
| 数据获取 | 服务端状态如何缓存 | queryKey、staleTime/gcTime、mutation、失效 | 把 Query 数据复制进 state/Zustand | W2D3 |
| 路由 | URL 如何映射布局与数据 | loader/action、嵌套路由、searchParams | URL 与本地 state 两份真相 | W2D4 |
| 状态管理 | 客户端全局状态如何订阅 | Zustand selector、`useShallow`、persist | 什么都全局、selector 返回新对象 | W2D5 |
| 全栈 | 服务端/客户端边界 | RSC、`'use client'`、Server Actions、cache tag | 在客户端做权限、相信 FormData | W4D1–W4D4 |
| 性能 | 如何减少可感知卡顿 | Profiler、memo、虚拟化、Compiler | 先包 memo 再测量 | W3D3 |
| 测试 | 如何证明行为没坏 | Testing Library、MSW、行为断言 | 断言 render 次数/内部 state | W3D4 |
| 原理 | React 内部如何实现 | Fiber 三指针、双缓冲、keyed diff、Hook 链表 | 把实现细节当 API 契约 | W3D1 / W3D5 |

三条主线贯穿全课程：

- **数据流主线**：状态 → render → commit。任何“UI 不更新 / 更新了两次 / 读到旧值”的问题，先放回这条线定位。
- **边界主线**：服务端真相、客户端缓存、URL、局部 UI 各自有 owner。架构题的本质是“把每份数据放到正确边界内”。
- **正确性主线**：纯 render、不可变更新、稳定 key、稳定 promise、服务端鉴权。性能优化永远排在正确性之后。

## 3. 分主题复盘

### 3.1 渲染模型：render 是计算，commit 是写入

- render 阶段调用组件函数、计算新的元素树，可被中断、丢弃、重做；commit 阶段同步把差异写入 DOM、设置 ref、执行 layout effect，不能被打断。
- 首次 render 时 DOM 还不存在；更新 render 读到的是**上一次 commit** 的 DOM。所以在 render 里读 `textContent` 得到的是旧值，不是本次更新后的值。
- 组件必须是纯函数：同样的 props/state 返回同样的 UI，不修改参数、不在 render 里发请求或写 storage。StrictMode 双调用会放大不纯行为。
- 性能诊断先分清“render 贵”还是“commit/DOM 贵”：render 贵可以考虑拆分、memo、虚拟化、transition；commit 贵要先减少真实 DOM/样式/layout 工作。

### 3.2 state：快照、队列与不可变更新

- `setState` 不会修改当前闭包里的变量；它请求一次新 render，下一次 render 才能看到新快照。
- 同一事件里的多次更新会批处理；直接值会替换 pending state，更新函数会读取上一步的 pending state。混用时严格按调用顺序计算。
- 对象/数组更新必须创建新引用；reducer 必须纯，随机 ID 在事件处理函数里生成后放进 action。
- 能派生的值不要存 state（总价、过滤结果、未读数）；把“独立输入”和“派生结果”分开。
- state 的身份由“树中位置 + 类型 + key”决定；同位置同类型保留 state，类型变化或 key 变化会卸载重建。

### 3.3 Effect 与 ref：只同步外部系统

- Effect 适合同步“React 之外”的东西：订阅、WebSocket、第三方小部件、浏览器 API；点击触发的请求放事件处理函数，派生 UI 在 render 里算。
- 依赖变化时执行顺序是“旧 cleanup → 新 setup”；卸载时执行最后一次 setup 的 cleanup。
- 空依赖闭包会读到初始值；用更新函数、依赖数组或 `useEffectEvent` 读取最新值而不重连。
- `ref.current` 变化不触发 render；要立即显示的值用 state。ref 可以作为普通 prop 传递，ref 回调可以返回 cleanup。
- 受控组件把真相放在 React state；非受控组件把真相放在 DOM，用 `defaultValue` / ref 读取。不要在两者之间摇摆。

### 3.4 组合与状态选型：先问 owner，再问工具

- 默认从局部 `useState` 开始；兄弟共享就提升到最近公共父级；跨多层子树才用 Context；跨路由/跨布局/React 外也要读才用 Zustand。
- children 组合和状态下沉通常比 memo 更彻底：让无关 state 变化根本不触发昂贵子树的 render。
- Context 解决依赖注入，不解决高频更新；value 每次新引用会让所有消费者重渲染。
- Zustand 只管客户端全局状态；selector 默认 `Object.is` 比较，返回对象/数组时拆原子 selector 或用 `useShallow`。
- 服务端状态不要复制进 Zustand/local state；Query/RSC 是 owner，其他层只读。

### 3.5 并发与 Suspense：响应性不是速度

- 并发渲染的目标是“紧急更新不被慢工作阻塞”，不是让总工作变少。lane 决定优先级，transition 把更新标成可等待、可中断。
- `useTransition` 适合你拥有 setter 的更新；`useDeferredValue` 适合值来自 props/context、你只能延迟消费的场景。两者都不减少总工作量。
- 受控输入的值必须同步更新，不能放进 transition；要延迟的是下游列表/图表。
- `startTransition` 回调同步执行；`await` 之后丢失同步上下文，之后的 setState 要再包一层 `startTransition`，并用请求 id/AbortController 处理乱序。
- Suspense 首次挂载一定显示 fallback；普通 setState 更新也会显示 fallback；transition 更新保留旧内容并给出 `isPending`。给边界加 key 可以重置身份。
- `use()` 可以条件调用，但不要放进 try/catch：它会用异常传递挂起信号，吞掉后错误 UI 和 Error Boundary 都失效。
- 稳定 promise 是 Suspense 的生命线：render 里每次 `fetch()` 都会新建 promise，挂起后重试会反复请求；按参数缓存同一个 promise。
- `<Activity>` 隐藏时保留 state 和 DOM、销毁 Effect；条件渲染会卸载整棵子树。媒体等 DOM 自身状态要在 cleanup 里暂停。

### 3.6 数据获取：TanStack Query 的缓存账本

- queryKey 是缓存地址，也是 queryFn 的依赖；key 里要包含所有影响结果的参数。
- `staleTime` 决定数据多久算新鲜，`gcTime` 决定无观察者后缓存保留多久；`isPending` 表示还没有数据，`isLoading` 表示首次请求正在进行。
- mutation 成功后用 `invalidateQueries` 标 stale 并后台重取，或 `setQueryData` 立即写缓存；乐观更新要先快照、失败回滚、最终以服务器为准。
- `placeholderData: keepPreviousData` 能在翻页/搜索时保留旧数据，避免闪烁；它不是“新数据已经到了”。
- 同一份数据只设一个 owner：Query 的数据不要再复制进 `useState`/Zustand，否则失效刷不到副本。

### 3.7 路由：URL 是状态的公共接口

- React Router 8 的嵌套路由把 URL 映射成一棵布局树；`<Outlet>` 渲染子路由，loader 在渲染前取数，action 处理提交并触发 revalidate。
- `redirect()` 必须 `return` 或 `throw`；裸调用会被丢弃。校验错误用 `useActionData` 读，正常返回会触发 loader 重新验证。
- `useNavigation().state` 区分 `submitting`（action 执行中）与 `loading`（loader 重验证）；不要用 `loading` 判断提交中。
- 筛选、分页、tab、可分享的搜索词放 URL；`setSearchParams` 对象形式会替换整个查询串，保留其他参数要先复制。
- 前进/后退是 POP 导航，会重新执行 loader，组件通常不重新挂载。
- App Router 把路由段变成 Server Component 树：`layout.tsx`、`page.tsx`、`loading.tsx`、`error.tsx` 各司其职；客户端交互通过 `'use client'` 岛屿接入。

### 3.8 RSC、Server Actions 与缓存：边界就是信任边界

- RSC 在服务端执行，可以直接读数据库/密钥，不能使用 state、Effect、浏览器 API；它产出的 UI 以 RSC payload 流式传输，客户端只负责 hydration 和交互岛屿。
- `'use client'` 标记的是**模块边界**：该模块及其客户端依赖进入客户端 bundle；它不意味着“只在浏览器运行”，Client Component 仍会在服务端预渲染 HTML。
- 跨边界 props 必须可序列化；不要传函数（Server Action 引用除外）、类实例、密钥、数据库连接。Promises 可以跨边界，但要有明确的 Suspense 边界。
- Server Action 本质是**公开的 POST 端点**：客户端可以伪造参数、重复调用、绕过 UI。必须在 Action 内部做 session 认证、项目归属/角色授权、输入校验、业务约束校验、事务与限流。
- 不要把权限判断放在客户端；不要相信 FormData 里的 `role`、`projectId`、`canEdit`；不要用隐藏字段表达授权。
- 写操作成功后用 tag 失效相关缓存：`revalidateTag` 是“标记失效”，不是“写入缓存”；tag 按资源命名（`board:${id}`、`comments:${id}`），失效点跟写操作走。
- `revalidateTag` / `revalidatePath` / `updateTag` / `refresh` 的取舍与签名以 Next.js 16 官方文档为准；核心是“让下一次读取重新取数”，而不是依赖客户端手动刷新。
- 2025 年末披露的 RSC / Server Actions 相关安全公告提醒：要及时升级 `react-server-dom-*` 与框架补丁；补丁不能替代业务鉴权。
- 流式渲染用 Suspense 边界切分慢数据；错误用 Error Boundary / `error.tsx` 接住；hydration mismatch 优先找“服务端与客户端首帧不一致”的来源（时间、随机数、浏览器分支），不要用 `suppressHydrationWarning` 掩盖结构错误。

### 3.9 性能与 Compiler：先测量，再减少工作

- 诊断顺序：复现真实交互 → Profiler 找最慢 commit → 看 flamegraph/ranked 和 “Why did this render?” → 判断 render/commit/网络/layout → 用最小手段修复 → 同场景复测。
- 优化顺序：修数据流（去多余 state/Effect、状态下沉）→ 组合/拆分 → 稳定引用 → 虚拟化/并发 → Compiler。memo 只对“频繁、props 稳定、render 昂贵”的组件有价值。
- `memo` 只浅比较 props；一个每次新建的对象/函数就能击穿。`useMemo`/`useCallback` 是性能提示，不是语义保证；不要让正确性依赖缓存命中。
- Compiler 1.0 在构建期对符合 Rules of React 的组件/Hook 自动做等价 memoization；违规代码会被跳过（bailout），不会自动修正。它主要改善更新性能，不降低 DOM/布局/网络成本，不替代 Profiler。
- transition/deferred 只调优先级，不减少总工作量；大列表的 DOM 数量要靠虚拟化，单行 render 贵要靠拆分/缓存，二者不是一回事。

### 3.10 测试：锁住行为与边界

- 测试金字塔按风险排序：核心用户路径 → 失败/边界 → 可访问性/键盘 → 回归 → 性能/视觉（jsdom 之外）。
- Testing Library 的查询优先级：`getByRole(role, { name })` → `getByLabelText` → 文本；`data-testid` 只用于没有语义的场景。
- 交互用 `userEvent` 走真实事件路径；异步用 `findBy*`/`waitFor`，不要 sleep。请求用 MSW 或轻量 fetch mock 控制成功/失败/延迟。
- 测行为而不是内部 state/render 次数；性能测试只做粗粒度趋势护栏，不断言毫秒数和精确 commit 数。
- 每个测试独立：重置 store、清 localStorage、重置 handler；flaky 测试比没有测试更糟。
- 架构边界也可以单测：像本课的 `planKanban` 和 `moveCardAction` 一样，把决策和服务端核心写成纯函数/可注入依赖，测试不需要浏览器。

### 3.11 Fiber 与 mini-react：理解“为什么 API 是这样”

- Fiber 是链表化的调用栈：`child` 向下、`sibling` 向右、`return` 向上；工作循环可以暂停、恢复，这是并发渲染的结构基础。
- 双缓冲：`current` 是屏幕上那棵树，`workInProgress` 是正在构建的树；commit 后切换根指针，旧树成为下一次的 alternate。
- diff 只比较同层，靠 `type + key` 匹配；key 稳定才能复用 DOM 和 state，index key 会在插入/删除时让 state 错位。
- commit 按新树的 sibling 顺序插入/移动 DOM；删除的旧 Fiber 进入 deletions。
- Hook 是 Fiber 上的链表，顺序必须稳定；更新队列保存 pending 更新，render 时按顺序计算。这就是“不能条件调用 Hook”的根本原因。

## 4. 面试题库（50 问）

### 渲染与 state

1. **render 和 commit 的区别？** render 是调用组件函数、计算新树，可中断可重做；commit 是同步写 DOM、ref、layout effect，不可中断。追问：为什么 render 里读 DOM 会读到旧值？
2. **为什么组件必须是纯函数？** 因为 React 可能多次调用、丢弃或重做 render；不纯会让 StrictMode 双调用、并发中断和时间旅行出现不可预测结果。追问：哪些副作用应该放哪里？
3. **StrictMode 为什么开发环境渲染两次？** 它故意双调用 render/reducer/初始化函数，暴露不纯和缺少 cleanup 的问题；生产构建不会因此变慢。追问：Effect 的双 setup/cleanup 说明什么？
4. **state 更新的快照语义是什么？** `setState` 不会改当前闭包变量，而是请求下一次 render；下一次 render 才看到新快照。追问：同一事件里连续三次更新怎么算？
5. **直接值和更新函数混用时顺序如何？** 严格按调用顺序：直接值替换 pending，更新函数读取上一步 pending；混用容易得到反直觉结果。追问：为什么 `setCount(count + 1)` 连续两次只加一？
6. **key 的作用是什么？** key 是同级元素的身份，决定 React 复用哪个 Fiber/DOM/state；同位置同类型同 key 才复用。追问：key 为什么不要用随机数？
7. **index key 有什么问题？** 插入/删除会让位置与身份错位，state 和 DOM 跟着错误元素走；排序列表尤其明显。追问：什么时候 index key 可以接受？
8. **状态应该放在哪一层？** 局部 UI 放组件，可分享状态放 URL，服务端事实放 Query/RSC，跨路由客户端全局状态才放 Zustand。追问：如何判断一个值是派生值？
9. **派生值为什么不该存 state？** 它会制造两份真相，更新不同步时 UI 矛盾；能在 render 里从现有 state/props 算出的就不要存。追问：昂贵派生值怎么办？

### Effect、ref 与组合

10. **什么时候需要 Effect？** 只在同步 React 之外的系统时使用：订阅、WebSocket、第三方控件、浏览器 API；点击请求放事件处理函数。追问：为什么“数据获取 Effect”通常不如 loader/Query？
11. **Effect 的 cleanup 什么时候执行？** 依赖变化时先跑旧 cleanup 再跑新 setup；卸载时跑最后一次 setup 的 cleanup。追问：空依赖 Effect 的 cleanup 何时跑？
12. **过期闭包怎么产生、怎么修？** 空依赖闭包捕获初始值；用更新函数、补全依赖、`useEffectEvent` 或 ref 读取最新值。追问：为什么不能简单地把所有值都塞进依赖？
13. **`useEffectEvent` 解决什么问题？** 让 Effect 内部的非响应式逻辑读取最新 props/state，而不因为该值变化重连/重订阅。追问：它和 `useCallback` 的区别是什么？
14. **ref 和 state 的边界？** ref 变化不触发 render，适合 DOM 引用和跨 render 的可变值；要显示在 UI 上的值用 state。追问：ref 回调返回 cleanup 有什么用？
15. **状态提升、Context、Zustand 怎么选？** 先提升到最近公共父级；跨多层且低频用 Context；跨路由/高频/React 外读取用 Zustand。追问：Context value 每次新引用会怎样？
16. **受控与非受控的区别？** 受控的真相在 React state，非受控的真相在 DOM；受控更可预测，非受控更接近原生表单。追问：切换两者会丢失什么？

### 并发与 Suspense

17. **并发渲染解决了什么？** 让紧急更新（输入、点击）不被慢 render 阻塞，render 可中断、可丢弃；它不减少总工作量。追问：为什么 transition 不会让慢组件变快？
18. **lane 是什么？** 每个 update 带的优先级标记，调度器据此决定先渲染谁；transition、Suspense、Idle 是不同 lane。追问：高优先级更新如何打断低优先级 render？
19. **`useTransition` 和 `useDeferredValue` 的区别？** 前者标记你拥有的 setter 更新，后者延迟一个值的消费；前者有 `isPending`，后者靠 `value !== deferred`。追问：慢子组件为什么必须 memo？
20. **受控输入能放进 transition 吗？** 不能，输入值必须同步更新；要延迟的是下游结果，可用第二个 state 或 deferred value。追问：把 input value 放进 transition 会发生什么？
21. **`await` 之后的 setState 还算 transition 吗？** 同步上下文丢失后不再自动属于 transition，要再包一层 `startTransition`；请求本身从未被延迟。追问：如何避免旧响应覆盖新结果？
22. **Suspense 在挂载和更新时的行为？** 首次挂载显示 fallback；普通更新也显示 fallback；transition 更新保留旧内容并 `isPending=true`。追问：key 如何重置 Suspense 边界？
23. **`use()` 有哪些限制？** 可以条件调用，但不要放 try/catch；promise 必须稳定，否则挂起重试会反复请求；错误由 Error Boundary 接住。追问：为什么 try/catch 会吞掉挂起信号？
24. **`<Activity>` 和条件渲染的区别？** Activity 隐藏保留 state/DOM、销毁 Effect；条件渲染卸载整棵子树。追问：视频播放这类 DOM 状态怎么处理？

### 数据、路由与状态管理

25. **queryKey 为什么重要？** 它是缓存地址和 queryFn 依赖，key 里缺参数会命中错误缓存；key 变化会触发新查询。追问：数组 key 的顺序和对象字段顺序有影响吗？
26. **staleTime 和 gcTime 的区别？** staleTime 决定多久算新鲜、是否后台重取；gcTime 决定无观察者后缓存保留多久。追问：`isPending` 和 `isLoading` 的区别？
27. **mutation 成功后如何同步缓存？** 失效相关 key 让 active 查询后台重取，或直接 `setQueryData`；乐观更新要先快照、失败回滚、最终以服务器为准。追问：为什么不能只改本地 state？
28. **哪些状态应该放 URL？** 筛选、分页、tab、可分享的搜索词；刷新、分享、前进后退都要成立。追问：为什么不能同时存 URL 和本地 state？
29. **loader 和 TanStack Query 如何分工？** 首屏/深链必需数据用 loader 阻塞渲染；跨页面缓存、后台刷新、乐观更新用 Query；需要桥接时用 `ensureQueryData` 预热同一 key。追问：为什么不要在 Effect 里 fetch 路由关键数据？
30. **Zustand selector 为什么要小心？** 默认 `Object.is` 比较输出，返回新对象/数组会每次被判为新快照，导致额外渲染甚至循环；拆原子 selector 或用 `useShallow`。追问：`useShallow` 是深比较吗？
31. **服务端状态能放 Zustand 吗？** 不建议：去重、重试、失效、GC 都要重造；Query/RSC 才是服务端状态 owner。追问：什么情况下可以把 Query 数据放进 store？

### RSC、Server Actions、安全与缓存

32. **RSC 和 SSR 是一回事吗？** 不是。SSR 是把客户端组件树预渲染成 HTML；RSC 是在服务端执行组件、产出可流式传输的 RSC payload，客户端不下载这些组件的 JS。追问：Client Component 还会 SSR 吗？
33. **`'use client'` 到底标记什么？** 标记模块边界：该模块及依赖进入客户端 bundle；它不表示“只在浏览器运行”，客户端组件仍会被预渲染和 hydration。追问：为什么不能在 Client Component 里直接读数据库？
34. **跨 RSC/Client 边界什么能传？** 可序列化的 props；函数一般不行（Server Action 引用除外），类实例、密钥、数据库连接不行。追问：Promise 能传吗？需要什么配合？
35. **Server Action 为什么必须自己鉴权？** 它是公开的 POST 端点，客户端可伪造参数、重复调用、绕过 UI；必须在内部做 session、角色/归属、输入和业务校验。追问：为什么不能相信隐藏字段里的 projectId？
36. **Server Action 和 Route Handler 怎么选？** 表单/变更且希望与 RSC 缓存集成用 Server Action；需要公开 REST/Webhook、流式响应或非 React 客户端用 Route Handler。追问：两者能否共享服务层？
37. **cache tag 和失效点怎么设计？** tag 按资源命名，写操作成功后失效受影响资源；tag 是失效索引，不是缓存内容。追问：移动卡片应该失效哪些 tag？
38. **`revalidateTag` 和 `revalidatePath` 的区别？** 前者按数据 tag 失效，后者按路由路径失效；优先用 tag，粒度更稳，路径容易漏。追问：为什么失效后用户不一定立刻看到新数据？
39. **RSC 相关 CVE 给架构什么教训？** 框架/运行时补丁必须及时升级；但补丁不能替代业务鉴权，Action 内部仍要按“公开端点”设计。追问：升级后还要检查什么？
40. **流式渲染怎么切边界？** 用 Suspense 包住慢数据区域，让快区域先出；错误用 Error Boundary/`error.tsx` 接住；边界要按用户体验划分。追问：边界太细会有什么代价？
41. **hydration mismatch 怎么排查？** 找服务端与客户端首帧不一致的来源：时间、随机数、浏览器分支、非法嵌套；修根因，不要用 `suppressHydrationWarning` 掩盖结构错误。追问：为什么 `Date.now()` 容易出问题？

### 性能、Compiler 与测试

42. **拿到“页面卡”先做什么？** 录真实交互，用 Profiler 找最慢 commit 和热点，判断 render/commit/网络/layout，再按结构 → 引用 → 虚拟化/并发 → Compiler 修复并复测。追问：为什么不能先给所有组件包 memo？
43. **memo 真正有价值的条件？** 频繁因父组件重渲染、props 浅比较稳定、render 确实昂贵；一个每次新建的 prop 就能让它失效。追问：children 组合为什么常比 memo 更彻底？
44. **Compiler 1.0 做了什么、没做什么？** 构建期对符合 Rules of React 的组件/Hook 自动 memoization；不优化普通函数、不跨组件共享缓存、不降低 DOM/网络成本，违规会 bailout。追问：`"use no memo"` 应该怎么用？
45. **transition/deferred 能替代虚拟化吗？** 不能；它们只调优先级，元素和 DOM 数量不变；虚拟化解决数量，memo/拆分解决单行成本。追问：大列表首屏慢应该先做什么？
46. **测试策略怎么排优先级？** 核心用户路径 → 失败/边界 → 可访问性/键盘 → 回归 → 性能/视觉；测行为，不测内部 state 和精确 render 次数。追问：MSW 和 fetch mock 的取舍？
47. **Fiber 为什么用三指针而不是 children 数组？** 链表可中断、恢复时只需改少量指针，数组要维护整层子节点；这是并发工作的结构基础。追问：`return` 指针对应什么？
48. **双缓冲怎么工作？** `current` 是屏幕上的树，`workInProgress` 是正在构建的树；commit 后切换根指针，旧树留作下一次 alternate。追问：为什么复用时 DOM 能跟着 key 走？
49. **keyed diff 的核心规则？** 同层比较，用 `type + key` 匹配；未匹配的旧 Fiber 删除，匹配的复用并移动 DOM，最后按新 sibling 顺序插入。追问：lastPlacedIndex 解决什么问题？
50. **Hook 为什么不能条件调用？** Hook 存在 Fiber 的链表上，按调用顺序对应；条件调用会让后续 Hook 错位，读到别的 state/effect。追问：更新队列如何保存多次 setState？

## 5. Kanban 架构白板

面试白板题通常从“设计一个看板”开始。不要先写组件，先画三条线：**路由树、数据边界、一次写操作的链路**。

### 5.1 v2：Vite SPA 的客户端架构

```text
main.tsx
  QueryClientProvider
    RouterProvider
      /boards                 BoardListPage（loader 或 Query）
      /boards/:boardId        BoardLayout
        index                 BoardPage
          FilterBar（URL 状态）
          BoardCanvas（拖拽、乐观更新）
          CardDrawer（局部 UI）
        cards/:cardId         CardDetail（Query）
      /boards/:boardId/settings
                              SettingsPage（权限 UI）

数据：
  MSW / REST ──► TanStack Query（服务端状态）
  URL searchParams ──► 筛选/分页/tab
  Zustand ──► sidebar、命令面板、presence
  局部 state ──► 拖拽中、展开、草稿
```

v2 的关键决策：

- 列表/详情是服务端状态，owner 是 Query；`queryKey: ['board', boardId]`，mutation 后 `invalidateQueries`。
- 筛选是 URL 状态，`?status=done&q=...`；不要复制进 Zustand。
- 拖拽的“正在拖哪张卡”是局部/瞬态状态；服务端顺序只在 drop 成功后提交。
- MSW 负责列表、创建、失败、延迟场景；测试按用户行为断言。
- 错误/加载分三层：路由级（loader/errorElement）、查询级（isPending/isError）、组件级（按钮 pending）。

### 5.2 v3：Compiler 与测试护栏

- 开启 React Compiler 1.0 之前先用 Profiler 录一条基线；开启后同场景复测，不把“编译了”当成“更快了”。
- Compiler 只优化符合 Rules of React 的组件/Hook；不纯的拖拽计算、动态 ref、mutation 会被跳过。
- 测试覆盖核心路径：创建、移动、筛选、刷新、失败重试、权限拒绝；不测精确 render 次数。
- 性能回归只做趋势断言（commit 次数、是否 bail out），毫秒数交给生产 profiling/真机。

### 5.3 v4：App Router 的边界

```text
app/
  layout.tsx                         RSC：全局 shell
  boards/page.tsx                    RSC：看板列表（cache tag: boards）
  boards/[boardId]/
    layout.tsx                       RSC：认证 + 项目/看板归属
    page.tsx                         RSC：读取 board snapshot（tag: board:id）
    loading.tsx                      RSC：骨架
    error.tsx                        Client：错误边界
    cards/[cardId]/page.tsx          RSC：卡片详情（tag: cards:id）
    settings/page.tsx                RSC：权限门禁（tag: members:projectId）
    settings/audit/page.tsx          RSC：审计日志（tag: audit:projectId）
  actions/move-card.ts               'use server'：鉴权 + 校验 + 事务 + revalidateTag
```

边界表（白板上直接画）：

| 模块 | 边界 | 数据来源 | 缓存 tag | 失效点 |
|---|---|---|---|---|
| 看板列表 | RSC | 服务端 fetch | `boards` | 创建/删除看板 |
| 看板快照 | RSC | 服务端 fetch | `board:${id}` | 移动/编辑卡片成功后 |
| 卡片详情 | RSC | 服务端 fetch | `cards:${id}` | 卡片编辑成功后 |
| 筛选栏 | Client | URL searchParams | 无 | 不失效，导航即变 |
| 拖拽画布 | Client | 初始 props + 本地乐观层 | 无（读 `board`） | 调用 Server Action |
| 实时评论 | Client | TanStack Query + 订阅 | `comments:${id}` | 发评论成功后 |
| 在线状态 | Client | Zustand / WebSocket | 无 | 过期即丢 |
| 权限设置 | RSC | 服务端 fetch | `members:${projectId}` | 角色变更成功后 |
| 审计日志 | RSC | 服务端 fetch | `audit:${projectId}` | 记录写入后（通常追加） |

**同一份数据只设一个 owner**：v4 的看板快照归 RSC；如果评论需要实时增量，就单独用 Query 管 `comments`，不要把 board 数据再复制进 Query/Zustand。若确实需要客户端 Query 管 board，则 RSC 只做 shell，二者择一。

### 5.4 一次“移动卡片”的完整链路

```text
用户拖拽 / 点击“移到完成”
  │
  ├─ Client island：useOptimistic 立即把卡片放进目标列，isPending=true
  │
  ├─ 调用 Server Action moveCardAction({ cardId, toListId, toIndex })
  │     ├─ getSession()              → 未登录：UNAUTHENTICATED
  │     ├─ 解析/校验输入              → 非法：INVALID_INPUT
  │     ├─ 查 card/board/project      → 不存在：NOT_FOUND
  │     ├─ 角色 owner/editor？         → 否：FORBIDDEN
  │     ├─ 目标列表属于同看板？        → 否：INVALID_INPUT
  │     ├─ 事务内移动 + 重排 position  → 失败：PERSIST_FAILED（回滚）
  │     └─ revalidateTag(`board:${id}`)
  │
  ├─ 成功：Action 返回新卡片；transition 结束，乐观层消失；
  │         RSC 重新取数（或客户端用返回值收敛），UI 以服务端为准
  │
  └─ 失败：不写真实状态；乐观层撤回；role="alert" 提示；可重试
```

关键点：

- 乐观层不是数据源，只是“请求期间的临时覆盖”；它不持久化、不跨页面。
- 失败回滚不是“再发一个反向请求”，而是丢弃乐观层，让真实状态重新显示。
- 服务端必须假设请求来自恶意客户端：UI 的 disabled、隐藏字段、前端角色判断都只是体验，不是安全边界。
- 成功后失效 tag，让下一次 RSC 读取拿到新数据；如果客户端同时有 Query 缓存，也要失效对应 key，但不要双写。

### 5.5 错误与加载矩阵

| 场景 | UI | 实现 |
|---|---|---|
| 首屏看板慢 | 骨架/流式区域 | `loading.tsx` / Suspense |
| RSC 取数失败 | 页面级错误 + 重试 | `error.tsx` / Error Boundary |
| 评论加载慢 | 局部 skeleton | 评论区 Suspense |
| 移动提交中 | 按钮禁用 + “保存中…” | `useTransition` / `useOptimistic` |
| 移动失败 | 回滚 + alert + 重试 | Action 返回错误码 |
| 权限不足 | 403 视图/隐藏入口 | 服务端 `notFound()`/`forbidden()` 或错误页 |
| 会话过期 | 跳转登录并保留回跳 | Action 返回 UNAUTHENTICATED，客户端处理 |

### 5.6 测试策略

- 纯决策层（`planKanban`、权限/校验流水线）：单元测试，直接断言返回码与 store 快照。
- 组件层（拖拽岛屿、评论、筛选）：Testing Library + 注入 action/deferred promise，断言乐观态、pending、回滚。
- 路由/RSC 层：集成测试或 E2E（Playwright，本环境未安装），覆盖登录、权限、缓存失效、深链。
- 回归：每个线上 bug 留一条先红后绿的测试；性能只做趋势保护，不做毫秒断言。
- 安全：未登录、越权、跨项目、非法输入、重复提交、失败回滚都要有测试。

### 5.7 五分钟白板口述脚本

1. “先画路由树：列表、看板、卡片详情、设置、审计；页面段默认 RSC。”
2. “再标边界：列表/详情/权限/审计在服务端；筛选、拖拽、评论、presence 是客户端岛屿。”
3. “再定数据 owner：看板快照 RSC，评论 Query，筛选 URL，presence Zustand，拖拽中状态局部。”
4. “最后画写链路：乐观更新 → Server Action 鉴权/校验/事务 → revalidateTag → RSC 刷新；失败回滚。”
5. “测试按这三层各留一条：决策单测、交互集成、端到端核心路径。”

## 6. 决策表

### 6.1 状态放在哪里

| 状态 | owner | 生命周期 | 工具 | 反例 |
|---|---|---|---|---|
| 展开/折叠、hover、拖拽中、输入草稿 | 组件局部 | 挂载到卸载 | `useState` / `useReducer` | 放 Zustand，卸载后残留 |
| 筛选、分页、tab、可分享搜索词 | URL | 刷新/分享/前进后退 | searchParams / loader | 复制进 state 或 store |
| 任务、用户、订单、评论 | 服务端 + 缓存 | staleTime/gcTime 或 tag | RSC / TanStack Query | 复制进 Zustand/local state |
| 主题、侧边栏、命令面板、presence | 客户端全局 | 应用会话 | Zustand / Context | 把服务端数据也塞进来 |

### 6.2 Server Component 还是 Client Component

| 需求 | 选择 | 理由 |
|---|---|---|
| 直接读 DB/密钥、首屏数据 | Server | 不进客户端 bundle，少一次 API |
| 需要 `useState`/Effect/浏览器 API | Client | 服务端组件不能用这些 |
| 只有静态展示、可序列化 props | Server | 减少 JS |
| 大列表中的交互行 | Client 岛屿 | 只把交互下沉，不把整页变客户端 |
| 权限判断、审计写入 | Server | 客户端可伪造，不能作为信任边界 |
| 实时订阅、拖拽、乐观更新 | Client | 需要浏览器状态与事件 |

### 6.3 React Router 还是 App Router

| 维度 | React Router 8（v2） | Next.js App Router（v4） |
|---|---|---|
| 运行模型 | SPA，客户端路由 | RSC + 客户端岛屿，服务端路由 |
| 取数 | loader / Query | RSC fetch / Server Action |
| 首屏 | JS 加载后渲染（可预渲染） | 服务端流式输出 |
| 适用 | 内部工具、已有 SPA、纯客户端部署 | SEO/首屏/全栈一体、服务端数据密集 |
| 代价 | 自己拼 SSR/缓存/鉴权 | 边界、序列化、缓存模型更复杂 |

### 6.4 TanStack Query 还是 RSC fetch

| 场景 | 选择 |
|---|---|
| 首屏/深链必需的看板快照 | RSC fetch（tag 失效） |
| 跨页面缓存、后台刷新、重试、乐观更新 | TanStack Query |
| 实时评论/通知 | Query + 订阅 |
| 只需要服务端渲染一次、无客户端交互 | RSC fetch |
| 同一数据既要 loader 又要客户端缓存 | `ensureQueryData` 预热同一 key，绝不双写 |

### 6.5 memo、Compiler 还是 transition

| 问题 | 手段 |
|---|---|
| 父组件无关更新导致昂贵子树重渲染 | 状态下沉 / children 组合 → 再考虑 memo |
| props 稳定、render 昂贵、频繁更新 | `memo` + 稳定引用 |
| 输入被慢列表阻塞 | `useDeferredValue`（输入用原值） |
| 你拥有的 setter 引发慢更新 | `useTransition` |
| 全项目基线、符合 Rules of React | React Compiler |
| DOM 数量过大 | 虚拟化，不是 memo/transition |

### 6.6 Server Action 还是 Route Handler

| 需求 | 选择 |
|---|---|
| React 表单/按钮触发的变更，需 RSC 缓存集成 | Server Action |
| 公开 REST API、Webhook、非 React 客户端 | Route Handler |
| 需要自定义流式响应/文件下载 | Route Handler |
| 两者都需要 | 共享服务层，Action/Handler 只做协议适配 |

## 7. 常见误区与“如果面试官追问”

| 误区 | 正确认识 | 追问深入点 |
|---|---|---|
| “RSC 就是 SSR” | RSC 是在服务端执行组件并产出 RSC payload；SSR 是预渲染 HTML；二者可组合但不同 | Client Component 仍会被 SSR，hydration 仍会发生 |
| “`'use client'` 表示只在浏览器运行” | 它标记模块边界，客户端组件仍会服务端预渲染 | 为什么客户端组件里不能直接用 `fs`/DB |
| “Server Action 是内部函数，参数可信” | 它是公开 POST 端点，参数可伪造、可重放 | 如何在 Action 内做认证、授权、限流、CSRF/Origin 校验 |
| “前端隐藏按钮/角色判断就够了” | 权限必须在服务端每次校验 | 越权测试怎么写；viewer 能不能通过直接调用绕过 |
| “`revalidateTag` 会写缓存” | 它标记失效，下一次读取重新取数 | tag 粒度、失效时机、用户为何仍看到旧数据 |
| “乐观更新失败会自动回滚” | 只有正确使用 `useOptimistic`/快照回滚才会；服务端失败要显式处理 | 回滚后是否要 refetch；重复提交如何幂等 |
| “transition 让渲染变快” | 只调优先级，总工作不变 | 为什么慢组件仍需 memo/虚拟化；受控输入为何不能 transition |
| “memo 能阻止 context/自身 state 更新” | memo 只比较 props | context value 新引用、状态下沉、拆分 context |
| “Compiler 会自动修不纯代码” | 违规会 bailout，不会修正 | `"use no memo"` 的定位；如何用 ESLint/日志找跳过项 |
| “key 只是消除 React 警告” | key 是身份，决定 state/DOM 复用 | index key 在删除/排序时的错位；随机 key 的后果 |
| “数据放 Zustand 最方便” | 服务端状态归 Query/RSC，URL 归 URL | 两份真相如何导致失效刷不到、后退不同步 |
| “测试覆盖率越高越好” | 覆盖率是诊断，不是 KPI；核心路径和失败路径优先 | 如何测乐观回滚、权限拒绝、缓存失效 |
| “hydration 报错用 suppress 压掉” | 先找首帧不一致的根因 | 时间/随机数/浏览器分支/非法嵌套 |
| “性能优化从包 memo 开始” | 先测量，再结构，再缓存，最后 Compiler | Profiler 读数、actual/base、commit 与 render 的区别 |

## 8. 五分钟自测

1. **能否用 60 秒讲清一次点击的完整链路？** 事件 → setState → 调度 lane → render（Fiber 可中断）→ commit（DOM/ref/Effect）→ paint；并说明哪一步可能读到旧 DOM。
2. **能否用一张表说清四类状态的 owner？** 局部、URL、服务端缓存、客户端全局；每类各举一个 Kanban 例子，并说明双写的后果。
3. **能否白板画出 Kanban v4 的边界与移动链路？** RSC 页面/布局、客户端岛屿、Server Action 的鉴权/校验/事务、tag 失效、乐观回滚、错误/加载/测试策略。
4. **能否解释三个“不”：** transition 不减少工作、memo 不阻止 context、Compiler 不修不纯代码；并各给出一个正确替代方案。
5. **能否说出面试追问的三个深水区？** Server Action 是公开端点、RSC props 序列化边界、缓存 tag 失效与客户端缓存的一致性。

## 9. 延伸阅读

前面各章笔记（按课程顺序）：

- [W1D1 渲染模型](W1D1-render-model.md)
- [W1D2 State](W1D2-state.md)
- [W1D3 Effect](W1D3-effects.md)
- [W1D4 Ref 与 DOM](W1D4-refs-dom.md)
- [W1D5 组合与 Context](W1D5-composition-context.md)
- [W2D1 Actions 与表单](W2D1-actions-forms.md)
- [W2D2 Suspense 与 use()](W2D2-suspense-use.md)
- [W2D3 TanStack Query 5](W2D3-tanstack-query.md)
- [W2D4 React Router 8](W2D4-react-router.md)
- [W2D5 状态管理选型](W2D5-state-management.md)
- [W3D1 Fiber 与协调](W3D1-fiber-reconciliation.md)
- [W3D2 并发渲染](W3D2-concurrent-rendering.md)
- [W3D3 性能与 React Compiler](W3D3-performance-compiler.md)
- [W3D4 测试](W3D4-testing.md)
- [W3D5 手写 mini-react](W3D5-mini-react.md)
- [W4D1 Server Components](W4D1-server-components.md)
- [W4D2 App Router](W4D2-app-router.md)
- [W4D3 Server Actions](W4D3-server-actions.md)

官方文档：

- https://react.dev/learn
- https://react.dev/reference/react/useOptimistic
- https://react.dev/reference/react/useTransition
- https://react.dev/reference/react/useDeferredValue
- https://react.dev/reference/react/use
- https://react.dev/reference/rsc/server-components
- https://react.dev/reference/rsc/server-functions
- https://tanstack.com/query/latest/docs/framework/react/overview
- https://reactrouter.com/
- https://zustand.docs.pmnd.rs/
- https://nextjs.org/docs/app
- https://vitest.dev/
- https://testing-library.com/docs/react-testing-library/intro/
