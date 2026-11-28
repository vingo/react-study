# W4D5 综合测验：从渲染模型到全栈边界

先独立作答，不查资料、不运行代码；把答案写在每题下方的「你的答案」处。参考答案在 `notes/.answers/W4D5.md`，做完前不要打开。

本卷共 **9 分**：2 道复习题（各 0.5 分，跨周知识点），3 道综合题（3 + 2.5 + 2.5 分，覆盖架构、安全、性能/并发）。以 React 19.3、React Compiler 1.0、TanStack Query 5、Zustand 5、React Router 8 为准。本机未安装 Next.js 16；涉及 App Router / Server Actions 的题目考心智模型与边界，不要求写出可运行的 Next.js 项目，缓存 API 的签名以官方文档为准。

## 复习 1：index key 与 state 身份（0.5 分｜来自 W1D1 / W1D2 / W3D1）

```tsx
function Row({ item }: { item: { id: string; title: string } }) {
  const [note, setNote] = useState('')
  return (
    <li>
      {item.title}
      <input
        aria-label={`备注-${item.title}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </li>
  )
}

function Board() {
  const [items, setItems] = useState([
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
  ])

  return (
    <>
      <button onClick={() => setItems((prev) => prev.filter((i) => i.id !== 'a'))}>
        删除 A
      </button>
      <ul>
        {items.map((item, index) => (
          <Row key={index} item={item} />
        ))}
      </ul>
    </>
  )
}
```

先在“备注-A”输入 `hello`，再点击“删除 A”。

1. 删除后，`hello` 会出现在哪一行的输入框里？B、C 的 `Row` state 分别发生了什么？
2. 如果改成 `key={item.id}`，结果有什么不同？
3. 用“render 阶段读到的 DOM / commit 才写 DOM”或 Fiber 复用规则解释一次，不要只背“index key 不好”。

**你的答案：**

## 复习 2：三份真相（0.5 分｜来自 W2D3 / W2D4 / W2D5）

下面的组件同时使用了 URL、Zustand 和 TanStack Query：

```tsx
function BoardPage() {
  const [params] = useSearchParams()
  const status = useFilterStore((s) => s.status) // 'all' | 'done'
  const { data } = useQuery({
    queryKey: ['cards'],
    queryFn: () => fetchCards({ status }),
  })
  const [cards, setCards] = useState(data ?? [])
  useEffect(() => setCards(data ?? []), [data])

  return <Board cards={cards} filter={status} />
}
```

用户把筛选从 `all` 切到 `done`，刷新后又用浏览器后退。

1. 指出至少两处“两份真相”或缓存失效问题，并说明用户会看到什么。
2. 给出修正后的状态归属：筛选、查询键、服务端数据分别应该以谁为准？

**你的答案：**

## 第 1 题：Kanban v4 架构白板（3 分）

团队要把看板迁移到 App Router（Next.js 16）。需求：

- 看板首屏要能 SEO/快速首屏，单个看板最多 2000 张卡片；
- 筛选 `?assignee=me&q=登录` 必须可分享、可前进后退；
- 拖拽要即时反馈，失败要回滚；
- 评论区实时更新，并显示“谁在线、正在拖哪张卡”；
- 设置页包含成员角色（owner/editor/viewer）与审计日志，只有 owner 能改角色；
- 卡片移动、评论、权限变更都要让相关页面看到新数据。

1. 完成边界表：为“看板快照、筛选栏、拖拽画布、实时评论、presence、权限设置、审计日志”各选 Server / Client，写明数据来源（RSC / Query / URL / Zustand）、路由、缓存 tag 与失效点。（1.25 分）
2. 说明状态放置：为什么看板快照不应复制进 Zustand？如果客户端也要用 Query 缓存看板，怎样避免 RSC 与 Query 两份真相？评论与 presence 为什么不是同一种状态？（1 分）
3. 给出加载/错误策略与测试策略，至少覆盖页面级、查询级、交互级三层。（0.75 分）

**你的答案：**

## 第 2 题：Server Action 安全评审（2.5 分）

```ts
'use server'

export async function moveCard(formData: FormData) {
  const session = await getSession()
  if (!session) throw new Error('unauthorized')

  const cardId = String(formData.get('cardId'))
  const toListId = String(formData.get('toListId'))
  const projectId = String(formData.get('projectId'))
  const canEdit = formData.get('canEdit') === 'true'

  if (!canEdit) throw new Error('forbidden')

  await db.card.update({
    where: { id: cardId, projectId },
    data: { listId: toListId },
  })

  revalidateTag('cards')
  return { ok: true }
}
```

客户端在渲染按钮时已经用 `canEdit` 控制过显隐，项目 ID 也来自当前页面。

1. 列出至少 5 个安全或正确性问题，并说明攻击者/用户如何触发。（1.25 分）
2. 写出安全的 `moveCard` 流水线（伪代码即可）：认证、授权、输入校验、归属校验、事务/回滚、失效 tag 的顺序与失败返回。（0.75 分）
3. 解释：为什么 `revalidateTag('cards')` 的粒度不合适？失败时应该回滚什么、失效什么？2025 年末的 RSC/Server Actions 安全公告给团队什么行动项？（0.5 分）

**你的答案：**

## 第 3 题：搜索、拖拽与 2000 张卡片（2.5 分）

Kanban 页面顶部有搜索框，下面渲染 2000 张卡片，并支持拖拽。团队已经给 `CardList` 包了 `memo`，也在搜索框使用了 `useDeferredValue`，但输入仍然卡顿。Profiler 显示：

```text
一次输入 commit：actualDuration 182ms，baseDuration 190ms
CardList 每次输入都 render；Card 的 render 占比很小
DragOverlay 每次输入也 render
提交耗时主要来自 DOM 更新与布局
```

代码片段：

```tsx
function Board({ cards }: { cards: Card[] }) {
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)
  const visible = cards.filter((c) => c.title.includes(deferredQuery))

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <CardList
        cards={visible}
        options={{ dragging }}
        onDragStart={(id) => setDragging(id)}
      />
      <DragOverlay dragging={dragging} />
    </>
  )
}

const CardList = memo(function CardList({ cards, options, onDragStart }) {
  return cards.map((card) => (
    <Card key={card.id} card={card} options={options} onDragStart={onDragStart} />
  ))
})
```

1. 结合 Profiler 数字判断：瓶颈更可能在 render 还是 commit/DOM？为什么 `useDeferredValue` 和 `CardList` 的 `memo` 没有生效？至少指出两个具体原因。（1 分）
2. 给出优化顺序：先做什么、再做什么、最后做什么；每一步说明如何用同场景复测验证。（1 分）
3. React Compiler 在这段代码里能帮上什么、帮不上什么？如果要用 transition，应该把哪部分放进 transition，受控输入为什么不能放？（0.5 分）

**你的答案：**
