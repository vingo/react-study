// 参考答案 2：同层 keyed diff
//
// 一次扫描新 children：
// - key + type 都命中旧节点：复用，props 浅比较不同则 update；
//   再用 lastPlacedIndex（这里用“前面匹配节点的最大旧下标”）判断 move；
// - 否则 mount。
// 最后扫描旧 children：没有被匹配的 key 就是 unmount。
//
// 复杂度 O(n^2) 的 move 判断对练习足够；真实 React 用 lastPlacedIndex
// 的单向扫描，效果等价。

export type VNode = {
  type: string
  key: string
  props: Record<string, unknown>
}

export type MountOp = {
  type: 'mount'
  key: string
  index: number
  node: VNode
}

export type UpdateOp = {
  type: 'update'
  key: string
  index: number
  node: VNode
  prev: VNode
}

export type UnmountOp = {
  type: 'unmount'
  key: string
}

export type MoveOp = {
  type: 'move'
  key: string
  from: number
  to: number
  node: VNode
}

export type ReconcileResult = {
  mounts: MountOp[]
  updates: UpdateOp[]
  unmounts: UnmountOp[]
  moves: MoveOp[]
}

function shallowEqualProps(
  first: Record<string, unknown>,
  second: Record<string, unknown>,
): boolean {
  const firstKeys = Object.keys(first)
  const secondKeys = Object.keys(second)

  if (firstKeys.length !== secondKeys.length) {
    return false
  }

  return firstKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(second, key) &&
      Object.is(first[key], second[key]),
  )
}

export function reconcileChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
): ReconcileResult {
  const result: ReconcileResult = {
    mounts: [],
    updates: [],
    unmounts: [],
    moves: [],
  }

  const oldIndexByKey = new Map<string, number>()
  oldChildren.forEach((child, index) => {
    if (!oldIndexByKey.has(child.key)) {
      oldIndexByKey.set(child.key, index)
    }
  })

  const matchedKeys = new Set<string>()
  const matched: Array<{ node: VNode; index: number; oldIndex: number }> = []

  newChildren.forEach((node, index) => {
    const oldIndex = oldIndexByKey.get(node.key)
    const oldNode = oldIndex === undefined ? undefined : oldChildren[oldIndex]

    if (oldIndex !== undefined && oldNode && oldNode.type === node.type) {
      matchedKeys.add(node.key)
      matched.push({ node, index, oldIndex })

      if (!shallowEqualProps(oldNode.props, node.props)) {
        result.updates.push({
          type: 'update',
          key: node.key,
          index,
          node,
          prev: oldNode,
        })
      }
    } else {
      result.mounts.push({ type: 'mount', key: node.key, index, node })
    }
  })

  // move：当前匹配节点前面存在旧下标更大的匹配节点，说明相对顺序被打乱。
  // 这些节点在 commit 阶段需要重新插入。保持相对顺序的节点（例如只发生了
  // 删除后的补位）不会被标记。
  for (let index = 0; index < matched.length; index += 1) {
    const current = matched[index]
    const hasEarlierSiblingFromLaterPosition = matched
      .slice(0, index)
      .some((previous) => previous.oldIndex > current.oldIndex)

    if (hasEarlierSiblingFromLaterPosition) {
      result.moves.push({
        type: 'move',
        key: current.node.key,
        from: current.oldIndex,
        to: current.index,
        node: current.node,
      })
    }
  }

  oldChildren.forEach((child) => {
    if (!matchedKeys.has(child.key)) {
      result.unmounts.push({ type: 'unmount', key: child.key })
    }
  })

  return result
}
