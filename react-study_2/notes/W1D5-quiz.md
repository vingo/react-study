# W1D5 课前测验：组合、状态提升、key、Reducer 与 Context

先独立作答；将答案写在每题的「你的答案」下面。参考答案在 `notes/.answers/W1D5.md`，先不要打开。

## 复习 1：state 更新队列

初始 `n = 0`。一次点击后，以下代码最终显示多少？写出每项处理后的 pending state。

```tsx
setN(n + 1)
setN(n => n + 1)
setN(n + 1)
```

**你的答案：**
1 -》 2-》1


## 复习 2：Effect 与 Effect Event

`roomId` 变化时要重连聊天服务；连接成功时要显示使用**最新** `theme` 的通知，但切换 theme 不应重连。`useEffect` 和 `useEffectEvent` 各负责什么？

**你的答案：**

useEffectEvent 负责 roomid的链接事件
useEffect 负责链接

## 第 1 题：状态提升

现在两个 `Panel` 都各自维护 `isOpen`。产品要求“账户”和“订单”最多只能展开一个。state 应放在哪里？父组件应存什么最小数据？子组件应收到哪些 props？

**你的答案：**
可以使用父组件的state+ 控制父组件的状态回调函数。


## 第 2 题：key 重置 state

```tsx
function Messenger({ recipient }: { recipient: Contact }) {
  return <Chat recipient={recipient} />
}
```

`Chat` 内部有草稿 `useState`。从 Ada 切换到 Grace 时，为什么草稿会保留？如何让每位收件人得到空白草稿？为什么不能写 `key={Math.random()}`？

**你的答案：**
key 的值如果是Math.random() 就是一个随机数，没有办法做后续用户维度的追踪。


## 第 3 题：Reducer 与 Context

补全 `tasksReducer` 的 `toggled` 分支：它应不修改原 `tasks` 数组和原 task 对象，只切换指定 id 的 `done`。再说明为什么把 `crypto.randomUUID()` 放进 reducer 不合适。

```tsx
type Task = { id: string; text: string; done: boolean }
type Action = { type: 'toggled'; id: string }

function tasksReducer(tasks: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'toggled':
      return tasks.map(task => task.id === task.type ? {...task, done: !task.done}: task)
    default:
      throw Error('无task，需要创新验证')
  }
}
```

**你的答案：**

function tasksReducer(tasks: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'toggled':
      return tasks.map(task => task.id === task.type ? {...task, done: !task.done}: task)
    default:
      throw Error('无task，需要创新验证')
  }
}