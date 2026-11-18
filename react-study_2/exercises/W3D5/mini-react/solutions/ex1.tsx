// 练习 1 参考答案：createElement 与元素模型

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
