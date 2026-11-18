import { reconcileChildren, type VNode } from './ex2'

function node(
  type: string,
  key: string,
  props: Record<string, unknown> = {},
): VNode {
  return { type, key, props }
}

test('插入：只挂载新节点，不产生 update/move', () => {
  const oldChildren = [node('li', 'a', { label: 'A' }), node('li', 'b', { label: 'B' })]
  const newChildren = [
    ...oldChildren,
    node('li', 'c', { label: 'C' }),
  ]

  const result = reconcileChildren(oldChildren, newChildren)

  expect(result.mounts).toEqual([
    { type: 'mount', key: 'c', index: 2, node: newChildren[2] },
  ])
  expect(result.updates).toEqual([])
  expect(result.unmounts).toEqual([])
  expect(result.moves).toEqual([])
})

test('删除：只卸载消失的 key，后面的节点补位不算 move', () => {
  const oldChildren = [
    node('li', 'a', { label: 'A' }),
    node('li', 'b', { label: 'B' }),
    node('li', 'c', { label: 'C' }),
  ]
  const newChildren = [oldChildren[0], oldChildren[2]]

  const result = reconcileChildren(oldChildren, newChildren)

  expect(result.mounts).toEqual([])
  expect(result.updates).toEqual([])
  expect(result.unmounts).toEqual([{ type: 'unmount', key: 'b' }])
  expect(result.moves).toEqual([])
})

test('重排：保持相对顺序的节点不移动，被新顺序跨过的节点产生 move', () => {
  const oldChildren = [
    node('li', 'a', { label: 'A' }),
    node('li', 'b', { label: 'B' }),
    node('li', 'c', { label: 'C' }),
  ]
  const newChildren = [oldChildren[2], oldChildren[0], oldChildren[1]]

  const result = reconcileChildren(oldChildren, newChildren)

  expect(result.mounts).toEqual([])
  expect(result.updates).toEqual([])
  expect(result.unmounts).toEqual([])
  expect(result.moves).toEqual([
    { type: 'move', key: 'a', from: 0, to: 1, node: newChildren[1] },
    { type: 'move', key: 'b', from: 1, to: 2, node: newChildren[2] },
  ])
})

test('type 变化：同 key 也要先卸载旧节点再挂载新节点', () => {
  const oldChildren = [
    node('li', 'a', { label: 'A' }),
    node('li', 'b', { label: 'B' }),
  ]
  const newChildren = [
    node('li', 'a', { label: 'A' }),
    node('p', 'b', { label: 'B' }),
  ]

  const result = reconcileChildren(oldChildren, newChildren)

  expect(result.mounts).toEqual([
    { type: 'mount', key: 'b', index: 1, node: newChildren[1] },
  ])
  expect(result.updates).toEqual([])
  expect(result.unmounts).toEqual([{ type: 'unmount', key: 'b' }])
  expect(result.moves).toEqual([])
})

test('key 变化：即使 type 相同也视为不同节点', () => {
  const oldChildren = [
    node('li', 'a', { label: 'A' }),
    node('li', 'b', { label: 'B' }),
  ]
  const newChildren = [
    node('li', 'a', { label: 'A' }),
    node('li', 'c', { label: 'C' }),
  ]

  const result = reconcileChildren(oldChildren, newChildren)

  expect(result.mounts).toEqual([
    { type: 'mount', key: 'c', index: 1, node: newChildren[1] },
  ])
  expect(result.updates).toEqual([])
  expect(result.unmounts).toEqual([{ type: 'unmount', key: 'b' }])
  expect(result.moves).toEqual([])
})

test('props 浅比较：只有变化的匹配节点产生 update', () => {
  const oldChildren = [
    node('li', 'a', { label: 'A', done: false }),
    node('li', 'b', { label: 'B', done: false }),
  ]
  const newChildren = [
    node('li', 'a', { label: 'A2', done: false }),
    node('li', 'b', { label: 'B', done: false }),
  ]

  const result = reconcileChildren(oldChildren, newChildren)

  expect(result.mounts).toEqual([])
  expect(result.updates).toEqual([
    {
      type: 'update',
      key: 'a',
      index: 0,
      node: newChildren[0],
      prev: oldChildren[0],
    },
  ])
  expect(result.unmounts).toEqual([])
  expect(result.moves).toEqual([])
})

test('混合场景：插入 + 更新 + 卸载可以同时发生', () => {
  const oldChildren = [
    node('li', 'a', { label: 'A' }),
    node('li', 'b', { label: 'B' }),
    node('li', 'c', { label: 'C' }),
  ]
  const newChildren = [
    node('li', 'a', { label: 'A' }),
    node('li', 'd', { label: 'D' }),
    node('li', 'b', { label: 'B2' }),
  ]

  const result = reconcileChildren(oldChildren, newChildren)

  expect(result.mounts).toEqual([
    { type: 'mount', key: 'd', index: 1, node: newChildren[1] },
  ])
  expect(result.updates).toEqual([
    {
      type: 'update',
      key: 'b',
      index: 2,
      node: newChildren[2],
      prev: oldChildren[1],
    },
  ])
  expect(result.unmounts).toEqual([{ type: 'unmount', key: 'c' }])
  expect(result.moves).toEqual([])
})
