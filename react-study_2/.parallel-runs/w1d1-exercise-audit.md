# W1D1 练习验收报告

审阅范围为 `exercises/W1D1`。未读取或更改 `solutions/`，也未更改练习文件或配置。

## 结论

README 的学习目标与 W1D1「渲染模型」笔记一致：依次练习 render 纯度、props 不可变性，以及组件身份对 DOM/state 保留的影响。测试设计与起始代码逻辑一致，预期应为 6 项中 5 项失败、1 项通过。项目级 TypeScript 类型检查通过。

本环境无法实际执行 Vitest：当前 Node 是 `v20.11.1`，项目根目录 `.nvmrc` 要求 `24`，而 Vitest 的 rolldown 依赖在加载时请求当前 Node 不提供的 `node:util.styleText`。因此，下列起始测试结果是基于源代码和断言的静态核对，不是成功启动测试后的实测计数。

## 执行结果

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| 单元测试 | `cd exercises && npm test -- W1D1` | 未启动，退出码 1。错误为 `node:util` 不导出 `styleText`；Node `v20.11.1` 与 `.nvmrc` 的 Node 24 不符。 |
| TypeScript 类型检查 | `cd exercises && npm run typecheck` | 通过，`tsc --noEmit` 退出码 0。 |

README 所述先进入 `exercises` 的执行位置正确。根目录没有 `package.json` 脚本，不能直接在根目录运行这些 npm 命令。

## 各题验证的概念和起始测试核对

### 题 1：`ex1.tsx`

- **验证概念**：render 必须是纯计算，不能改动模块级变量；StrictMode 的重复调用用于暴露不纯渲染，不能以删除 StrictMode 回避问题。
- **测试覆盖**：一项在 `<StrictMode>` 中断言编号为 1、2、3；另一项卸载再渲染，断言相同输入有相同输出。
- **起始状态**：预计 2 项失败。`Cup` 在 render 中递增模块变量 `guest`，调用次数泄漏到 UI，既不能满足 StrictMode，也不能保证重复渲染稳定。
- **评价**：合理。两个断言分别覆盖开发期重复调用和一般重复渲染，能避免只针对 StrictMode 的修补。

### 题 2：`ex2.tsx`

- **验证概念**：渲染期间不得修改 props；排序应复制数组后排序或使用 `toSorted`；比较函数要处理同分时的名字次序。
- **测试覆盖**：一项验证分数降序和同分名字升序；另一项传入冻结数组并检查原报名顺序。
- **起始状态**：预计排序断言失败、不可变性断言通过。起始实现仅使用 `players`，没有排序，也没有原地修改数组。这与 README 对 5 失败、1 通过的说明一致。
- **评价**：合理。冻结数组与原顺序断言能阻止 `players.sort(...)` 的实现。

### 题 3：`ex3.tsx`

- **验证概念**：React 按位置和组件类型保留 DOM/state；把子组件定义在父组件内部会在每次父组件 render 时产生新类型，导致非受控输入被卸载重建；独立展示状态应正确组合 class。
- **测试覆盖**：主题切换后检查 `dark` 类和昵称值；紧凑模式测试检查开关、`light compact` 并存、关闭后的类移除，以及城市输入值保留。
- **起始状态**：预计 2 项失败。内部定义的 `Field` 会在主题切换时重建输入框，且紧凑模式按钮尚未实现。
- **评价**：合理。测试覆盖了状态组合和输入保留，而非只检查按钮及单一 class。

## 发现的问题和改进建议

1. **运行环境阻塞验收。** README 已正确要求先执行 `nvm use`，但当前未安装可用的 Node 24，Vitest 不能启动。验收前应在项目根目录执行 `nvm use`，用 `node --version` 确认 Node 24，再运行 `cd exercises && npm test -- W1D1`。可在 `exercises/package.json` 加入与 `.nvmrc` 一致的 `engines.node`，并在 README 增加版本确认步骤，使失败原因更直观。
2. **补充单次验收命令。** README 的 `npx vitest W1D1` 适合监听式学习；建议另加 `npm test -- W1D1` 作为一次性验收/CI 命令，以获得明确退出码。
3. **题 3 可明确状态独立性。** 建议任务文字明确 `dark` 与 `compact` 是可同时存在的两个独立布尔状态，直接对应 `light compact` 的测试断言，减少将两者误做成互斥主题的可能。
