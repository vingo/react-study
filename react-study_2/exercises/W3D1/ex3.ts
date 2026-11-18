// 练习 3：用最小 Fiber / 双缓冲模型模拟一次渲染（20 分钟）
//
// 目标：理解 render 阶段与 commit 阶段的分工，以及 current / work-in-progress
// （WIP）两棵树的双缓冲关系。不要实现完整 mini-react，也不要做 DOM 操作；
// 这里只处理 Fiber 树和副作用列表。
//
// 已有脚手架：
// - createFiber 会为新的 VNode 树创建全新的 Fiber 树（所有 alternate 为 null）；
// - shallowEqualProps 用于判断 props 是否变化。
//
// 需要补全：
//
// 1. applyEffects(wip, current, effects)
//    把 WIP 节点和 current 树里“同 key 且同 type”的节点配对：
//    - 配对成功：wip.alternate = current；props 浅比较不同时记录 update；
//    - 配对失败 / current 为 null：记录 placement，wip.alternate 保持 null；
//    - 递归处理 children。旧 children 里没有配对的节点，记录 deletion。
//    注意：deletion 只记录被卸载子树的根，不逐个记录它的后代；
//    effects 的顺序是：节点自身的 placement/update，然后是它的子节点；
//    每一层的 deletion 在该层子节点处理完后追加（按旧 children 顺序）。
//    关键约束：整个过程只能写 wip，不能修改 current 的任何字段。
//
// 2. render(root, next)
//    创建 WIP，调用 applyEffects。如果根节点的 type/key 与 current 不同，
//    先为旧根记录 deletion，再按“没有 current”处理新根。
//    render 只返回 { wip, effects }，不改变 root.current。
//
// 3. commit(root, result)
//    把 root.current 指向 result.wip（真实 React 还会在这里做 DOM 变更、
//    执行 layout effect 等；本题只做指针切换）。
//
// 提示：children 的匹配规则和练习 2 一样：同层 + key + type。
// 旧 fiber 树在 render 期间应保持不变，这样即使渲染被中断/丢弃，
// 屏幕上的 current 树仍然是完整可用的——这就是双缓冲的意义。

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
  // TODO 1：设置 alternate、记录 placement/update，并递归 children。
  // 然后再按旧 children 顺序记录没有匹配上的 deletion。
  void wip
  void current
  void effects
}

export function render(root: Root, next: VNode): RenderResult {
  const wip = createFiber(next)
  const effects: RenderEffect[] = []

  // TODO 2：处理根节点的 type/key 失配，并调用 applyEffects。
  void root
  void shallowEqualProps

  return { wip, effects }
}

export function commit(root: Root, result: RenderResult): void {
  // TODO 3：切换 current 指针。
  void root
  void result
}
