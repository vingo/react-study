# React 巩固学习计划（多智能体并行版）

## 目标与假设
- 目标：4 周把 React 19 的心智模型、数据流、原理、全栈（Next.js）串成一套可复述、可动手的体系。
- 假设：已有 React 使用经验；工作日 1.5–2h，周末 3–4h。时间不够就把每周拉长，顺序不变。
- 基线版本（2026-11 npm 最新）：React 19.3、React Compiler 1.0、Vite 8、Next.js 16、
  TypeScript 7、TanStack Query 5、Zustand 5、React Router 8、Vitest 5。
- 环境：Node 24.22.2（nvm，项目根目录有 `.nvmrc`）。注意 `/usr/local/bin/node` 仍是 20.11.1，
  非交互 shell 默认会用到它，运行 npm/npx 前需先 `export PATH=/Users/maochaobo/.nvm/versions/node/v24.22.2/bin:$PATH`。
- 练习环境已就绪：`exercises/` 下有 Vitest 5 + jsdom + Testing Library + TypeScript 7，`npm test` 运行全部练习。

## 四条并行轨道
| 轨道 | 负责智能体 | 产出位置 | 何时运行 |
|---|---|---|---|
| A 原理讲解 | `concept-tutor` | `notes/` | 每天开始，与 B、D 并行 |
| B 练习生成 | `exercise-coach` | `exercises/` | 每天开始，与 A、D 并行 |
| C 代码评审 | `code-reviewer` | 对话中反馈 | 你写完代码后，与 D 判卷并行 |
| D 测验复习 | `quiz-master` | `PROGRESS.md` | 每天开始出题，结束时判卷 |

并行的意义：A/B/D 三者只依赖当天主题、互不依赖，所以一次命令同时启动，
你拿到讲义、练习、测验时三者已全部就绪。C 依赖你的代码，只能放在后面。

## 每日节奏（约 90 分钟）
1. `/study-day W1D1`：并行生成讲义 + 练习 + 课前 3 题（约 2 分钟等待）。
2. 读讲义 20 分钟，先答课前题（不查资料，暴露盲区）。
3. 做练习 50 分钟，让测试由红变绿。
4. `/study-review W1D1`：并行执行代码评审 + 判卷，薄弱点写入 `PROGRESS.md`。
5. 第二天的测验会自动混入前几天的薄弱点（间隔复习）。

## 贯穿项目：任务看板（apps/kanban）
同一个项目每周升级一次，比做四个玩具项目更省时间，也更接近真实工作。
- v1（第 1 周末）Vite 8 + TS：列表/卡片增删改、拖拽排序（可选）、localStorage 持久化。
- v2（第 2 周末）MSW 模拟后端 + TanStack Query + React Router + Zustand，带乐观更新。
- v3（第 3 周末）开启 React Compiler，Profiler 对比前后；Vitest + Testing Library 覆盖核心流程。
- v4（第 4 周末）迁移到 Next.js 16 App Router：RSC 取数、Server Actions、流式加载，部署上线。

## 日程表（主题 ID 供命令使用）

### 第 1 周：核心心智模型
| ID | 主题 | 要点 |
|---|---|---|
| W1D1 | 渲染模型 | 组件是纯函数、render 与 commit 阶段、StrictMode 为何渲染两次 |
| W1D2 | State | 快照语义、自动批处理、更新函数、不可变更新、state 结构设计原则 |
| W1D3 | Effect | 同步外部系统、依赖与清理、"你可能不需要 Effect"、useEffectEvent |
| W1D4 | Ref 与 DOM | useRef、ref 作为普通 prop、ref 回调清理函数、受控与非受控 |
| W1D5 | 组合与 Context | children 组合、状态提升、用 key 重置状态、useReducer + Context |

### 第 2 周：异步、数据与路由
| ID | 主题 | 要点 |
|---|---|---|
| W2D1 | Actions 与表单 | form action、useActionState、useFormStatus、useOptimistic |
| W2D2 | Suspense 与 use() | 异步读取、Error Boundary、请求竞态、加载状态设计 |
| W2D3 | TanStack Query 5 | 查询键、staleTime/gcTime、mutation、失效与乐观更新 |
| W2D4 | React Router 8 | 嵌套路由与布局、loader/action、URL 作为状态 |
| W2D5 | 状态管理选型 | 本地/URL/服务端/全局状态的划分，Zustand 5 与 selector |

### 第 3 周：原理、性能与测试
| ID | 主题 | 要点 |
|---|---|---|
| W3D1 | Fiber 与协调 | Fiber 结构、diff 规则、key 的作用、双缓冲 |
| W3D2 | 并发渲染 | Lane 优先级、useTransition、useDeferredValue、`<Activity>` |
| W3D3 | 性能与 Compiler | Profiler 读图、memo 何时有用、React Compiler 1.0 做了什么 |
| W3D4 | 测试 | Vitest 5 + Testing Library、按用户行为测试、MSW 模拟接口 |
| W3D5 | 手写 mini-react | createElement、render、Fiber 工作循环、useState（放在 `mini-react/`） |

### 第 4 周：全栈 React（Next.js 16）
| ID | 主题 | 要点 |
|---|---|---|
| W4D1 | Server Components | 服务端/客户端边界、'use client'、props 序列化、组件组合方式 |
| W4D2 | App Router | 布局、loading/error、流式渲染、缓存模型（以官方文档为准） |
| W4D3 | Server Actions | 表单提交、输入校验与鉴权、RSC 安全补丁（2025-12 起的 CVE） |
| W4D4 | React 19.3 新特性 | View Transitions、Fragment Refs、hydration 报错排查 |
| W4D5 | 综合复盘 | 面试式问答、白板讲解看板架构、整理个人知识图谱 |

## 验收标准
- 每个主题：能不看资料用 3 句话讲清楚，课后测验 ≥ 80%。
- 每周项目：评审无"严重"级问题，测试通过。
- 第 3 周：mini-react 能渲染计数器并正确更新。
- 结束时：能解释一次点击从事件到屏幕更新的完整链路（事件 → setState → 调度 → render → commit → 浏览器绘制）。

