# W2D4：React Router 8

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修复嵌套布局：补 `<Outlet />`，让子路由渲染；验证根路径 NavLink 的默认行为 | 15 分钟 |
| 2 | `ex2.tsx` | 补全 loader（读 params/store）与 action（校验、`redirect`、404） | 15 分钟 |
| 3 | `ex3.tsx` | URL 作为状态：`useSearchParams` + loader 读取 URL 搜索参数 | 20 分钟 |

合计约 50 分钟。

## 先自己做

`solutions/` 里是参考答案。请先独立完成，卡住超过 10 分钟再看。
测试文件（`*.test.tsx`）是验收标准，不要修改断言。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W2D4
```

初始状态下测试是红的，失败全部来自断言（不是导入/类型错误）：
共 14 个用例失败、1 个通过（`ex3` 的“默认 URL 不筛选”）。

- `ex1.test.tsx`：3 个用例都失败。布局只渲染头部，`<main>` 里没有子路由内容。
- `ex2.test.tsx`：5 个用例都失败。列表/详情 loader 写死返回 `DEFAULT_TASKS`；
  action 不校验空标题、成功后不跳转。
- `ex3.test.tsx`：除“默认 URL”外 6 个失败。loader 忽略 URL，搜索框 onChange 是空实现；
  切回“全部”或清空搜索时，URL 参数没有被正确删除。

完成后两条命令都要通过：

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W2D4
npx tsc --noEmit
```

验证参考答案：用 `solutions/exN.tsx` 覆盖对应的 `exN.tsx` 后重新运行（15/15 通过），
验证完记得恢复起始文件。参考答案与起始文件均通过 `npx tsc --noEmit`。

## Router 测试 helper（`test-utils.tsx`）

测试不需要你改，但读懂它有助于理解时序：

- `renderRouter(routes, initialEntries)`：每个测试调用一次，内部 `createMemoryRouter`
  新建独立 router（含独立 location、loader 数据、history），再用 `RouterProvider` 渲染。
  返回 `{ router, ...renderResult }`。
- `currentUrl(router)`：返回 `pathname + search`，例如 `/?status=done`，用于断言 URL。
- helper 在外层加了一个 pathless 路由和 `HydrateFallback`：带 loader 的路由首次渲染前
  要等数据，这个 fallback 会短暂显示“加载中…”，同时避免 React Router 的开发期警告。
- loader 是异步的：首屏用 `await screen.findBy...`，URL/列表切换用 `waitFor`。
- 导航和表单提交用 `act` 包住（`fireEvent.click` / `fireEvent.change` + `await act`），
  否则路由状态更新会落在 act 之外。
- `router.navigate(-1)` / `router.navigate(1)` 模拟浏览器后退/前进，也要 `await act`。

测试里每次 `renderRouter` 都构造新的 route 数组和 store；不要在用例之间复用 router。

## 题目提示

### 1. 嵌套布局

布局路由的 `element` 在父级渲染一次，子路由的 `element` 渲染在 `<Outlet />` 的位置。
没有 `Outlet` 时，URL 和匹配都正常，但子路由组件不会出现在 DOM 里。

`<NavLink to="/">` 是特殊情况：React Router 默认只在根路径激活，不需要 `end`。
`end` 用于非根链接（例如 `<NavLink to="/tasks">`），避免 `/tasks/42` 也把它标成 active。

### 2. loader 与 action

- loader 在进入路由前运行，组件用 `useLoaderData` 读取；数据已就绪，不需要 `useEffect`。
- 动态段通过 `params.taskId` 获取；找不到时 `throw new Response('Not Found', { status: 404 })`，
  最近的 `errorElement` 会用 `useRouteError` 拿到它。
- `<Form method="post">` 提交到当前路由的 action；`await request.formData()` 读取字段。
- 校验失败返回普通对象，组件用 `useActionData` 读取；成功返回 `redirect('/')`，
  Router 会导航并重新执行目标路由的 loader，列表因此出现新任务。

### 3. URL 作为状态

- loader 里用 `new URL(request.url).searchParams` 读取 `status` / `q`，过滤结果在数据层完成。
- 组件用 `useSearchParams()` 读写同一份 URL 状态；不要用 `useState` 复制一份。
- `setSearchParams` 会触发导航 → loader 重跑 → 组件拿到新数据，所以刷新、分享链接、
  前进后退都能还原筛选。
- `status=all` 和空 `q` 应删除对应参数，URL 才干净；非法 `status` 按 `all` 处理。
