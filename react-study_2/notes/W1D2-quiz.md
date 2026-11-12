# W1D2 课前测验：State 快照与更新

先凭理解作答。将答案写在每题的「你的答案」下；答案保存在 `notes/.answers/W1D2.md`，先不要打开。

## 复习 1：W1D1 state 身份

`Counter` 已点到 `n=3`。切换 `mode` 后，下面代码显示多少？为什么？

```tsx
{mode === 'a' ? <Counter key="a" /> : <Counter key="b" />}
```

**你的答案：**
n=0


## 复习 2：W1D1 render/commit

首次挂载时，以下 `console.log` 会打印什么？为什么不能把这种读 DOM 的操作当作获取“本次 JSX 对应 DOM”的方式？

```tsx
function App() {
  console.log(document.querySelector('#banner')?.textContent)
  return <h1 id="banner">欢迎</h1>
}
```

**你的答案：**
underfined,
因为render后还需要commit（进行diff），然后才会更新dom


## 第 1 题：预测 state 更新

初始 `number` 为 0。点击一次按钮后，屏幕会显示多少？逐行说明 state 队列如何变化。

```tsx
function Counter() {
  const [number, setNumber] = useState(0)
  return <button onClick={() => {
    setNumber(number + 5)
    setNumber(n => n + 1)
    setNumber(42)
  }}>{number}</button>
}
```

**你的答案：**
42


## 第 2 题：找 bug 并修复

点击输入框并输入 `Grace` 时，为什么下面组件的 React state 更新方式有问题？写出 `onChange` 的正确实现。

```tsx
const [user, setUser] = useState({ name: 'Ada', address: { city: 'London' } })
<input value={user.name} onChange={e => {
  user.name = e.target.value
  setUser(user)
}} />
```

**你的答案：**
不能直接更新user，它是readonly的
正确的变更： setUser({...user, name: e.target.value})


## 第 3 题：设计 state

购物车 state 是：

```tsx
const [items, setItems] = useState([{ id: 'tea', price: 20, quantity: 2 }])
```

以下哪个值应该额外用 `useState` 保存：`totalPrice`、`couponCode`、还是两者都不该？说明理由，并写出计算 `totalPrice` 的表达式。

**你的答案：**
1: 都不需要。因为现有的items已经包含了主要的属性 price，quantity，
const totalPrice =  items.reduce((a,b) =>  a.totalPrice+b.totalPrice,0)
console.log(totalPrice)

