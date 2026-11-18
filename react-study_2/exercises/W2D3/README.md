# W2D3：TanStack Query 5

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修复 Query Key 不完整：key 包含 `userId`，切换用户后请求并显示新用户 | 15 分钟 |
| 2 | `ex2.tsx` | 补全 mutation：成功后 `invalidateQueries(['tasks'])`，列表重新拉取 | 15 分钟 |
| 3 | `ex3.tsx` | 乐观更新：`onMutate` 取消查询/快照/写缓存，失败回滚，`onSettled` 失效 | 20 分钟 |

合计约 50 分钟。

## 先自己做

`solutions/` 里是参考答案。请先独立完成，卡住超过 10 分钟再看。
测试文件（`*.test.tsx`）是验收标准，不要修改断言。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W2D3
```

初始状态下测试是红的，且失败来自断言（不是导入或类型错误）：

- `ex1.test.tsx`：第 2 个用例（切换 userId）失败，仍显示旧用户。
- `ex2.test.tsx`：第 3 个用例（成功后列表出现新任务）失败；前两个用例初始即可通过。
- `ex3.test.tsx`：三个用例都在“点击后立即乐观更新”处失败。

完成后两条命令都要通过：

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W2D3
npx tsc --noEmit
```

## 测试 helper（`test-utils.tsx`）

测试不需要你改，但读懂它有助于理解时序：

- `createTestQueryClient()`：每个测试创建一个新的 `QueryClient`，默认
  `retry: false`、`gcTime: 0`、`staleTime: 0`、`refetchOnWindowFocus: false`。
  `retry: false` 让失败立即进入 error 状态；`gcTime: 0` 避免缓存和定时器跨用例泄漏。
- `renderWithQueryClient(ui)`：用 `QueryClientProvider` 包裹 UI 并渲染，
  返回值里可以拿到 `client` 和 RTL 的 `rerender`。
- `createDeferred<T>()`：返回 `{ promise, resolve, reject }`，由测试决定请求何时完成。
  ex2/ex3 用它把 mutation 卡在 pending 状态，从而断言按钮禁用、乐观更新和回滚。

## 题目提示

### 1. Query Key

`useQuery` 用 `queryKey` 的序列化结果做缓存标识。key 相同就复用缓存，`queryFn`
不会因为闭包里的变量变了而自动重跑。所有影响结果的参数都要进 key，例如
`['user', userId]`。

### 2. Mutation + 失效

`useMutation` 的 `onSuccess` 适合放“成功后让哪些数据过期”的副作用。
`invalidateQueries({ queryKey: ['tasks'] })` 会标记 stale 并 refetch 有观察者的查询。
按钮的 `disabled={mutation.isPending}` 起始代码已经写好，用于验证 pending 时序。

### 3. 乐观更新与回滚

标准三段式：

- `onMutate`：`await cancelQueries` → `getQueryData` 快照 → `setQueryData` 立即改 →
  `return { previousTasks }`。
- `onError`：用 `context.previousTasks` 恢复。
- `onSettled`：`invalidateQueries`，无论成功失败都以服务端为准。

测试里点击会用异步 `act` 包住，因为 `onMutate` 在写缓存前 `await` 了
`cancelQueries`；失败用例用 `reject` + `.catch(() => {})` 避免未处理 rejection。
