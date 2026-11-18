// 参考答案 3：最小 Fiber 双缓冲 + 副作用列表
//
// render：
// - 从 next VNode 新建一整棵 WIP Fiber 树；
// - 把 WIP 与 current 按 key + type 配对，配对成功时写 wip.alternate，
//   props 有变化记 update；没配上记 placement；
// - 旧树中没有配对的子节点记 deletion（只记子树根）；
// - 只写 WIP，current 在 render 期间完全不被修改。
//
// commit：把 root.current 指向 WIP。真实 React 在这里还会执行 DOM 变更、
// ref 挂载、layout effect 等；本题只演示双缓冲的指针切换。

export type VNode = {
  type: string
  key: string
  props: Record<string, unknown>
  children?: VNode[]
}

export type FiberNode = {
  type: string
  key: string
  props: Record<string, unknown>
  children: FiberNode[]
  alternate: FiberNode | null
}

export type EffectTag = 'placement' | 'update' | 'deletion'

export type RenderEffect = {
  tag: EffectTag
  type: string
  key: string
}

export type Root = {
  current: FiberNode | null
}

export type RenderResult = {
  wip: FiberNode
  effects: RenderEffect[]
}

function createFiber(vnode: VNode): FiberNode {
  return {
    type: vnode.type,
    key: vnode.key,
    props: { ...vnode.props },
    children: (vnode.children ?? []).map((child) => createFiber(child)),
    alternate: null,
  }
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

function applyEffects(
  wip: FiberNode,
  current: FiberNode | null,
  effects: RenderEffect[],
): void {
  if (current) {
    wip.alternate = current

    if (!shallowEqualProps(wip.props, current.props)) {
      effects.push({ tag: 'update', type: wip.type, key: wip.key })
    }
  } else {
    wip.alternate = null
    effects.push({ tag: 'placement', type: wip.type, key: wip.key })
  }

  const oldChildren = current ? current.children : []
  const oldByKey = new Map(oldChildren.map((child) => [child.key, child]))
  const matchedKeys = new Set<string>()

  for (const child of wip.children) {
    const oldChild = oldByKey.get(child.key)

    if (oldChild && oldChild.type === child.type) {
      matchedKeys.add(child.key)
      applyEffects(child, oldChild, effects)
    } else {
      applyEffects(child, null, effects)
    }
  }

  for (const oldChild of oldChildren) {
    if (!matchedKeys.has(oldChild.key)) {
      effects.push({ tag: 'deletion', type: oldChild.type, key: oldChild.key })
    }
  }
}

export function render(root: Root, next: VNode): RenderResult {
  const wip = createFiber(next)
  const effects: RenderEffect[] = []

  let current = root.current

  if (current && (current.type !== wip.type || current.key !== wip.key)) {
    effects.push({ tag: 'deletion', type: current.type, key: current.key })
    current = null
  }

  applyEffects(wip, current, effects)

  return { wip, effects }
}

export function commit(root: Root, result: RenderResult): void {
  root.current = result.wip
}
