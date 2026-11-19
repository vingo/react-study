# W3D1 课前测验：Fiber 与协调

先独立作答，不查资料；把答案写在每题的「你的答案」下面。参考答案在 `notes/.answers/W3D1.md`，做完前不要打开。

本卷共 9 分：3 道新主题题（2 + 2 + 3 分），2 道复习题（各 1 分）。

## 复习 1：state 更新队列（1 分）

初始 `n = 0`。点击一次按钮后，界面显示多少？写出每一行执行后的 pending state。

```tsx
function handleClick() {
  setN(n + 1)       // 1
  setN(n => n + 1)  // 2
  setN(n + 1)       // 3
  setN(n => n * 2)  // 4
}
```

**你的答案：**
显示2，
顺序： n用快照的值0 ，值1  -》 接收上一步的pending 1  值2 -〉直接使用快照的值 0 值1 -》 pending 1 值 2

## 复习 2：render、事件处理函数与 Effect 的职责边界（1 分）

有三个需求：

1. 点击「保存」按钮后，向 `/api/save` 发送 POST 请求；
2. `roomId` 变化时建立 WebSocket 连接，`roomId` 再次变化或组件卸载时断开旧连接；
3. 显示 `fullName`，它由 `firstName` 和 `lastName` 拼接得到。

分别应该写在哪里（事件处理函数 / `useEffect` / 直接在 render 中计算）？并说明：把第 1 项放进 Effect 会有什么问题；把第 3 项用 `useState` + `useEffect` 同步会有什么问题。

**你的答案：**

1:事件函数 处理post
2:使用 useEffect 依赖roomid。setup建立连接，cleanup关闭连接。roomid变化时，先执行旧cleanup，然后 新setup；卸载时执行新cleanup；
3: fullname在render内计算，无需state做额外存储；
3.1: effect在渲染提交后执行，同时会在挂载，依赖变化时多次执行；
3.2: 虽然可以达到计算fullname效果，effect单首次渲染 fullname为空值，多一次渲染，用户可能会看到闪现的不一致，
同时保存了2份数据（firstName/lastName，fullName），需要手动保持头部




## 第 1 题：Fiber 树与双缓冲（2 分）

```tsx
function App() {
  return (
    <main>
      <Header />
      <ul>
        <li>A</li>
        <li>B</li>
      </ul>
      <Footer />
    </main>
  )
}
```

假设 `Header` 和 `Footer` 的内部实现暂时忽略，只看题目中出现的这些元素。React 在一次更新中会从根开始构建 work-in-progress 树，然后进入 commit。

1. Fiber 节点在内存中如何同时找到「第一个子节点」「下一个兄弟节点」和「父节点」？它为什么不是用 `children: Fiber[]` 数组表示？
2. 按深度优先顺序，写出从 `main` 开始访问 `main`、`Header`、`ul`、`li(A)`、`li(B)`、`Footer` 的顺序，并说明什么时候会沿父节点回退。
3. `current` 树与 work-in-progress 树是什么关系？为什么 render 阶段被中断或丢弃时，用户不会看到半成品 UI；而 commit 之后屏幕能一次性切换？
4. commit 完成后 `root.current` 指向哪棵树？下一轮更新时，这两棵树如何被复用？

**你的答案：**
1: fiber返回三个信息：child，sibling，return；要遍历所有子节点，从 `child` 开始沿 `sibling` 链前进即可。
2: 顺序： main-》header-〉ul-> li(a)->li(b)->footer,
   执行的过程：有子节点就继续下探；没有子节点就完成当前节点并找兄弟节点了没有兄弟节点就沿着父节点会退，直到找到兄弟节点会在跟节点；
3: current 树是页面显示的信息，root.current 就指向它。 work-in-progress fiber 通过`alternate` 指向 `current`树中对应的filber。
render阶段只是在调用组件，计算新的jsx，做diff，构建work-in-progress树，不会修改真实的 DOM，这个阶段即使失败/暂停/重新开始都不影响页面显示。
commit完成后会得到完成的work-in-pregress树， `root.current` 会指向它； 
下一轮更新时： 旧的`current` 不会销毁，而是称为新`current` 的`alternate`,下一轮更新后，react会以新的`current`来显示UI，2颗树会交替展示在用户的UI上，这就是 双缓冲。


## 第 2 题：render 阶段与 commit 阶段的时序（2 分）

忽略 StrictMode 的双调用，也假设没有父组件导致的额外重渲染。下面的组件在浏览器中首次挂载，然后点击一次按钮：

```tsx
function App() {
  const [count, setCount] = useState(0)
  const pRef = useRef<HTMLParagraphElement>(null)

  console.log('render', count, pRef.current?.textContent ?? 'null')

  useLayoutEffect(() => {
    console.log('layout', count, pRef.current?.textContent)
  })

  useEffect(() => {
    console.log('passive', count, pRef.current?.textContent)
  })

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <p ref={pRef}>{count}</p>
    </div>
  )
}
```

1. 首次挂载时，`render`、`layout`、`passive` 三条日志的顺序和每条日志的第三个值分别是什么？
2. 点击一次按钮后，三条日志的顺序和值又是什么？`render` 中读到的 `pRef.current.textContent` 与本次渲染的 `count` 是否一致？解释原因。
3. 如果在 render 函数体里直接写 `pRef.current.textContent = String(count)`，会违反什么规则？可能造成哪些具体问题？
4. 用一句话说明：哪些工作属于 render 阶段，哪些工作属于 commit 阶段？

**你的答案：**
1: render 0 null
layout 0 0
passive 0 0， 执行顺序： render -》 layout-〉 effect
2: 点击后输出：render 1 0
  layout 1 1
  passive 1 1；
3: render内必须是单纯的计算：不能修改已经渲染出的对象或者DOM，这样会影响render多次执行，绕过了react对DOM操作的控制权，破坏了并发渲染的可预测性；
4: render阶段： 调用组件，计算jsx，做diff，构建work-in-progress；不修改DOM，可以被中断，暂停，丢弃，重做；
commit 阶段： 把已经计算好的变更同步应用到DOM，切换root.current.


## 第 3 题：同层 diff、index key 与 key 变化（3 分）

```tsx
type Item = { id: string; name: string }

function Row({ name }: { name: string }) {
  const [note, setNote] = useState('')
  useEffect(() => {
    console.log('mount', name)
    return () => console.log('unmount', name)
  }, [])

  return (
    <li>
      <span>{name}</span>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="备注"
      />
    </li>
  )
}

function List({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <Row key={index} name={item.name} />
      ))}
    </ul>
  )
}
```

初始数据是 `[A, B, C]`，用户在第一个输入框（A 那一行）里输入了 `hello`，其他输入框为空。

1. 现在在数组开头插入 `X`，得到 `[X, A, B, C]`。四个输入框分别显示什么？`hello` 这份 state 现在挂在哪个名字旁边？控制台会打印哪些 `mount` / `unmount`？为什么？
2. 如果改成从 `[A, B, C]` 中删除 A，得到 `[B, C]`，会发生什么？`hello` 最后显示在哪一行？哪一行的 state 被销毁？
3. 把 `key={index}` 改成 `key={item.id}` 后，插入 X 时 A、B、C 的备注和输入框 DOM 会怎样？如果又改成 ``key={`${item.id}-${index}`}``，插入 X 后会发生什么？请解释原因。
4. React 在同一个父节点下比较新旧子节点时，判断「能否复用旧 Fiber」要看哪两个东西？分别说明：key 相同但元素类型从 `Row` 变成 `section`；类型相同但 key 变了。key 需要全局唯一吗？

**你的答案：**
1: hello,,,; 输出： mount：C;
2: 删除a后，输出是：unmount:c,其中 hello显示在b行；c行的state被销毁
3: 更新``key={`${item.id}`}``后，abc保持不变，输出： mount：X。
更新```key={`${item.id}-${index}`}``后，因为key全部和旧的对不上，abc全部卸载，然后重新挂载xabc
4: key 是否一样， 元素类型是否一样
`key相同，类型变为section`： 不能复用，旧的row被卸载，dom被删除；新的section重新挂载
`key不同，类型一样`：不能复用，旧的卸载，state和DOm 重新创建
key只要在兄弟节点子建唯一，不需要全局唯一


