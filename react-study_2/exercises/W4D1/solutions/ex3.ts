// 参考答案 3：RSC payload 语义模型
//
// Server 输出已经执行完成，跨边界的是纯数据；Client Component 只留占位。
// children 槽由 Server 端拥有并渲染，序列化时照样递归，因此 Client 子树里
// 可以嵌套 Server 输出，也可以继续嵌套另一个 Client 占位。
//
// 这是帮助理解边界的玩具格式，不是 React/Next.js 真实的 RSC wire format，
// 也不负责 Promise 流式分块、Server Function 引用等高级序列化类型。

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue }

export type RscNode =
  | { kind: 'text'; text: string }
  | { kind: 'element'; tag: string; children?: RscNode[] }
  | {
      kind: 'client'
      name: string
      props?: Record<string, SerializableValue>
      children?: RscNode[]
    }

export type SerializedNode =
  | { kind: 'text'; text: string }
  | { kind: 'element'; tag: string; children: SerializedNode[] }
  | {
      kind: 'client'
      name: string
      chunk: string
      props: Record<string, SerializableValue>
      children: SerializedNode[]
    }

export type ClientModuleRegistry = Record<string, string>

export function serializeRscPayload(
  node: RscNode,
  clientModules: ClientModuleRegistry,
): SerializedNode {
  if (node.kind === 'text') {
    return { kind: 'text', text: node.text }
  }

  const children = (node.children ?? []).map((child) =>
    serializeRscPayload(child, clientModules),
  )

  if (node.kind === 'element') {
    return { kind: 'element', tag: node.tag, children }
  }

  const chunk = clientModules[node.name]
  if (!chunk) {
    throw new Error(`Unknown Client Component: ${node.name}`)
  }

  return {
    kind: 'client',
    name: node.name,
    chunk,
    props: { ...(node.props ?? {}) },
    children,
  }
}
