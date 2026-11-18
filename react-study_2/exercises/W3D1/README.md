# W3D1：Fiber 与协调（key、同层 diff、双缓冲）

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.tsx` | 修 bug：index key 让局部 state 跟错行，改成稳定 id key | 15 分钟 |
| 2 | `ex2.ts` | 补全实现：按 type + key 做同层 diff，返回 mount/update/unmount/move | 15 分钟 |
| 3 | `ex3.ts` | 小功能：最小 Fiber 双缓冲，render 不碰 current，commit 切换树 | 20 分钟 |

合计约 50 分钟。三题都只关注“协调”这一层，不要求实现 DOM 或完整 mini-react；
完整 mini-react 留到 W3D5。

## 先自己做

`solutions/` 里是参考答案。请先独立完成，卡住超过 10 分钟再看。
测试文件（`*.test.ts` / `*.test.tsx`）是验收标准，不要修改断言。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W3D1
npx tsc --noEmit
```

如果 `node -v` 不是 24.x，先让 nvm 的 Node 生效（见项目根目录 `.nvmrc`）：

```bash
export PATH=/Users/maochaobo/.nvm/versions/node/v24.22.2/bin:$PATH
```

初始状态：3 个测试文件、15 个用例全部失败，失败全部来自断言：

- `ex1.test.tsx`：3 个失败。`key={index}` 下置顶/删除/插入后，
  展开状态和备注草稿留在了旧行号上。
- `ex2.test.ts`：7 个失败。`reconcileChildren` 是空实现，所有结果都是空数组。
- `ex3.test.ts`：5 个失败。`render` 没有生成 alternate / 副作用，`commit` 是空实现。

参考答案 15/15 通过，且没有 act 警告或未处理 rejection。两个状态都通过
`npx tsc --noEmit`。

验证参考答案：用 `solutions/exN.*` 覆盖对应的 `exN.*` 后重新运行；验证完恢复起始文件。
最终 `npx vitest run W3D1` 应重新回到 15 个失败。

## 题目提示

### 1. index key 与状态错位

- React 在同层协调时，用“组件类型 + key”判断能不能复用 fiber。复用会保留该 fiber
  上的局部 state（`useState`）。
- `key={index}` 的身份是“第几个位置”。重排、在头部插入、删除前面的项之后，
  同一个位置会被填进另一个任务；React 复用了旧 fiber，所以展开状态和草稿
  跟着行号走。
- `key={task.id}` 的身份是任务本身。重排只是移动同一个实例，state 自然跟着任务。
- 只改 `key`，不要修改测试，也不要把行内的 state 提升到父组件来绕过问题。
- 这也是 React 文档说的“state 与树中位置绑定”的直接体现。

### 2. 同层 keyed diff

文件开头写清了完整契约，先读一遍再动手。关键规则：

- 匹配条件：**同层 + 相同 key + 相同 type**。
- key 变了：旧节点 unmount，新节点 mount。
- key 相同但 type 变了：同样 unmount + mount，不能复用。
- props 浅比较不相等才产生 update；`Object.is` 比较每个自有属性。
- move 的判定：按新顺序扫描已匹配节点，如果它前面存在“旧下标更大”的兄弟，
  说明相对顺序被打乱，需要 move。比如 `[a,b,c] -> [c,a,b]` 会标记 a、b
  （先插入 c、再依次放 a、b 是一种可行做法；真实 React 也用类似的
  `lastPlacedIndex` 规则）。
- 删除后面的节点导致其他节点下标变化，不算 move：它们的相对顺序没变。

建议实现顺序：先建 `Map<key, oldIndex>`；再按新顺序生成 mounts/updates；
最后按旧顺序生成 unmounts。测试里的 `toEqual` 会同时检查字段和顺序。

### 3. 最小 Fiber 双缓冲

- `render` 是“计算”阶段：根据 next VNode 新建 WIP Fiber 树，把 WIP 与
  current 按 key + type 配对，设置 `wip.alternate = current`，并把副作用
  记到数组里。它不能修改 current 树，这样即使工作被丢弃，屏幕上的旧树仍然完整。
- `placement`：没有配对的节点（首次挂载或新增）。每个新节点一条。
- `update`：配对了但 props 浅比较不同。
- `deletion`：旧 children 中没被配对的节点。只记被卸载子树的根，不逐个记后代；
  每一层的 deletion 在该层子节点处理完后、按旧 children 顺序追加。
- effects 的顺序：先节点自身，再递归子节点（先序）。
- `commit`：把 `root.current` 指向 WIP，完成双缓冲切换。真实 React 还会在这里
  做 DOM 变更、ref 和 layout effect；本题只做指针切换。
- 本题只把 alternate 写在 WIP 上（单向），保证 render 期间旧树完全不被写入。
  真实 React 内部会建立双向 alternate 链接，但那是实现细节；这里优先演示
  “render 阶段不改变 current”的不变量。
