# W4D1：Server Components（模块图、序列化与 children 槽）

> **本练习是语义模型，不是运行 Next.js。** 环境没有安装 Next.js 16，也不会安装；三题用纯 TypeScript 模拟 App Router 的 RSC 语义。测试不依赖 Next.js、不启动服务器，也不修改共享配置。

| 题目 | 文件 | 练习目标 | 预计用时 |
|---|---|---|---|
| 1 | `ex1.ts` | 从模块图判断 Server / Client，检测客户端图导入 server-only 的违规 | 15 分钟 |
| 2 | `ex2.ts` | 校验 Server -> Client props 的可序列化子集，返回带路径的错误 | 15 分钟 |
| 3 | `ex3.ts` | 模拟 RSC payload：Client 占位、保留 children 槽、Server 输出不进代码 | 20 分钟 |

合计约 50 分钟。测试文件是验收标准，不要修改断言；也不要修改共享的
`package.json`、`package-lock.json`、`vitest.config.ts`、`tsconfig.json`，不要安装依赖。

## 先自己做

`solutions/` 里是参考答案。**请先独立完成，卡住超过 10 分钟再看。**

三题都是纯函数练习，不需要 React 组件或浏览器 API。`jsdom` 环境是共享配置，
但这三题不依赖 DOM。题目里的“Server / Client”是按真实 Next.js App Router
与 React 19.3 语义简化出来的模型；练习的边界规则比真实 RSC 更窄，具体差异见
每题的“本练习的简化”与讲义。

## 运行

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
npx vitest run W4D1
npx tsc --noEmit
```

如果 Node 不在 24.x，先把项目约定的 Node 放进 PATH（见项目根目录 `.nvmrc`），
再运行上面的命令。

初始状态：3 个测试文件、**10 个用例，7 个失败、3 个通过**。失败全部来自断言
（不是导入或类型错误），通过的用例守住最基本的正确路径：

- `ex1.test.ts`：2 失败 / 1 通过。起始只标记直接写了 `'use client'` 的文件，
  不会做客户端图的传递闭包，也不会报 server-only 违规；服务端读取 server-only
  的用例初始通过。
- `ex2.test.ts`：2 失败 / 1 通过。起始只检查根对象第一层的函数，嵌套类型和
  循环引用都漏掉；合法的标量/Date/普通对象/重复引用用例初始通过。
- `ex3.test.ts`：3 失败 / 1 通过。起始把 Client 组件当普通宿主元素，丢失
  chunk、props 和未注册组件的错误；纯 Server 输出用例初始通过。

参考答案 **10/10 通过**，起始与参考答案都通过针对 W4D1 的 TypeScript 检查。
验证参考答案（覆盖后记得恢复起始文件）：

```bash
cd /Users/maochaobo/study/react-study/react-study_2/exercises
for n in 1 2 3; do cp W4D1/ex$n.ts /tmp/ex$n.starting.ts; cp W4D1/solutions/ex$n.ts W4D1/ex$n.ts; done
npx vitest run W4D1
npx tsc --noEmit
for n in 1 2 3; do cp /tmp/ex$n.starting.ts W4D1/ex$n.ts; done
```

最终 `npx vitest run W4D1` 应回到 7 失败 / 3 通过。

如果并行期间其它章节正在改动，`npx tsc --noEmit` 可能报别的目录的错误。
要单独检查 W4D1，可使用：

```bash
npx tsc --ignoreConfig --noEmit --target ES2023 --lib ES2023,DOM,DOM.Iterable \
  --module ESNext --moduleResolution bundler --jsx react-jsx \
  --strict --skipLibCheck \
  --types vitest/globals,@testing-library/jest-dom \
  W4D1/ex1.ts W4D1/ex2.ts W4D1/ex3.ts \
  W4D1/ex1.test.ts W4D1/ex2.test.ts W4D1/ex3.test.ts \
  W4D1/solutions/ex1.ts W4D1/solutions/ex2.ts W4D1/solutions/ex3.ts
```

TypeScript 7 在命令行显式传文件时默认提示不会读取 `tsconfig.json`；`--ignoreConfig`
用来确认这是有意的独立检查。

## 题目提示

### 1. 模块图分类

- 把所有 `useClient: true` 的模块当作客户端图入口，做一次 BFS/DFS；沿着
  `imports` 标记传递依赖。不要用“文件名”或“是否渲染了 Client 组件”判断。
- Server Component import Client Component 不会让自己也变成 Client；只有被
  客户端入口**到达**的模块才进入客户端图。用队列/栈和 visited 避免 import 成环
  时死循环。
- 分类完成后，再遍历每个 client 模块的 imports。目标模块 `serverOnly: true`
  就产生一条 `{ importer, imported }`。Server 端的同类 import 是合法的。
- 同一条边可能重复写多次，用 Set 去重；最后按 `importer`、`imported` 排序，
  让测试结果稳定。未知路径直接忽略。

### 2. props 序列化校验

- 用递归；`ancestors` 只记录**当前递归栈**，递归返回时删除。用全局 visited
  会把两个兄弟位置引用同一个对象误报成循环。
- 先处理函数和 Symbol，再处理 null/对象；Date 是本题允许的例外，要在“普通
  对象/类实例”判断前识别。
- 普通对象只接受 `Object.getPrototypeOf(value) === Object.prototype`；数组单独
  处理；Map/Set/Promise/自定义类实例一律报 `class-instance`（这是练习的简化，
  真实 RSC 支持 Map/Set/Promise）。
- 每个问题都带路径。对象属性可用 `.key`，数组用 `[index]`；循环在“指回祖先”
  的位置报告。遇到一个问题不要 return，继续检查兄弟节点。
- `appendKey` 已给出；不必重写测试覆盖不到的特殊键格式。

### 3. RSC payload 与 children 槽

- 递归先区分 `kind`：text / element / client。Server 输出已经是 element，不能再
  试图执行组件函数。
- `client` 节点必须查 `clientModules[name]`；找不到时抛出包含组件名的错误，
  不能偷偷当成宿主元素。找到后输出 `chunk`、`props`（缺省 `{}`）和递归后的
  `children`。
- `children` 缺省统一输出空数组；Server 子树里可以继续嵌套另一个 Client 占位。
  这就是“Client Shell 通过 children 接收 Server 内容”的 payload 形态。
- 输出要能被 `JSON.stringify` / `JSON.parse` 往返（测试只使用普通 JSON 值，
  不要把 `NaN`/`Infinity` 当作可往返的数字）。为保持玩具格式简单，本题的
  `SerializableValue` 只允许 JSON 标量、数组和普通对象；不需要处理 Date、
  Map、Promise 等真实 RSC 支持的扩展类型。
- 真实 RSC 的 wire format、流式分块、Server Function 引用和错误恢复都不在本题
  范围内；不要把玩具输出当成 Next.js 实现。

## 本练习的三个简化

1. **ex1 的二元环境**：真实 Next.js 中一个模块可以同时被 Server 和 Client 模块图
   使用，并分别编译；本练习用“是否被客户端入口到达”把它分成二选一。
2. **ex2 的窄子集**：真实 React 19 支持 Date、Map、Set、Promise、全局 Symbol、
   JSX 和 Server Function 引用等；本练习明确只允许标量、Date、数组、普通对象，
   并把 Map/Set 当作 class-instance 拒绝。循环引用也被要求拒绝。这里考的是
   “跨边界只能传数据”的纪律，不是 React 序列化器的完整能力表。
3. **ex3 的玩具 payload**：只模拟 Server 输出、Client 占位和 children 槽，不模拟
   真实 RSC wire format、流式 Suspense 分块、缓存键、Server Function 等。

## 与讲义和真实项目的关系

- 真实 Next.js 中，`'use client'` 标记的是模块图边界；它 import 的模块进入
  client bundle。Server Component 可以 import Client Component，拿到的是 client
  reference；Client Component 不能 import server-only 模块。
- 真实 Server -> Client props 会进入 RSC payload 并到达浏览器，所以可序列化
  不等于可安全传递；`server-only`、DTO/字段最小化和鉴权才是安全边界。
- 要把 Server UI 嵌进 Client Shell，应由 Server Component 通过 `children` 等
  props 传入已经渲染好的输出，而不是让 Client 直接 import Server 组件。

完成后发“验收 W4D1”。
