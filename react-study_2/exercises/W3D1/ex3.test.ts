import {
  commit,
  render,
  type FiberNode,
  type Root,
  type VNode,
} from './ex3'

const v1: VNode = {
  type: 'App',
  key: 'root',
  props: { title: '看板' },
  children: [
    { type: 'Header', key: 'header', props: { title: '看板' } },
    {
      type: 'List',
      key: 'list',
      props: { label: '任务' },
      children: [
        { type: 'Task', key: 'task-a', props: { label: 'A' } },
        { type: 'Task', key: 'task-b', props: { label: 'B' } },
      ],
    },
  ],
}

// 只改 Header 的 props，并在列表末尾新增一个任务。
const v2: VNode = {
  type: 'App',
  key: 'root',
  props: { title: '看板' },
  children: [
    { type: 'Header', key: 'header', props: { title: '看板 v2' } },
    {
      type: 'List',
      key: 'list',
      props: { label: '任务' },
      children: [
        { type: 'Task', key: 'task-a', props: { label: 'A' } },
        { type: 'Task', key: 'task-b', props: { label: 'B' } },
        { type: 'Task', key: 'task-c', props: { label: 'C' } },
      ],
    },
  ],
}

// 修改 A 的 props，并删除 B。
const v3: VNode = {
  type: 'App',
  key: 'root',
  props: { title: '看板' },
  children: [
    { type: 'Header', key: 'header', props: { title: '看板' } },
    {
      type: 'List',
      key: 'list',
      props: { label: '任务' },
      children: [{ type: 'Task', key: 'task-a', props: { label: 'A2' } }],
    },
  ],
}

function mountV1(): { root: Root; first: FiberNode } {
  const root: Root = { current: null }
  const result = render(root, v1)
  commit(root, result)

  // 起始文件 commit 还是空实现，这里应当先在断言上失败。
  expect(root.current).not.toBeNull()

  return { root, first: root.current as FiberNode }
}

test('首次 render：生成全新的 WIP 树，所有节点记录 placement，commit 前不动 current', () => {
  const root: Root = { current: null }
  const result = render(root, v1)

  expect(root.current).toBeNull()
  expect(result.wip).not.toBeNull()
  expect(result.wip.alternate).toBeNull()
  expect(result.wip.children[1].children[0].alternate).toBeNull()

  expect(result.effects).toEqual([
    { tag: 'placement', type: 'App', key: 'root' },
    { tag: 'placement', type: 'Header', key: 'header' },
    { tag: 'placement', type: 'List', key: 'list' },
    { tag: 'placement', type: 'Task', key: 'task-a' },
    { tag: 'placement', type: 'Task', key: 'task-b' },
  ])

  commit(root, result)
  expect(root.current).toBe(result.wip)
})

test('render 不修改 current 树，WIP 通过 alternate 指向旧 fiber', () => {
  const { root, first } = mountV1()
  const snapshot = JSON.stringify(first)

  const result = render(root, v2)

  // current 树的内容和引用都没动。
  expect(root.current).toBe(first)
  expect(JSON.stringify(first)).toBe(snapshot)
  expect(first.alternate).toBeNull()

  // WIP 是另一棵树，但通过 alternate 指向旧节点。
  expect(result.wip).not.toBe(first)
  expect(result.wip.alternate).toBe(first)
  expect(result.wip.children[0]).not.toBe(first.children[0])
  expect(result.wip.children[0].alternate).toBe(first.children[0])
  expect(result.wip.children[1].children[0].alternate).toBe(
    first.children[1].children[0],
  )

  // 变更节点的 update、新增节点的 placement。
  expect(result.effects).toEqual([
    { tag: 'update', type: 'Header', key: 'header' },
    { tag: 'placement', type: 'Task', key: 'task-c' },
  ])

  commit(root, result)

  expect(root.current).toBe(result.wip)
  expect(root.current?.children[0].props.title).toBe('看板 v2')
  expect(root.current?.children[1].children.map((child) => child.key)).toEqual([
    'task-a',
    'task-b',
    'task-c',
  ])
  // 旧的 current 树保持原样。
  expect(first.children[1].children.map((child) => child.key)).toEqual([
    'task-a',
    'task-b',
  ])
})

test('更新 render：记录 update 与 deletion，commit 后新树才生效', () => {
  const { root, first } = mountV1()

  const result = render(root, v3)

  expect(root.current).toBe(first)
  expect(result.effects).toEqual([
    { tag: 'update', type: 'Task', key: 'task-a' },
    { tag: 'deletion', type: 'Task', key: 'task-b' },
  ])

  // render 阶段旧树仍然完整。
  expect(first.children[1].children).toHaveLength(2)

  commit(root, result)

  expect(root.current?.children[1].children.map((child) => child.key)).toEqual([
    'task-a',
  ])
  expect(root.current?.children[1].children[0].props.label).toBe('A2')
  expect(first.children[1].children).toHaveLength(2)
})

test('卸载整棵子树只产生一个 deletion（记录子树根）', () => {
  const { root, first } = mountV1()

  const withoutList: VNode = {
    type: 'App',
    key: 'root',
    props: { title: '看板' },
    children: [{ type: 'Header', key: 'header', props: { title: '看板' } }],
  }

  const result = render(root, withoutList)

  expect(result.effects).toEqual([
    { tag: 'deletion', type: 'List', key: 'list' },
  ])
  expect(result.wip.children).toHaveLength(1)

  commit(root, result)

  expect(root.current?.children.map((child) => child.key)).toEqual(['header'])
  expect(first.children).toHaveLength(2)
})

test('无变化时再次 render：没有副作用，commit 完成一次双缓冲切换', () => {
  const { root, first } = mountV1()

  const result = render(root, v1)

  expect(result.effects).toEqual([])
  expect(result.wip).not.toBe(first)
  expect(result.wip.alternate).toBe(first)
  expect(result.wip.children[1].alternate).toBe(first.children[1])

  commit(root, result)

  expect(root.current).toBe(result.wip)
  // 我们只把 alternate 写在 WIP 上，旧树在 render 期间没有被写入。
  expect(first.alternate).toBeNull()
})
