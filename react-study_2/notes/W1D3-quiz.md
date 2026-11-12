# W1D3 课前测验：Effect

先独立作答，答案写在每题下方。不要先看 `notes/.answers/W1D3.md`。

## 复习 1：state 更新队列
初始 `n = 0`。点击一次后显示多少？说明每一项处理后 pending state 的值。

```tsx
setN(n + 1) // 旧n 0 ,  pending state 0 -> 1
setN(n => n + 1) // 使用 pending state n=1 , pending state 1 -> 2
setN(n + 1) // 旧 n=0 , pending state 0 => 1
```

**你的答案：**
初始时 0， 点击后 pending state 的运行值的顺序 1-》2-》3


## 复习 2：派生数据
`items` 是购物车 state，每项有 `price` 和 `quantity`。`totalPrice` 是否需要单独 `useState`？写出正确计算式。

**你的答案：**
不需要单独用useState, 因为强依赖 每一项的totalPrice 属性。
const totalPrice = items.reduce((sum,b) => sum+(b.price*b.quantity), 0)


## 第 1 题：要不要 Effect
对下列逻辑分别选择 **render**、**事件处理函数** 或 **Effect**，并写原因。

1. 根据 `firstName` 和 `lastName` 显示 `fullName`。
2. 用户点击“保存”后向 `/api/profile` 发 POST 请求。
3. `roomId` 改变时，建立/断开聊天 WebSocket 连接。

**你的答案：**
1: 不需要，因为 fullName基于 firstName+lastName计算就可以在render时得到
2: 不需要，因为一次用户点击触发时，可以使用点击处理函数
3: 需要，可以使用 useEffectEvent进行事件的声明，在useEffect内部通过绑定事件的方式触发。


## 第 2 题：cleanup 顺序
`roomId` 初始为 `"general"`，后变为 `"react"`，最后组件卸载。下面日志的顺序是什么？

```tsx
useEffect(() => {
  console.log('connect', roomId)
  return () => console.log('disconnect', roomId)
}, [roomId])
```

假设未启用 StrictMode。

**你的答案：**
connect general -》 disconnect general -》connect react -> disconnect react

## 第 3 题：找依赖 bug
下面代码的行为：首次显示 `count=0`，每秒加 1；但页面更新后，控制台仍反复打印 `count 0`。为什么？给出一个不使用 Effect Event 的正确修改。

```tsx
useEffect(() => {
  const id = setInterval(() => {
    console.log('count', count)
    setCount(count + 1)
  }, 1000)
  return () => clearInterval(id)
}, [])
```

**你的答案：**
 count的初始值0， setCount(count + 1) 每次在执行的时候输出的count都是0
 更新代码： setCount((count) =>  count+1), 这里每次得到的就是最新的 pending state，而不是闭包中的旧的count 0 。
