// 练习 3：模拟 RSC payload，保留 children 槽（20 分钟）
//
// 背景（语义模型，不是 Next.js 的真实 wire format）：
// Server Component 在服务端先把 UI 渲染成可序列化的输出；Client Component
// 在 payload 中只留下一个占位：组件名、对应 chunk 的引用、可序列化的 props，
// 以及由服务端创建的 children 槽（同样是已经渲染好的输出）。
//
// 这正是“Client 组件通过 children 接收 Server 内容”的底层形态：
//
//   { kind: 'client', name: 'Modal', chunk: '...', children: [server output] }
//
// Server Component 的代码不会因为被放进 children 就进入客户端 bundle；它已经
// 在服务端执行完，跨边界的是渲染结果。
//
// 本题的输入树是简化模型：
// - text：一段文本；
// - element：Server Component 渲染后的宿主元素（不是组件函数）；
// - client：Client Component 占位。name 必须在 clientModules 注册表里，
//   注册表把组件名映射到 chunk 路径。
//
// 目标：完成 serializeRscPayload(node, clientModules)：
// - text 输出 { kind: 'text', text }；
// - element 输出 { kind: 'element', tag, children }，children 递归序列化，
//   缺省时一律输出空数组；
// - client 输出 { kind: 'client', name, chunk, props, children }，props 缺省
//   为 {}，children 缺省为空数组；children 仍然要递归序列化，所以里面可以
//   继续出现 Server 输出或其他 Client 占位；
// - 未注册的 Client Component 抛错，错误信息包含组件名；
// - 返回的对象必须能被 JSON.stringify / JSON.parse 无损往返（测试只使用
//   普通 JSON 值，不要传 NaN/Infinity）。为保持玩具格式简单，本题 props 只
//   允许 JSON 标量、数组和普通对象；真实 RSC 还支持 Date、Map、Set、Promise
//   等类型，不在本题的 JSON 子集里。
//
// 测试依赖：serializeRscPayload 与导出的类型。不要修改测试断言。

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
  | { kind: 'element'; tag: string; children: SerializedNode[],   props?: Record<string, SerializableValue> }
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

  const children = (node.children ?? []).map(child => {
    return serializeRscPayload(child, clientModules)
  })
  
  if (node.kind === 'element') {
    return {
      kind: 'element',
      tag: node.tag,
      children,
    }
  }
  const chunk = clientModules[node.name]
  if(!chunk) {
    throw Error('Unknow Client Component:'+ node.name)
  }


  // BUG：Client 组件被当成了普通宿主元素。
  // - 没有查 clientModules，也没有输出 chunk 引用；
  // - props 被整个丢掉；
  // - 这会让客户端拿不到组件代码，也无法恢复组件 props。
  // 但仍然递归了 children，所以“Server 内容放进 Client 子树”这一半是通的。
  const props = {...(node.props ? node.props : {})}
  return {
    kind: 'client',
    name: node.name,
    chunk,
    children,
    props,
  }
}
