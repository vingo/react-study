# W1D1 课前测验：渲染模型

先答题，再读讲义。不查资料、不运行代码，凭理解写出答案和理由；答错正好暴露盲区。
答案写在每题下方的"你的答案"处，做完练习后运行 `/study-review W1D1` 判卷。

## 第 1 题：预测输出

未开启 StrictMode。`Title` 首次渲染时 `text` 为 `"A"`，之后父组件把 `text` 改成 `"B"`。控制台依次打印什么？为什么？

```tsx
function Title({ text }: { text: string }) {
  console.log(document.querySelector('h1')?.textContent)
  return <h1>{text}</h1>
}
```

**你的答案：**
打印A，会直接读取上次的渲染的内容，因为B是最新的一次属性值，还没有渲染到。


## 第 2 题：解释现象

```tsx
function Feed({ items }: { items: string[] }) {
  const newestFirst = items.reverse()
  return <ul>{newestFirst.map((m) => <li key={m}>{m}</li>)}</ul>
}
// 父组件传入 items = ['周一', '周二', '周三']，页面上有个"刷新"按钮，点击会让父组件重新渲染
```

开发环境（开启 StrictMode）下，列表始终是"周一、周二、周三"，看起来 `reverse()` 没起作用。
上线后，每点一次"刷新"，列表顺序就翻转一次。

1. 解释这两个现象。
2. 写出正确的写法。
  

**你的答案：**
1: 严格模型下，render会执行多次
2:  const newestFirst = items.toReversed() 复刻一份新的items数据

## 第 3 题：预测 state 是否保留

```tsx
function Counter() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>n={n}</button>
}
```

先点 `Counter` 3 次，再点"切换"按钮（`fancy` 从 false 变为 true）。下面两种写法，切换后分别显示 `n=` 几？为什么？

```tsx
// 写法 A
{fancy ? <Counter /> : <Counter />}

// 写法 B
{fancy ? <div><Counter /></div> : <section><Counter /></section>}
```

**你的答案：**
A: 显示n=0, Counter组件在fancy=false 的时候重新创建一个，n的初始值是0
B:  n=3 

