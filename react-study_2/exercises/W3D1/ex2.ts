// 练习 2：实现同层 keyed diff（15 分钟）
//
// 目标：把一组旧子节点和一组新子节点做“同层协调”，返回 commit 阶段需要的
// 操作。不要实现完整 React，只做这一个纯函数。
//
// 匹配规则（与 React 的协调一致）：
// 1. 只有 key 相同且 type 相同的节点才算同一个节点（复用/update）。
// 2. key 相同但 type 变化：旧节点卸载（unmount），新节点挂载（mount）。
// 3. key 变化：旧 key 卸载，新 key 挂载，即使 type 相同。
// 4. 匹配上的节点，如果 props 浅比较不相等，产生 update。
// 5. 匹配上的节点，如果在新顺序里，它前面出现了“旧下标更大”的兄弟节点，
//    说明相对顺序被打乱，需要 move。这是 React lastPlacedIndex 的简化版：
//    例如 [a,b,c] -> [c,a,b] 会标记 a、b 需要重新插入（C 保持原位也能得到
//    同样的最终顺序）。
//
// 返回值约定：
// - mounts / updates / moves 按新 children 的顺序排列；
// - unmounts 按旧 children 的顺序排列；
// - 每个新节点只出现在 mounts 或 updates 之一；同一个匹配节点可以同时有
//   update 和 move；
// - key 视为在本层唯一。
//
// 提示：先用 Map<key, oldIndex> 建索引，再按新顺序扫描；
// move 的判断只需看“已匹配且排在前面的节点”的最大旧下标是否大于当前旧下标。

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
  // TODO：按文件开头的规则实现同层 diff。
  // 当前空实现会让所有测试停留在“什么都没匹配上”的断言失败上。

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
