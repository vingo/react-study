# W3D5：手写 mini-react（createElement、render、Fiber、useState + keyed diff）

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `mini-react/ex1.tsx` | 补全 createElement + 元素模型：合并 props、提取 key、规范化 children | 15 分钟 |
| 2 | `mini-react/ex2.tsx` | 补全 render + Fiber 工作循环：宿主标签、文本、函数组件、props / 事件、更新与删除 | 15 分钟 |
| 3 | `mini-react/ex3.tsx` | 小功能：同层 keyed diff + useState 的 hook 链表 / dispatch / 重渲染 | 20 分钟 |

合计约 50 分钟。三题是同一个 mini-react 的递进模块：ex1 只做元素模型，
ex2 把元素树渲染成真实 DOM，ex3 在已有 renderer 上补 keyed diff 和 hooks。
每题都有独立的 `exN.tsx` / `exN.test.tsx`，`solutions/` 里是参考答案。

## 与 PLAN 的 `mini-react/` 的对应关系

PLAN 把 W3D5 的实现放在 `mini-react/`。为了直接复用 exercises 已有的
Vitest 5 + jsdom + jest-dom 配置（`exercises/vitest.config.ts`、
`exercises/tsconfig.json`），本次实现放在：

```
/Users/maochaobo/study/react-study/react-study_2/exercises/W3D5/mini-react/
```

它就是 PLAN 里 W3D5 的 `mini-react/`：不新建包、不修改共享配置、不安装依赖。
以后要挪到项目根目录的 `mini-react/` 时，把 `exN.tsx` 按模块拆过去即可；
测试和类型检查命令保持不变。

三题的源码都**不 import React**。测试使用原生 DOM
（`document.createElement`、`querySelector`、`dispatchEvent`），
所以不存在 React 的 act 警告。

## 先自己做

`solutions/` 里是参考答案。**请先独立完成，卡住超过 10 分钟再看。**
测试文件是验收标准，不要修改断言；也不要修改共享的
`package.json`、`package-lock.json`、`vitest.config.ts`、`tsconfig.json`，
不要安装依赖。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W3D5
npx tsc --noEmit
```

如果 `node -v` 不是 24.x，先把 Node 放进 PATH（见项目根目录 `.nvmrc`）：

```bash
export PATH=/Users/maochaobo/.nvm/versions/node/v24.16.0/bin:$PATH
```

初始状态：3 个测试文件、19 个用例，**18 个失败、1 个通过**。失败全部来自
断言，不是导入、语法或类型错误：

- `ex1.test.tsx`：6 失败。key 还留在 props 里、children 没有展平 / 过滤，
  元素形状、key、children 相关断言全部失败。
- `ex2.test.tsx`：7 失败。`render` 是空实现，container 里没有 DOM；
  断言在 `query(...).not.toBeNull()` 或 DOM 断言处失败。
- `ex3.test.tsx`：5 失败 / 1 通过。通过的是“同位置更新文本与属性，
  删除旧属性”，因为脚手架的“全量重建”baseline 已经能完成简单更新；
  计数器、受控输入、keyed 重排 / 插入、批量 setState 都失败，因为
  `useState` 还是空实现，且 keyed diff 会丢失 state 和 DOM 身份。

参考答案 **19/19 通过**，起始与参考答案都通过 `npx tsc --noEmit`，
没有 act 警告或未处理 rejection。

验证参考答案（覆盖后记得恢复起始文件）：

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
for n in 1 2 3; do cp W3D5/mini-react/ex$n.tsx /tmp/w3d5-ex$n.starting.tsx; cp W3D5/mini-react/solutions/ex$n.tsx W3D5/mini-react/ex$n.tsx; done
npx vitest run W3D5
npx tsc --noEmit
for n in 1 2 3; do cp /tmp/w3d5-ex$n.starting.tsx W3D5/mini-react/ex$n.tsx; done
npx vitest run W3D5
```

最终 `npx vitest run W3D5` 应回到 18 个失败、1 个通过。

## 题目提示

### 1. createElement 与元素模型

- 元素形状固定为 `{ type, key, props }`，其中 `props.children` 是规范化后的
  数组。`type` 保留函数组件本身，不要调用它。
- `key` 从 props 中取出后放进元素的 `key` 字段；`props` 浅拷贝，不要修改
  调用方对象。`key: 0` 是合法 key，不能当成 `null`。
- `normalizeChildren` 递归展平嵌套数组；丢弃 `null`、`undefined`、`true`、
  `false`；保留字符串、数字和元素。数字保持 number，渲染时再转文本。
- 可变参数 children 优先于 `props.children`；没有可变参数时才使用
  `props.children`，都没有就是 `[]`。
- 本题只断言元素数据形状，不渲染 DOM。

### 2. render 与 Fiber 工作循环

- 建议从 root fiber 开始，root 的 `dom` 就是 container。用
  `child / sibling / parent` 指针做非递归遍历（工作循环），构建 WIP 树。
- 三类节点：
  * 宿主标签：`document.createElement(type)`；
  * 文本 / 数字：`document.createTextNode(String(child))`；
  * 函数组件：调用 `type(props)`，把返回值当作它的子节点继续处理。
- 本题的函数组件返回单个 `MiniNode`；不要求 Fragment 或数组返回值。
- 宿主 props：`className` → `class`、`htmlFor` → `for`，其余按属性设置；
  `onClick` / `onChange` 等映射到原生事件名（小写）。再次 render 时要移除
  旧属性、替换旧监听，避免重复触发。
- commit 阶段先删除旧节点，再更新 / 创建 DOM，并**按新顺序**把子节点
  append 到父节点。这样删除、插入和重排都能得到正确顺序。
- 本题的 `useState` 是脚手架提供的简化版（按 root + 调用顺序保存），
  只为验证“点击 → setState → 重新 render → DOM 更新”这条链路；
  它不是第 3 题要求的按 fiber 的完整 hook 链表。
- 本题参考实现按位置复用旧 fiber；keyed diff 是第 3 题的目标。若你提前
  实现 keyed diff，也不会影响本题测试。

### 3. keyed diff + useState

- keyed diff 的核心是匹配规则：**同层 + 相同 key + 相同 type** 才能复用。
  key 相同但 type 变了，旧 fiber 进入 deletions，新 fiber 重建，state 重置。
- 可以先用 `Map<Key, MiniFiber>` 建旧 keyed 节点的索引；文本节点没有 key，
  按位置匹配；无 key 的元素也按位置匹配。匹配上的旧 fiber 放进 `used` 集合，
  最后把所有未匹配的旧 fiber 加入 `deletions`。
- 复用 fiber 时让 `newFiber.alternate = oldFiber`，`createFiber` 会复用
  `oldFiber.dom`；函数组件的 hooks 由脚手架在 `renderComponent` 中从
  alternate 浅拷贝。commit 阶段按新 sibling 顺序 append，所以重排会移动
  同一个 DOM 节点，而不是重建。
- `useState`：
  * `currentRenderingFiber` 指向当前函数组件 fiber，`hookIndex` 是本次渲染
    的第几个 hook；
  * hook 形状是 `{ state, queue }`，从 `fiber.hooks[hookIndex]` 取；没有就
    用 `initial` 创建；
  * 依次执行 queue 里的更新：函数式更新读取上一步 state，直接值更新替换；
    执行完清空 queue；
  * `dispatch` 把更新放进**同一个 hook 对象**的 queue，然后调用
    `scheduleRerender(fiber)`。
- “key 稳定时 state 跟随项”来自两件事：keyed 匹配让组件 fiber 的
  alternate 指向旧 fiber；hook 数组从 alternate 拷贝的是同一批 hook 对象。
- 受控输入框：`value` 作为 DOM property 设置；`onChange` 映射到原生
  `change` 事件。测试会 `input.value = ...` 后 dispatch `change`。
- 起始的 `reconcileChildren` 是“全量重建”占位实现：首屏能渲染、简单更新能过，
  但每次更新都会丢 state、重建 DOM。把它改成 keyed 匹配后，
  `ex3.test.tsx` 中“state 与 DOM 节点跟着 key 移动”的用例才会通过。

## 验收标准

- 起始：`npx vitest run W3D5` 为 18 failed / 1 passed，失败全部是断言。
- 参考答案：19/19 通过；起始与参考答案都通过 `npx tsc --noEmit`。
- 源码不 import React，测试只用原生 DOM，没有 act 警告。
- 完成后能用自己的话解释一次点击的链路：
  事件 → dispatch → hook queue → 重新 render → keyed diff → commit → DOM 更新。
