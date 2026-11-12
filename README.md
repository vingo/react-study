# 任务看板（Kanban）

用于巩固 React 核心心智模型的贯穿式学习项目。项目会随学习进度逐步升级，而不是一次性加入所有框架和功能。

## 当前状态

当前处于 **v1 规划阶段**，本目录暂时只有项目说明，尚未初始化 Vite、安装依赖或编写应用代码。

## 学习目标

通过实现一个可用的个人任务看板，练习：

- 用 `useState` 管理局部交互状态，并以不可变方式更新任务数组。
- 使用稳定的任务 `id` 作为列表 `key`。
- 区分派生数据与 state，例如列内任务数应由任务列表计算。
- 用 `useEffect` 将任务持久化到 `localStorage`。
- 用 `useRef` 处理新建任务后的 input 聚焦等命令式 DOM 操作。
- 在任务更新逻辑变复杂后，迁移到 `useReducer` 和 Context。
- 在后续版本接入路由、服务端状态、测试、React Compiler 和 Next.js。

## v1 功能范围

### 必做

- 展示三个固定列：`待办`、`进行中`、`已完成`。
- 新建任务，字段包括标题、描述、状态、创建时间和稳定 ID。
- 编辑任务标题和描述。
- 删除任务，删除前要求用户确认。
- 切换任务状态，使任务移动到对应列。
- 页面刷新后从 `localStorage` 恢复任务。
- 空状态、标题不能为空、读取损坏本地数据等基础异常处理。

### 可选

- 原生 HTML Drag and Drop 拖拽排序或跨列移动。
- 按关键词和状态筛选。
- 深色模式。
- 任务完成数量和总数量统计。

### v1 不做

- 登录、权限、多人协作。
- 真实后端接口。
- 云端数据同步。
- 复杂动画和组件库接入。

## 推荐数据模型

```ts
export type TaskStatus = 'todo' | 'doing' | 'done'

export type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  createdAt: string
}
```

`id` 在创建任务的事件处理函数中生成。不要用数组下标作为 React `key`，也不要在 reducer 中生成随机 ID。

## 推荐组件边界

```text
App
├── KanbanBoard             // 加载、持久化和任务状态
│   ├── TaskColumn × 3      // 接收状态、任务与事件回调
│   │   └── TaskCard × N
│   └── TaskEditor          // 新建/编辑任务，管理短生命周期表单 state
└── ConfirmDialog（可选）
```

开始时用显式 props 传递数据和事件。只有任务 state 与 dispatch 需要跨多层共享时，再引入 Context。

## 实现顺序

1. 用 Vite、React 和 TypeScript 初始化应用。
2. 先使用内存中的初始任务渲染三列和任务卡片。
3. 完成新建、编辑、删除和状态切换。
4. 为列表渲染补上稳定 `key`，确认组件 state 的保留/重置行为正确。
5. 加入 `localStorage` 的读取、写入与异常处理。
6. 为核心用户路径编写 Vitest + Testing Library 测试。
7. 根据更新复杂度决定是否由 `useState` 迁移至 `useReducer` + Context。

## 验收标准（v1）

- [ ] 用户可创建、编辑、删除任务，并切换任务状态。
- [ ] 删除不会误删其他任务，且需要显式确认。
- [ ] 每个任务使用稳定的 `task.id` 作为 `key`。
- [ ] 刷新页面后任务仍存在；损坏的 `localStorage` 数据不会使页面崩溃。
- [ ] 新建任务标题为空时无法提交，并显示可理解的提示。
- [ ] 核心流程至少覆盖：新建、编辑、移动、删除、持久化恢复。
- [ ] `npm run build`、类型检查和测试全部通过。

## 后续版本

| 版本 | 升级重点 |
| --- | --- |
| v1 | Vite + TypeScript、本地 state、`localStorage` 持久化 |
| v2 | MSW 模拟 API、TanStack Query、React Router、Zustand、乐观更新 |
| v3 | React Compiler、Profiler、Vitest、Testing Library、核心流程测试 |
| v4 | Next.js App Router、Server Components、Server Actions、流式加载 |

## 开发命令

应用初始化后，在本目录运行：

```bash
npm install
npm run dev
npm run test
npm run build
```

具体脚本以初始化后的 `package.json` 为准。
