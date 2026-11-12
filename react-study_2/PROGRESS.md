# 学习进度

## 主题得分
| 主题 | 测验得分 | 掌握度 | 日期 |
|---|---|---|---|
| W1D1 渲染模型 | 0.5 / 7（7%） | 需要重练 | 2026-11-07 |
| W1D2 State | 3.75 / 8（47%） | 需要重练 | 2026-11-07 |
| W1D3 Effect | 3.25 / 9（36%） | 需要重练 | 2026-11-07 |
| W1D4 Ref 与 DOM | 6.0 / 8.5（71%） | 基本掌握 | 2026-11-07 |
| W1D5 组合与 Context | 3.75 / 9（42%） | 需要重练（代码通过） | 2026-11-07 |

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

## 复习队列
| 题目来源 | 概念 | 下次复习日期 | 连续答对次数 |
|---|---|---|---|
| W1D1 第 1 题 | render / commit 时序与读取 DOM | 2026-11-08 | 0 |
| W1D1 第 2 题 | 不可变更新、StrictMode 双调用 | 2026-11-08 | 0 |
| W1D1 第 3 题 | state 按位置和类型保留 | 2026-11-08 | 0 |
| W1D2 第 1 题 | state 更新队列、直接值与更新函数混用 | 2026-11-08 | 0 |
| W1D2 第 3 题 | 派生数据与独立 state、reduce 聚合 | 2026-11-08 | 0 |
| W1D3 第 1 题 | render、事件处理函数与 Effect 的职责边界 | 2026-11-08 | 0 |
| W1D3 第 2 题 | Effect cleanup 与 setup 的时序 | 2026-11-08 | 0 |
| W1D3 第 3 题 | interval 过期闭包、更新函数与 cleanup | 2026-11-08 | 0 |
| W1D4 复习 1 | Effect 卸载时的最后 cleanup | 2026-11-08 | 0 |
| W1D4 复习 2 第 3 项 | useEffect 与 useEffectEvent 的职责 | 2026-11-08 | 0 |
| W1D4 第 2 题 | ref 更新不触发 render；使用 state 更新 UI | 2026-11-08 | 0 |
| W1D5 复习 1 | 直接值更新与更新函数混用的 pending state 顺序 | 2026-11-10 | 1 |
| W1D5 复习 2 | useEffect / useEffectEvent 的职责边界 | 2026-11-08 | 0 |
| W1D5 第 1 题 | 状态提升：最近公共父级、activeId、受控子组件 props | 2026-11-08 | 0 |
| W1D5 第 2 题 | 稳定 key 的 state 重置语义与随机 key 的危害 | 2026-11-08 | 0 |
| W1D5 第 3 题 | reducer 的不可变更新与纯函数约束 | 2026-11-08 | 0 |
