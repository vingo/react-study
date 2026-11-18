# W2D2 课前测验：Suspense 与 use()

先独立作答，不查资料、不运行代码。把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W2D2.md`，做完前不要打开。

## 复习 1：render 时读到的 DOM 是哪一个（1 分｜来自 W1D1 第 1 题）

未开启 StrictMode。`Title` 首次渲染时 `text` 为 `"A"`，之后父组件把 `text` 改成 `"B"`。

```tsx
function Title({ text }: { text: string }) {
  console.log('render:', document.querySelector('h1')?.textContent)

  useEffect(() => {
    console.log('effect:', document.querySelector('h1')?.textContent)
  })

  return <h1>{text}</h1>
}
```

控制台按什么顺序打印哪些内容？分别解释两次 render 与两次 effect 读到的 DOM 为什么不同。

**你的答案：**
render: undefined-> effect:A -> render: A, effect:B
render读取读取到上一次的commit的DOM。 effect是在commit后运行的。


## 复习 2：Effect 的 cleanup 顺序（1 分｜来自 W1D3 第 2 题）

`roomId` 初始为 `"general"`，之后变为 `"react"`，最后组件卸载。假设未开启 StrictMode。

```tsx
useEffect(() => {
  console.log('connect', roomId)
  return () => console.log('disconnect', roomId)
}, [roomId])
```

控制台的日志顺序是什么？依赖变化和组件卸载时，cleanup 与 setup 的先后关系分别是什么？

**你的答案：**
connect -> disconnect general -> connect react -> disconnect react



## 第 1 题：`use` 的调用位置与 Promise 稳定性（2.5 分）

假设 `fetchAlbums` 内部没有缓存：每次调用都会发起一次新请求，并返回一个新的 Promise。

```tsx
function Albums({ query, enabled }: { query: string; enabled: boolean }) {
  const albumsPromise = fetchAlbums(query)

  let content = <p>已关闭</p>
  if (enabled) {
    const albums = use(albumsPromise)
    content = (
      <ul>
        {albums.map(album => <li key={album.id}>{album.title}</li>)}
      </ul>
    )
  }

  return <section>{content}</section>
}

function AlbumsTry({ query }: { query: string }) {
  try {
    const albums = use(fetchAlbums(query))
    return <ul>{albums.map(album => <li key={album.id}>{album.title}</li>)}</ul>
  } catch {
    return <p>加载失败</p>
  }
}

// 使用处
<Suspense fallback={<p>加载中…</p>}>
  <Albums query={query} enabled={show} />
</Suspense>
```

1. `Albums` 把 `use` 写在 `if (enabled)` 里，是否违反 Hooks 规则？`enabled` 为 `false` 时，`fetchAlbums(query)` 还会执行吗？把请求放在 render 里有什么问题？
2. `AlbumsTry` 想用 try/catch 显示“加载失败”。在 Promise 仍然 pending 时、以及 Promise reject 时，它分别会显示什么？为什么 React 文档明确说 `use` 不能放在 try/catch 里？
3. 如果把 `Albums` 改成直接 `use(fetchAlbums(query))`，或者写成 `use(fetchAlbums(query).then(r => r.json()))`，分别会发生什么？请解释为什么在 render 中新建 Promise 会让内容可能一直出不来；开发环境可能出现什么警告？
4. 给出正确做法：Promise 应该在哪里创建、如何按 `query` 复用同一个实例？`query` 变化时怎样拿到新 Promise，同时避免把正在输入的内容卡住？

**你的答案：**
1: 是违反hooks规则
2: AlbumsTry函数会吞掉catch，影响suspense的error状态， pending时显示fallback的内容，reject时冒泡搭配errorbondary 的处理
3: 组件一直处于初始状态，每次render都是新的promise，然后出发再次render，一直重复下去。
4: 以引入的方式使用use（fetchAlbums(query))）， 在 fetchAlbums内部 添加map 的缓存，key为 query, value为对应的promise，map对象中有就取，没有就添加，然后取。 重试时，清空掉对应的key，以避免一直失败。


## 第 2 题：Suspense fallback 与 transition 下的更新（2 分）

`getAlbums(artistId)` 按 `artistId` 缓存 Promise，同一个 id 会返回同一个实例。`Header` 不会挂起。

```tsx
function ArtistPage() {
  const [artistId, setArtistId] = useState('beatles')
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <button onClick={() => setArtistId('floyd')}>Pink Floyd</button>
      <button onClick={() => startTransition(() => setArtistId('zeppelin'))}>
        Led Zeppelin
      </button>

      <Suspense fallback={<p>页面加载中…</p>}>
        <Header />
        <Suspense fallback={<p>专辑加载中…</p>}>
          <Albums artistId={artistId} />
        </Suspense>
      </Suspense>

      {isPending && <p>切换中…</p>}
    </>
  )
}

function Albums({ artistId }: { artistId: string }) {
  const albums = use(getAlbums(artistId))
  return (
    <ul>
      {albums.map(album => <li key={album.id}>{album.title}</li>)}
    </ul>
  )
}
```

1. 首次挂载、beatles 的 Promise 仍然 pending 时，屏幕显示哪个 fallback？如果在首次挂载时用 `startTransition` 设置 `artistId`，能否避免这个 fallback？为什么？
2. 已经显示 beatles 的专辑后，点击 Pink Floyd（普通 `setState`）。在 floyd 的 Promise pending 期间，屏幕显示什么？`isPending` 是什么？
3. 已经显示 beatles 的专辑后，点击 Led Zeppelin（`startTransition`）。在 zeppelin 的 Promise pending 期间，屏幕显示什么？`isPending` 是什么？为什么此时不显示 fallback？
4. 如果在一个 transition 导航中从 artist A 切到 artist B，你希望显示 B 的加载 fallback，而不是继续显示 A 的旧专辑，应该把 `key` 加在哪一层？不加 key 与加 key 的行为差别是什么？

**你的答案：**
1: 专辑加载中…
2: 专辑加载中…， 切换中…
3: 页面加载中
4: key放在 albums， 添加后子组件和 key是一对，key不变子模块不卸载，key更新组模块会完全重新创建。


## 第 3 题：rejected Promise、Error Boundary 与请求竞态（2.5 分）

### A 部分：错误边界与重试

`fetchUser('alice')` 会在 500ms 后 reject。

```tsx
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function Profile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise)
  return <h1>{user.name}</h1>
}

function App() {
  const [userPromise, setUserPromise] = useState(() => fetchUser('alice'))
  const [attempt, setAttempt] = useState(0)

  return (
    <>
      <button onClick={() => setAttempt(a => a + 1)}>重试</button>

      <Boundary fallback={<p>加载失败</p>}>
        <Suspense fallback={<p>加载中…</p>}>
          <Profile userPromise={userPromise} />
        </Suspense>
      </Boundary>

      <p>尝试次数：{attempt}</p>
    </>
  )
}
```

1. 从首次渲染到 Promise reject 后，用户依次看到什么？由 Suspense 还是 Error Boundary 接管？如果没有 `Boundary` 会怎样？
2. 点击“重试”后，组件会重新请求吗？屏幕会变回“加载中…”吗？为什么？正确的重试需要同时改动哪两件事？
3. 把 `Boundary` 放在 `App` 外层，和只包住 `Profile`，fallback 影响的范围有什么区别？这个 Error Boundary 能捕获 `onClick` 或 `setTimeout` 里的错误吗？`startTransition` 里的错误呢？

### B 部分：请求竞态与加载状态

```tsx
function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    setUser(null)
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(data => setUser(data))
  }, [id])

  return user
}
```

4. 从 alice 快速切到 bob。bob 的响应先到，alice 的响应后到。最终屏幕显示谁？为什么？用 cleanup 写出修复（ignore 标记或 AbortController）。如果希望在 bob 加载期间继续显示 alice，而不是闪回“加载中”，加载状态应该怎样设计？

**你的答案：**
A部分：
1: 加载中 -》加载失败， 由 errorboundary接管，如果没有errorboundary，会一直冒泡到根节点，并抛出异常
2: 会重新请求，显示加载中，
3: 有区别，组件Profile发生异常后，只有最近的Boundary的子模块受影响。 fallback只在 promise pending时才有效
B部分：
4:  显示 bob，
