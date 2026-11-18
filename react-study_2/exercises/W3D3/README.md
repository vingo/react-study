# W3D3：性能与 React Compiler（Profiler 计数、memo 边界、手动缓存）

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修 bug：父组件无关状态变化不再重渲染昂贵报表；memo + 稳定引用/状态下沉 | 15 分钟 |
| 2 | `ex2.tsx` | 补全实现：修好被 children / 内联对象 / 新数组击穿的 memo，并做对照实验 | 15 分钟 |
| 3 | `ex3.tsx` | 小功能：useMemo 缓存昂贵统计与派生列表、useCallback + memo 拆分表格边界 | 20 分钟 |

合计约 50 分钟。测试文件是验收标准，不要修改断言；也不要修改共享的
`package.json`、`vitest.config.ts`、`tsconfig.json`，不要安装依赖。

## 先自己做

`solutions/` 里是参考答案。**请先独立完成，卡住超过 10 分钟再看。**
三题都不使用、也不安装 React Compiler：本练习聚焦 Profiler 计数、memo 的
适用边界与手动缓存。环境为 React 19.3，`Profiler` 可直接从 `react` 导入。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W3D3
npx tsc --noEmit
```

如果 `node -v` 不是 24.x，先把 Node 放进 PATH（见项目根目录 `.nvmrc`）：

```bash
export PATH=/Users/maochaobo/.nvm/versions/node/v24.22.2/bin:$PATH
```

初始状态：3 个测试文件、17 个用例，**9 个失败、8 个通过**。失败全部来自
断言（不是导入或类型错误），通过的用例负责守住“相关数据仍要更新”的行为：

- `ex1.test.tsx`：3 失败 / 2 通过。备注输入仍会重渲染报表并重复聚合；
  切换密度、选择行也会重复聚合。挂载与切换区域用例初始通过。
- `ex2.test.tsx`：2 失败 / 4 通过。备注输入与 theme（外部 prop）变化都会
  击穿 memo。团队切换、详情按钮、memo 对照实验初始通过。
- `ex3.test.tsx`：4 失败 / 2 通过。展开帮助、搜索、改阈值、选择行都会
  重算统计 / 重新过滤 / 重渲染表格。挂载与添加商品用例初始通过。

参考答案 **17/17 通过**，无 act 警告、无未处理 rejection；起始与参考答案
都通过 `npx tsc --noEmit`。

验证参考答案（覆盖后记得恢复起始文件）：

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
for n in 1 2 3; do cp W3D3/ex$n.tsx /tmp/ex$n.starting.tsx; cp W3D3/solutions/ex$n.tsx W3D3/ex$n.tsx; done
npx vitest run W3D3
npx tsc --noEmit
for n in 1 2 3; do cp /tmp/ex$n.starting.tsx W3D3/ex$n.tsx; done
```

最终 `npx vitest run W3D3` 应回到 9 个失败。

## 关于 Profiler 计数的两个关键点

- 测试不使用真实计时，也不断言 `actualDuration` / `baseDuration`。Profiler 的
  `onRender` 只用来数 commit 次数；render 次数由组件内模块级计数器统计。
- **Profiler 要放在被观察的子组件内部**。如果把 Profiler 包在 memo 子组件
  外层，父组件提交时即使子组件 bail out，外层 Profiler 仍可能触发 onRender，
  那个数字就不是“子组件重渲染次数”。本题的 Profiler 已放在子组件内部。
- 测试不包 `<StrictMode>`，因此没有开发模式双调用导致的计数翻倍。

## 题目提示

### 1. 昂贵报表的重渲染

- 父组件每次 render 都会重新创建 `options={{ density }}` 和
  `onSelect={(id) => ...}`。先让子组件成为 memo 边界，再把这两个引用稳定下来：
  `useMemo` / `useCallback`。
- 区域聚合放 `useMemo(() => summarizeRegion(rows, region), [rows, region])`：
  切换密度或选择行只会重渲染外观，不会重复聚合同一区域。
- 也可以把备注输入下沉到独立组件（状态下沉），这样父组件根本不因备注而
  render；测试只关心可观察行为，两种方案都接受。
- 保留子组件里的 `<Profiler>`，它负责 commit 计数。

### 2. memo 的边界与陷阱

- memo 只做 props 浅比较，`children` 也是 prop：父组件每次 render 新建的
  `<small>` 元素会让 memo 永远放行。把页脚移出 memo 组件，或用稳定的方式
  渲染它（例如同样 `useMemo` 住元素），使 memo 的 props 不再包含新引用。
- `buildMetrics(team)` 每次返回新数组、`options` 每次是新对象、`onInspect`
  每次是新函数，三者分别用 `useMemo` / `useCallback` 稳定。
- 做题时**不要删除或改写 `CheapStatus` 的 memo + 自定义比较函数**：它是对照
  实验，用来观察“props 每次都变时，memo 只增加比较成本、不减少渲染”。
  3 次刷新气泡 = 3 次比较 = 3 次重渲染，没有收益。对这么便宜的组件，真实
  项目里更合理的选择通常是不加 memo，或在父组件里稳定它的 props。

### 3. 派生统计与列表拆分

- 统计只依赖 `items` / `threshold`，过滤只依赖 `items` / `search`。不要把
  `search` 或 `helpOpen` 误放进统计的依赖里，否则无关更新还会重算。
- 表格用 `memo` 包起来，行数组用 `useMemo` 缓存，回调用 `useCallback`
  稳定。这样改阈值时表格 bail out；选择行时只有 `selectedId` 变化让它重渲染。
- 帮助面板、搜索框等可以按需拆成独立组件；测试同时接受“拆组件”和
  “memo + 稳定引用”两类正确解。
- 阈值语义是 `item.units < threshold`；初始阈值 5，改为 3 时低库存应为 1。

## 如果启用 React Compiler

React Compiler 1.0 是构建期插件：它分析组件与 Hook 的数据流，为可缓存的
表达式、回调和 JSX 自动插入等价于 `useMemo` / `useCallback` / `memo` 的缓存，
因此本练习里大部分手动 memo 在启用后会被自动生成。但它不是“性能银弹”：

- 它要求组件是纯函数并遵守 Hooks 规则，违规代码会被跳过（bail out）；
- 它不会替你决定状态放哪一层、哪些值是派生值、依赖应该是什么；
- 错误的数据流、放错层的昂贵计算、每次新建的外部数据源仍然存在。
- 启用后仍要用 Profiler 实测验证，而不是盲目删除所有手动 memo。

本练习的测试环境**没有**启用 Compiler（`vite.config`/`vitest.config.ts`
未安装插件），所以你写的 `useMemo` / `useCallback` / `memo` 会真实生效。

完成后发“验收 W3D3”。
