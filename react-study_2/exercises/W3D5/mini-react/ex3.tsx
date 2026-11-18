// 练习 3：协调（keyed diff）+ useState（20 分钟）
//
// 这个文件已经有一个可运行的 mini-react 骨架：
// - createElement / 元素模型（同练习 1）；
// - Fiber 工作循环、函数组件、宿主节点、文本、props、事件；
// - commit 阶段会按新 fiber 的顺序重排 DOM，并删除旧节点。
//
// 还差两个目标：
//
// A. 把 reconcileChildren 从“全量重建”升级为同层 keyed diff。
//    要求：同层 + 相同 key + 相同 type 才复用 fiber；
//    - 复用 fiber 时保留 oldFiber.dom（DOM 节点不重建）和 hook 状态；
//    - 更新 props / 文本；
//    - 新 key 插入、旧 key 删除；
//    - 重排时 DOM 节点跟随 key 移动；
//    - key 相同但 type 变化时，卸载旧的、挂载新的（state 重置）。
//    当前占位实现会删除所有旧 fiber、创建所有新 fiber，所以首屏能显示，
//    但更新时 state 会丢、DOM 节点会重建、keyed 重排不保留项的身份。
//
// B. 实现 useState 的 hook 链表 / dispatch / 重渲染。
//    脚手架已负责：
//    - 在函数组件渲染前把 currentRenderingFiber 指向该 fiber；
//    - 把 fiber.alternate.hooks 浅拷贝到新 fiber；
//    - 每次组件开始渲染时把 hookIndex 归零。
//    你需要：
//    - 按 hookIndex 从 fiber.hooks 取 / 建 hook；
//    - 处理 hook.queue 里的更新（函数式更新读取上一步 state）；
//    - dispatch 把更新入队，并调用 scheduleRerender(fiber)。
//    当前实现永远返回 initial，dispatch 是空函数，所以点击不会更新。
//
// 不要 import React；测试用原生 DOM，不会出现 act 警告。

export type Key = string | number

export type ComponentType<P = any> = (props: P) => MiniNode

export type MiniChild =
  | MiniElement
  | string
  | number
  | boolean
  | null
  | undefined
  | MiniChild[]

export type MiniNode = MiniChild

export type MiniElement = {
  type: string | ComponentType
  key: Key | null
  props: Record<string, unknown> & { children: MiniChild[] }
}

export type ElementProps = Record<string, unknown> & {
  key?: Key | null
  children?: MiniChild
}

export type Dispatch<T> = (action: T | ((previous: T) => T)) => void

type RenderableChild = MiniElement | string | number

type Hook = {
  state: unknown
  queue: Array<unknown | ((previous: unknown) => unknown)>
}

type MiniFiber = {
  type: string | ComponentType | 'ROOT' | null
  key: Key | null
  props: Record<string, unknown>
  dom: Node | null
  parent: MiniFiber | null
  child: MiniFiber | null
  sibling: MiniFiber | null
  alternate: MiniFiber | null
  hooks: Hook[]
  root: RootState | null
}

type RootState = {
  container: Element
  element: MiniNode
  current: MiniFiber | null
  pending: boolean
}

const roots = new WeakMap<Element, RootState>()

let currentRenderingFiber: MiniFiber | null = null
let hookIndex = 0
let deletions: MiniFiber[] = []
let nextUnitOfWork: MiniFiber | null = null
let isRendering = false

function normalizeChildren(children: MiniChild[]): MiniChild[] {
  const normalized: MiniChild[] = []

  for (const child of children) {
    if (child === null || child === undefined || typeof child === 'boolean') {
      continue
    }

    if (Array.isArray(child)) {
      normalized.push(...normalizeChildren(child))
    } else {
      normalized.push(child)
    }
  }

  return normalized
}

export function createElement(
  type: string | ComponentType,
  props?: ElementProps | null,
  ...children: MiniChild[]
): MiniElement {
  const config = props ?? {}
  const { key = null, ...rest } = config

  const normalizedChildren =
    children.length > 0
      ? normalizeChildren(children)
      : config.children !== undefined
        ? normalizeChildren([config.children])
        : []

  return {
    type,
    key: key ?? null,
    props: {
      ...rest,
      children: normalizedChildren,
    },
  }
}

export function useState<T>(initial: T): [T, Dispatch<T>] {
  // TODO：按 fiber 实现 hook 链表。
  // 1. currentRenderingFiber 是当前正在渲染的函数组件 fiber。
  // 2. hookIndex 是本次渲染中第几个 useState。
  // 3. 从 fiber.hooks[hookIndex] 取 hook；没有就用 { state: initial, queue: [] }。
  // 4. 依次执行 hook.queue 里的更新（函数式更新读取上一步 state），然后清空 queue。
  // 5. dispatch 把更新放进 queue，并调用 scheduleRerender(fiber)。
  // 当前实现永远返回 initial，dispatch 什么也不做，所以点击不会更新 DOM。
  void currentRenderingFiber
  void hookIndex
  return [initial, () => {}]
}

function getRootState(container: Element): RootState {
  let root = roots.get(container)

  if (!root) {
    root = {
      container,
      element: null,
      current: null,
      pending: false,
    }
    roots.set(container, root)
  }

  return root
}

function scheduleRerender(fiber: MiniFiber): void {
  const root = fiber.root

  if (!root) {
    return
  }

  if (isRendering) {
    root.pending = true
    return
  }

  render(root.element, root.container)
}

function renderComponent(fiber: MiniFiber): MiniNode {
  fiber.hooks = fiber.alternate ? fiber.alternate.hooks.slice() : []

  const previousFiber = currentRenderingFiber
  currentRenderingFiber = fiber
  hookIndex = 0

  try {
    return (fiber.type as ComponentType)(fiber.props)
  } finally {
    currentRenderingFiber = previousFiber
    hookIndex = 0
  }
}

function flattenChildren(children: MiniChild[]): RenderableChild[] {
  const flattened: RenderableChild[] = []

  for (const child of children) {
    if (child === null || child === undefined || typeof child === 'boolean') {
      continue
    }

    if (Array.isArray(child)) {
      flattened.push(...flattenChildren(child))
    } else {
      flattened.push(child)
    }
  }

  return flattened
}

function createRootFiber(root: RootState, element: MiniNode): MiniFiber {
  return {
    type: 'ROOT',
    key: null,
    props: { children: [element] },
    dom: root.container,
    parent: null,
    child: null,
    sibling: null,
    alternate: root.current,
    hooks: [],
    root,
  }
}

function createFiber(
  child: RenderableChild,
  parent: MiniFiber,
  alternate: MiniFiber | null,
): MiniFiber {
  if (typeof child === 'string' || typeof child === 'number') {
    const text = String(child)

    return {
      type: null,
      key: null,
      props: { nodeValue: text },
      dom: alternate?.dom ?? document.createTextNode(text),
      parent,
      child: null,
      sibling: null,
      alternate,
      hooks: [],
      root: parent.root,
    }
  }

  const fiber: MiniFiber = {
    type: child.type,
    key: child.key,
    props: child.props,
    dom: null,
    parent,
    child: null,
    sibling: null,
    alternate,
    hooks: [],
    root: parent.root,
  }

  if (typeof child.type === 'string') {
    fiber.dom = alternate?.dom ?? document.createElement(child.type)
  }

  return fiber
}

function reconcileChildren(
  parent: MiniFiber,
  children: MiniChild[],
  oldChild: MiniFiber | null,
): void {
  // TODO：实现同层 keyed diff。
  //
  // 当前是“全量重建”的占位实现：每个新 child 都创建全新的 fiber
  // （alternate = null），所有旧 child 都记为删除。这样首次挂载能工作，但更新时：
  // - DOM 节点全部重建；
  // - 函数组件的 hook state 无法保留；
  // - keyed 重排 / 插入 / 删除时 state 不会跟着 key 走。
  //
  // 需要改成 React 的风格：
  // 1. 建立旧 children 的索引（key -> oldFiber），无 key 的按位置；
  // 2. 新 child 用 key + type 匹配旧 fiber；匹配成功时让新 fiber.alternate = oldFiber，
  //    复用 oldFiber.dom；函数组件的 hooks 会在 renderComponent 中从 alternate 拷贝；
  // 3. key 相同但 type 不同、或 key 不同，旧节点进 deletions，新节点重建；
  // 4. 未被匹配的旧节点进 deletions；
  // 5. 新 fiber 仍按新顺序用 sibling 串起来。commit 阶段会按这个顺序重排 DOM。
  //
  // 提示：文本节点没有 key，按位置匹配；元素用 key（key 为 null 时按位置）。
  // 可用 Map<Key, MiniFiber> + Set<MiniFiber> 记录已匹配的旧节点。
  let oldFiber = oldChild

  while (oldFiber) {
    deletions.push(oldFiber)
    oldFiber = oldFiber.sibling
  }

  let previous: MiniFiber | null = null

  for (const child of flattenChildren(children)) {
    const fiber = createFiber(child, parent, null)

    if (previous) {
      previous.sibling = fiber
    } else {
      parent.child = fiber
    }
    previous = fiber
  }
}

function performUnitOfWork(fiber: MiniFiber): MiniFiber | null {
  if (fiber.type === 'ROOT') {
    reconcileChildren(
      fiber,
      fiber.props.children as MiniChild[],
      fiber.alternate?.child ?? null,
    )
  } else if (typeof fiber.type === 'function') {
    const output = renderComponent(fiber)
    reconcileChildren(
      fiber,
      [output],
      fiber.alternate?.child ?? null,
    )
  } else if (typeof fiber.type === 'string') {
    reconcileChildren(
      fiber,
      fiber.props.children as MiniChild[],
      fiber.alternate?.child ?? null,
    )
  }

  if (fiber.child) {
    return fiber.child
  }

  let next: MiniFiber | null = fiber

  while (next) {
    if (next.sibling) {
      return next.sibling
    }
    next = next.parent
  }

  return null
}

function getHostDom(fiber: MiniFiber): Node | null {
  if (fiber.dom) {
    return fiber.dom
  }

  let child = fiber.child

  while (child) {
    const dom = getHostDom(child)
    if (dom) {
      return dom
    }
    child = child.sibling
  }

  return null
}

function isEventProp(key: string): boolean {
  return /^on[A-Z]/.test(key)
}

function eventName(key: string): string {
  return key.slice(2).toLowerCase()
}

function attributeName(key: string): string {
  if (key === 'className') {
    return 'class'
  }
  if (key === 'htmlFor') {
    return 'for'
  }
  return key
}

function updateDom(
  dom: Element,
  previousProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): void {
  for (const key of Object.keys(previousProps)) {
    if (key === 'children') {
      continue
    }

    if (isEventProp(key)) {
      if (!(key in nextProps)) {
        dom.removeEventListener(
          eventName(key),
          previousProps[key] as EventListener,
        )
      }
      continue
    }

    if (!(key in nextProps)) {
      if (key === 'value') {
        ;(dom as HTMLInputElement).value = ''
      } else if (key === 'checked') {
        ;(dom as HTMLInputElement).checked = false
      } else if (key === 'style') {
        const style = previousProps.style as
          | Record<string, string>
          | undefined

        if (style) {
          for (const property of Object.keys(style)) {
            ;(dom as HTMLElement).style[property as any] = ''
          }
        }
      } else {
        dom.removeAttribute(attributeName(key))
      }
    }
  }

  for (const key of Object.keys(nextProps)) {
    if (key === 'children') {
      continue
    }

    const value = nextProps[key]
    const previousValue = previousProps[key]

    if (isEventProp(key)) {
      if (previousValue !== value) {
        if (typeof previousValue === 'function') {
          dom.removeEventListener(
            eventName(key),
            previousValue as EventListener,
          )
        }
        if (typeof value === 'function') {
          dom.addEventListener(eventName(key), value as EventListener)
        }
      }
      continue
    }

    if (key === 'value') {
      const nextValue =
        value === null || value === undefined ? '' : String(value)

      if ((dom as HTMLInputElement).value !== nextValue) {
        ;(dom as HTMLInputElement).value = nextValue
      }
      continue
    }

    if (key === 'checked') {
      ;(dom as HTMLInputElement).checked = Boolean(value)
      continue
    }

    if (key === 'style') {
      const nextStyle = (value ?? {}) as Record<string, string>
      const previousStyle = (previousValue ?? {}) as Record<string, string>

      for (const property of Object.keys(previousStyle)) {
        if (!(property in nextStyle)) {
          ;(dom as HTMLElement).style[property as any] = ''
        }
      }

      for (const property of Object.keys(nextStyle)) {
        ;(dom as HTMLElement).style[property as any] = String(
          nextStyle[property],
        )
      }
      continue
    }

    if (value === false || value === null || value === undefined) {
      dom.removeAttribute(attributeName(key))
    } else if (value === true) {
      dom.setAttribute(attributeName(key), '')
    } else {
      dom.setAttribute(attributeName(key), String(value))
    }
  }
}

function commitChildren(fiber: MiniFiber, parentDom: Element): void {
  let child = fiber.child

  while (child) {
    commitFiber(child)

    const dom = getHostDom(child)
    if (dom) {
      parentDom.appendChild(dom)
    }

    child = child.sibling
  }
}

function commitFiber(fiber: MiniFiber): void {
  if (fiber.type === 'ROOT') {
    commitChildren(fiber, fiber.dom as Element)
    return
  }

  if (fiber.type === null) {
    const dom = fiber.dom as Text

    if (
      fiber.alternate &&
      fiber.alternate.props.nodeValue !== fiber.props.nodeValue
    ) {
      dom.nodeValue = String(fiber.props.nodeValue)
    }
    return
  }

  if (typeof fiber.type === 'string') {
    updateDom(
      fiber.dom as Element,
      fiber.alternate?.props ?? {},
      fiber.props,
    )
    commitChildren(fiber, fiber.dom as Element)
    return
  }

  if (fiber.child) {
    commitFiber(fiber.child)
  }
}

function commitRoot(wipRoot: MiniFiber): void {
  for (const fiber of deletions) {
    const dom = getHostDom(fiber)
    dom?.parentNode?.removeChild(dom)
  }
  deletions = []

  commitFiber(wipRoot)
}

export function render(element: MiniNode, container: Element): void {
  const root = getRootState(container)
  root.element = element

  if (isRendering) {
    root.pending = true
    return
  }

  isRendering = true

  try {
    deletions = []
    const wipRoot = createRootFiber(root, element)
    nextUnitOfWork = wipRoot

    while (nextUnitOfWork) {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    }

    commitRoot(wipRoot)
    root.current = wipRoot
  } finally {
    isRendering = false
  }

  if (root.pending) {
    root.pending = false
    render(root.element, root.container)
  }
}
