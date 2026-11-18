// 练习 2 参考答案：render 与 Fiber 工作循环
//
// 实现要点：
// - 每次 render 新建一棵 WIP Fiber 树；root.alternate 指向上一次的 root。
// - 用 child / sibling / parent 链表做非递归工作循环（performUnitOfWork）。
// - 旧 fiber 按位置匹配（本题不要求 keyed diff，keyed diff 在练习 3）。
// - commit 阶段先删除旧节点，再更新 / 创建 DOM，并按新顺序 append 子节点。
// - useState 使用脚手架提供的简化版：状态按 root + 调用顺序保存。

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

export type MiniFiber = {
  type: string | ComponentType | 'ROOT' | null
  key: Key | null
  props: Record<string, unknown>
  dom: Node | null
  parent: MiniFiber | null
  child: MiniFiber | null
  sibling: MiniFiber | null
  alternate: MiniFiber | null
}

type RenderableChild = MiniElement | string | number

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

export type Dispatch<T> = (action: T | ((previous: T) => T)) => void

type RootState = {
  container: Element
  element: MiniNode
  hooks: unknown[]
  current: MiniFiber | null
}

const roots = new WeakMap<Element, RootState>()
let activeRoot: RootState | null = null
let hookIndex = 0

let deletions: MiniFiber[] = []
let nextUnitOfWork: MiniFiber | null = null

function getRootState(container: Element): RootState {
  let root = roots.get(container)

  if (!root) {
    root = {
      container,
      element: null,
      hooks: [],
      current: null,
    }
    roots.set(container, root)
  }

  return root
}

export function useState<T>(initial: T): [T, Dispatch<T>] {
  const root = activeRoot

  if (!root) {
    throw new Error('useState 只能在 render 期间调用')
  }

  const index = hookIndex
  hookIndex += 1

  if (!(index in root.hooks)) {
    root.hooks[index] = initial
  }

  const dispatch: Dispatch<T> = (action) => {
    const previous = root.hooks[index] as T
    root.hooks[index] =
      typeof action === 'function'
        ? (action as (previous: T) => T)(previous)
        : action

    render(root.element, root.container)
  }

  return [root.hooks[index] as T, dispatch]
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
  }

  if (typeof child.type === 'string') {
    fiber.dom = alternate?.dom ?? document.createElement(child.type)
  }

  return fiber
}

function sameType(fiber: MiniFiber, child: RenderableChild): boolean {
  if (typeof child === 'string' || typeof child === 'number') {
    return fiber.type === null
  }

  return fiber.type === child.type
}

// 练习 2 按位置匹配。keyed diff 是练习 3 的目标。
function reconcileChildren(
  parent: MiniFiber,
  children: MiniChild[],
  oldChild: MiniFiber | null,
): void {
  const nextChildren = flattenChildren(children)
  let oldFiber = oldChild
  let previous: MiniFiber | null = null

  for (const child of nextChildren) {
    const match = oldFiber && sameType(oldFiber, child) ? oldFiber : null
    const fiber = createFiber(child, parent, match)

    if (previous) {
      previous.sibling = fiber
    } else {
      parent.child = fiber
    }
    previous = fiber

    if (oldFiber) {
      if (!match) {
        deletions.push(oldFiber)
      }
      oldFiber = oldFiber.sibling
    }
  }

  while (oldFiber) {
    deletions.push(oldFiber)
    oldFiber = oldFiber.sibling
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
    const output = (fiber.type as ComponentType)(fiber.props)
    reconcileChildren(fiber, [output], fiber.alternate?.child ?? null)
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

  // 函数组件没有自己的 DOM，继续提交它的子节点。
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

  activeRoot = root
  hookIndex = 0
  deletions = []

  try {
    const wipRoot = createRootFiber(root, element)
    nextUnitOfWork = wipRoot

    while (nextUnitOfWork) {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    }

    commitRoot(wipRoot)
    root.current = wipRoot
  } finally {
    activeRoot = null
  }
}
