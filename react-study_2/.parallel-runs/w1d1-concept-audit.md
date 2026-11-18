# W1D1 渲染模型：技术事实审校

审校范围：`notes/W1D1-render-model.md`。技术判断仅依据 React 官方文档（react.dev）。

## 准确项

- 将更新过程分为触发（trigger）、渲染（render）和提交（commit），并说明 render 用于计算要展示的内容、commit 才应用 DOM 变更，符合官方的渲染与提交模型。
- “重新渲染”不等于 DOM 被整体重写。React 在 commit 中只对新旧输出存在差异的 DOM 节点施加必要操作，此表述准确。
- 父组件默认重新渲染时，React 会递归渲染其子组件；`memo` 可以跳过部分不必要的子组件重渲染。React Compiler 可自动应用相当于 `memo` 的优化，这一注释方向正确。
- render 必须保持纯粹：不得修改渲染前已存在的 props、模块变量或其他外部对象；修改本次调用中新建的局部对象是允许的。`[...items].sort()` 的示例正确。
- 在 render 中调用 `Date` 或 `Math.random()` 会破坏幂等性；`sort()` 会原地修改数组；这些常见误区的判断正确。
- 在组件内部定义组件会在每次父组件渲染时产生新的函数对象。React 将其视为不同组件类型，因而会重置该位置的 state，并可能重建对应 DOM；示例和“定义在模块顶层”的修正正确。
- React 按 UI 树中的位置保留 state；同一组件类型保持在同一位置时 state 会被保留。使用 key 可以让 React 区分位置或显式重置 state，此处的核心结论正确。
- StrictMode 仅在开发环境提供额外检查，生产构建不包含这些开发期检查。它会额外调用应保持纯粹的函数，以帮助发现不纯的渲染逻辑。React 19 会在 StrictMode 的第二次开发期渲染中复用第一次渲染的 `useMemo`/`useCallback` 结果，此项正确。
- `useId()` 适合生成关联无障碍属性（例如 `htmlFor`）所需的稳定 ID；它不应作为列表 key。本讲义没有把它误用于 key。

## 需更正项

### 1. “什么会触发渲染”中的“只有两种”遗漏 context 更新

原文：`只有两种：首次挂载，以及组件自身（或祖先）的 state 变化。`

建议改为：首次 `root.render` 会触发初始渲染。state 更新会触发相关组件的渲染，父组件渲染通常会递归处理子组件。此外，当 Provider 接收到不同的 context `value` 时，使用该 context 的后代会重新渲染，即使该后代使用了 `memo`。

原因：官方 `useContext` 文档明确说明，Provider 的 `value` 改变时，React 会重新渲染使用该 context 的子组件，且 `memo` 不能阻止这类新 context 值的接收。

### 2. Effect 的用途和时机表述不准确

原文：`实在要和渲染同步时才放进 useEffect。`

建议改为：事件引起的操作通常放在事件处理函数。Effect 用于在提交后把组件与外部系统同步，例如订阅、网络连接、命令式 DOM API 或第三方组件；不需要与外部系统同步的计算不应放进 Effect。若确实需要在浏览器绘制前测量或修改布局，使用 `useLayoutEffect`，但它也发生在 DOM 提交之后。

原因：`useEffect` 不在 render 期间运行，且通常在浏览器绘制后运行；“和渲染同步”会把 render、commit 和 Effect 的时序混为一谈。

### 3. StrictMode 的 Effect 额外周期缺少根节点边界条件

原文：`挂载后还会额外执行一轮 Effect 的 cleanup → setup，ref 回调也会额外解绑再绑定一次。`

建议改为：当 StrictMode 包裹应用根节点时，React 会在开发环境为 Effect 和 callback ref 额外执行一次 setup/cleanup 周期，以发现遗漏的清理。若 StrictMode 不在根节点，React 不会在初始挂载时额外执行 Effect，以免出现生产环境不可能发生的父子 Effect 顺序。

原因：官方 StrictMode 文档对嵌套而非根级的 StrictMode 明确规定了这个例外。原文的无条件说法不准确。

## 容易误解的表述

- `commit ... 只执行一次，不可中断`：建议限定为“对一个已完成并被选中提交的 render 结果，React 在 render 完成后才提交 DOM 变更”。“只执行一次”容易被理解为一次用户操作或一次更新只会有一次 commit；例如 Suspense 可先提交 fallback，之后再提交内容，它们属于不同的 render/commit。
- `StrictMode、并发渲染、Suspense 都会这样做`：可以保留“render 结果可能不会提交”，但不要把三者等同为同一种机制。StrictMode 的重点是开发期额外调用以发现不纯函数；并发特性可暂停、恢复或放弃渲染；Suspense 会在子树尚未就绪时展示 fallback 并在随后重试。
- `组件是一个纯函数：给定相同的 props、state 和 context，返回相同的 JSX`：教学上可用，但建议把“JSX”改为“React 要渲染的输出”。组件也可以返回字符串、数字、`null`、数组或 React 元素，并不必使用 JSX。还应强调“相同输入得到相同输出”是纯粹/幂等要求，而不是 JavaScript 函数签名。
- `同一位置、同一类型 → 复用 DOM 和 state，只更新属性`：建议改为“通常保留该位置的 state，并协调更新 DOM 及其子树”。同类型并不意味着只会更新该元素自身属性，子树仍可能发生更新；key 是 React 用来标识同级位置的一部分，而非独立于位置之外的附加比较条件。
- `双重调用暴露的 bug 在并发渲染下真实存在`：StrictMode 的官方定位是开发期发现不纯渲染、遗漏 Effect 清理和遗漏 ref 清理。并发渲染也要求 render 可重复和可放弃，但该句把 StrictMode 的双调用与并发运行时行为说成一一对应，论断过强。建议改为“应修复 StrictMode 发现的不纯代码，因为 React 要求组件和 Hooks 在 render 中保持纯粹”。

## 对应官方 URL

- 渲染、递归渲染与最小 DOM 提交：https://react.dev/learn/render-and-commit
- 组件纯粹性、局部修改、幂等性与副作用：https://react.dev/learn/keeping-components-pure
- Effect 的用途、时机与事件处理函数的边界：https://react.dev/learn/synchronizing-with-effects
- `useEffect` 的提交后执行语义：https://react.dev/reference/react/useEffect
- `useLayoutEffect` 的绘制前布局测量语义：https://react.dev/reference/react/useLayoutEffect
- StrictMode 的开发期检查、根节点例外、Effect 与 callback ref 额外周期：https://react.dev/reference/react/StrictMode
- React 19 对 StrictMode 中 memoized 值复用的说明：https://react.dev/blog/2024/04/25/react-19-upgrade-guide#strictmode-changes
- state 按 UI 树位置保留、组件嵌套定义导致 state 重置、key 的语义：https://react.dev/learn/preserving-and-resetting-state
- context value 变化会使消费者重新渲染：https://react.dev/reference/react/useContext
- `memo` 与 context 更新：https://react.dev/reference/react/memo
- `useId` 的用途及不可作为列表 key：https://react.dev/reference/react/useId
