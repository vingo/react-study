// 练习 2：render 与 Fiber 工作循环（15 分钟）
//
// 目标：实现 render(element, container)。把练习 1 的元素树变成真实 DOM：
// - 宿主标签（'div'、'button' 等）→ document.createElement；
// - 文本 / 数字 → Text 节点；
// - 函数组件 → 调用它，把返回值当作它的子节点继续渲染；
// - props → DOM 属性；onClick 等事件 → addEventListener；
// - 子节点按数组顺序挂载。
//
// 建议用 Fiber 链表：
//   fiber = { type, key, props, dom, parent, child, sibling, alternate }
// 从根 fiber 开始，沿着 child / sibling 指针用 while 循环遍历（工作循环），
// 构建 WIP（work-in-progress）树；然后提交：创建 / 更新 DOM、删除旧节点。
// 再次 render 同一个 container 时，尽量复用上一次的 fiber 和 DOM。
//
// 本题的 useState 是脚手架提供的简化版（按 root 记录 hook 顺序），
// 只为让“点击 → setState → 重新 render → DOM 更新”这条链路可验证；
// 练习 3 会按 fiber 实现完整的 hook 链表和 keyed diff。
//
// 不要 import React；测试用原生 DOM，不会出现 act 警告。

import { findByAltText } from "@testing-library/dom"
import { Children } from "react"

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

// 脚手架给出 Fiber 的形状，方便你按“链表 + 工作循环”的思路实现。
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
type RenderableChild = MiniElement | string | number

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
      current: null
    }
    roots.set(container, root)
  }

  return root
}

// 简化版 useState：状态按 root + 调用顺序保存，够本题的计数器使用。
// 练习 3 会把它换成按 fiber 保存的完整 hook 链表。
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

    // 简化版：同步重新 render 同一个 root 的 element。
    render(root.element, root.container)
  }

  return [root.hooks[index] as T, dispatch]
}

export function render(element: MiniNode, container: Element): void {
  const root = getRootState(container)
  root.element = element

  activeRoot = root
  hookIndex = 0
  deletions = []


  try {
    // TODO：实现 Fiber 工作循环。
    // 1. 以 root 为起点建立 WIP fiber 树（root.dom = container）。
    // 2. 用 child / sibling 指针做非递归遍历（推荐），或者先递归实现也可以；
    //    本题验收只看 DOM 行为。
    // 3. 提交阶段把宿主 DOM 挂到 container，更新 / 删除旧节点。
    // 4. 第二次 render 同一个 container 应能更新，而不是重复挂载一份。
    //
    // 当前没有任何 DOM 操作，所以所有用例都会在 DOM 断言处失败。
    const wipRoot = creatRooFilber(root, element)
    nextUnitOfWork = wipRoot
    while(nextUnitOfWork) {
      nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    }
    commitRoot(wipRoot)
    root.current = wipRoot
  } finally {
    activeRoot = null
  }
}
/**
 * 创建rootFiber
 * @param root 
 * @param element 
 * @returns 
 */
export function creatRooFilber(root: RootState, element: MiniNode): MiniFiber {
  return {
    type:'ROOT',
    key: null,
    props: { children: [element]},
    dom: root.container,
    parent: null,
    child: null,
    sibling: null,
    alternate: root.current
  }
}
/**
 * 
 * @param fiber 
 * @returns 
 */
export function performUnitOfWork(fiber: MiniFiber): MiniFiber | null {
  if (fiber.type === 'ROOT') {
      reconcileChildren(
        fiber,
        fiber.props.children as MiniChild[],
        fiber.alternate?.child ?? null,
      )
    } else if(typeof fiber.type === 'function') {
    const output = (fiber.type as unknown as ComponentType)(fiber.props) 
    reconcileChildren(fiber,[output], fiber.alternate?.child ?? null)
  } else if (typeof fiber.type === 'string') {
    reconcileChildren(
      fiber,
      fiber.props.children as MiniChild[],
      fiber.alternate?.child ?? null)
  }
  if (fiber.child) {
    return fiber.child
  }
  let next: MiniFiber| null = fiber
  while(next) {
    if(next.sibling) {
      return next.sibling
    }
    next = next.parent
  }
  return null
}
/**
 * fiber/reconcile协调节点
 */
export function reconcileChildren(parent: MiniFiber, children: MiniChild[], oldChild: MiniFiber | null): void {
  const nextChildren = flattenChildren(children)
  let oldFiber = oldChild
  let previous: MiniFiber | null = null
  for (const child of nextChildren) {
    const match = oldFiber && sameType(oldFiber, child) ? oldFiber : null
    const fiber = createFiber(child, parent, match)
    if (previous) {
      (previous as MiniFiber).sibling = fiber
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
/**
 * 
 * @param children 
 * @returns 
 */
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
export function sameType(fiber: MiniFiber, child: RenderableChild): boolean {
  if(typeof child === 'string' || typeof child === 'number') {
    return fiber.type === null
  }
  return fiber.type === child.type
}
export function createFiber(child: RenderableChild, parent: MiniFiber, alternate: MiniFiber| null): MiniFiber {
  if (typeof child === 'string' || typeof child === 'number') {
    const text = String(child)
    return {
      type: null,
      key: null,
      props: { nodeValue: text},
      dom: alternate?.dom ?? document.createTextNode(text),
      parent,
      child: null,
      sibling:null,
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
    fiber.dom = alternate?.dom ?? document.createElement(child.type, )
  }
  return fiber
}

export function commitRoot(wipRoot: MiniFiber): void {
  for (const fiber of deletions) {
    const dom = getHostDom(fiber)
    dom?.parentNode?.removeChild(dom)
  }
  deletions = []
  commitFiber(wipRoot)
}

export function getHostDom(fiber: MiniFiber): Node | null {
  if (fiber.dom) { return fiber.dom }
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

export function commitFiber(fiber: MiniFiber): void {
  if (fiber.type === 'ROOT') {
    commitChildren(fiber, fiber.dom as Element)
    return
  }
  if (fiber.type === null) {
    const dom = fiber.dom as Text
    if (fiber.alternate && fiber.alternate.props.nodeValue !==fiber.props.nodeValue) {
      dom.nodeValue = String(fiber.props.nodeValue)
    }
    return
  }
  if (typeof fiber.type === 'string') {
    updateDom(fiber.dom as Element, fiber.alternate?.props ?? {}, fiber.props)
    commitChildren(fiber, fiber.dom as Element)
    return
  }
   // 函数组件没有自己的 DOM，继续提交它的子节点。
  if (fiber.child) {
    commitFiber(fiber.child)
  }
}

export function commitChildren(fiber: MiniFiber, parentDom: Element): void {
  let child = fiber.child
  while(child) {
    commitFiber(child)
    const dom = getHostDom(child)
    if (dom) {
      parentDom.appendChild(dom)
    }
    child = child.sibling
  }
}

export function updateDom(dom: Element, previousProps:Record<string, unknown>, nextProps: Record<string, unknown>): void {
  for (const key of Object.keys(previousProps)) {
    if (key === 'children') {
      continue;
    }
    if (isEventProp(key)) {
      if(!(key in nextProps)) {
        const event = eventName(key)
        dom.removeEventListener(event, previousProps[key] as EventListener)
      }
      continue;
    }
    if(!(key in nextProps)) { 
      if(key === 'value') {
        (dom as HTMLInputElement).value = ''
      } else if ( key === 'checked') {
        (dom as HTMLInputElement).checked = false
      } else if ( key === 'style') {
        const style = previousProps.style as Record<string, string> | undefined
        if (style) {
          for(const property of Object.keys(style)) {
              (dom as HTMLElement).style[property as any] = ''
          }
        }
      } else {
        dom.removeAttribute(attributeName(key))
      }
    }
  }

  for(const key of Object.keys(nextProps)) {
    if (key === 'children') {
      continue;
    }
    const value = nextProps[key]
    const previousValue = previousProps[key]
    if (isEventProp(key)) {
       if (previousValue !== value) {
        if (typeof previousValue === 'function') {
          dom.removeEventListener(eventName(key),previousValue as EventListener)
        }
        if (typeof value === 'function') {
          dom.addEventListener(eventName(key), value as EventListener)
        }
      }
      continue;
    }
    if (key === 'value') {
      const nextValue = value === null || value === undefined ? '' : String(value);
      if ((dom as HTMLInputElement).value != nextValue) {
        (dom as HTMLInputElement).value = nextValue
      }
      continue
    }
    if (key === 'checked') {
        (dom as HTMLInputElement).checked = Boolean(value)
      continue
    }
    if (key === 'style') {
      const nextStyle = (value ?? {}) as Record<string, string>
      const previousStyle = (previousValue ?? {}) as Record<string, string>
      for (const property of Object.keys(previousStyle)) {
        if(!(property in nextStyle)) {
          (dom as HTMLElement).style[property as any] = ''
        }
      }
      for (const property of Object.keys(nextStyle)) {
          (dom as HTMLElement).style[property as any] = nextStyle[property]
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
