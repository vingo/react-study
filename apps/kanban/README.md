# 任务看板 v1

贯穿学习项目的第一个版本，用来练习 React 的渲染模型、state、Effect、ref 与组合。

## 运行

```bash
npm install
npm run dev        # 本地开发
npm run test       # Vitest + Testing Library
npm run build      # 类型检查 + 生产构建
```

## 已实现

- 三列看板：待办、进行中、已完成，列内任务数由任务数组派生。
- 新建、编辑、删除任务；删除前弹出确认框，支持 Esc / 点击遮罩取消。
- 通过卡片上的状态下拉框或原生拖拽跨列移动任务。
- 使用 `localStorage` 持久化，刷新后恢复。
- 空标题校验、空状态、损坏本地数据与存储不可用时的降级处理。
- 统计信息（总数 / 已完成数）为派生数据，不单独存 state。

## 结构

```text
src/
├── App.tsx                    // 页面外壳
├── components/
│   ├── KanbanBoard.tsx        // 任务状态、持久化、派生数据
│   ├── TaskColumn.tsx         // 单列与拖拽落点
│   ├── TaskCard.tsx           // 任务展示、移动、编辑/删除入口
│   ├── TaskEditor.tsx         // 新建/编辑表单与短生命周期 state
│   └── ConfirmDialog.tsx      // 删除确认
├── storage.ts                 // localStorage 读取、校验、写入
├── task-id.ts                 // 在事件中生成稳定 ID
├── types.ts / constants.ts    // 数据模型与状态常量
└── KanbanBoard.test.tsx       // 核心用户路径集成测试
```

## 刻意保留的设计点

- **单一数据源**：`KanbanBoard` 持有 `tasks`，列内容、计数、统计全部计算得到。
- **稳定 key**：列表使用 `task.id`；编辑不同任务时用 `key` 重建表单，避免输入残留。
- **ID 生成位置**：`crypto.randomUUID()` 在提交事件中调用，不放进 render 或 reducer。
- **Effect 边界**：`useEffect` 只负责同步 `localStorage` 和焦点管理，不承担派生数据计算。
- **防御性读取**：本地 JSON 损坏、字段非法、重复 ID 都会被过滤，页面不会崩溃。
- 仍使用 `useState`；等更新逻辑更复杂时，再迁移到 `useReducer` + Context。
