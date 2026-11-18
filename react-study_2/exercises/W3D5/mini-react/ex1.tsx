// 练习 1：createElement 与元素模型（15 分钟）
//
// 目标：实现 createElement(type, props, ...children)，生成 mini-react 自己的
// 元素对象。它不是 DOM，也不是 React 元素；它只是对“想渲染什么”的纯数据描述。
//
// 元素形状（测试按这个契约断言）：
//   {
//     type: string | Function,   // 宿主标签名或函数组件
//     key: string | number | null,
//     props: { ...props, children: Array<Element | string | number> },
//   }
//
// 规则：
// 1. key 从 props 中取出，放进元素的 key 字段，props 中不再保留 key。
// 2. props 浅拷贝，不要修改调用方传入的对象。
// 3. children 规范化：
//    - 嵌套数组递归展平；
//    - null / undefined / true / false 丢弃（它们在 React 里不渲染）；
//    - string / number 保留，number 也保留为 number（渲染时再转文本）；
//    - 元素保留。
// 4. 如果调用时传了可变参数 children，用它们（并规范化），覆盖 props.children；
//    否则如果 props.children 存在，也按同样规则规范化；都没有就是 []。
//
// 提示：先写一个 normalizeChildren(children) 递归函数，再在 createElement 里
// 拷贝 props、取 key、设置 props.children。不要用 React.createElement。

export type Key = string | number

// 为了贴近 React 的“组件可以有自己的 props 类型”，这里用 any 简化。
// 真实实现会用泛型把 type 和 props 关联起来。
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
  // TODO：递归展平数组，丢弃 boolean / null / undefined。
  return children
}

export function createElement(
  type: string | ComponentType,
  props?: ElementProps | null,
  ...children: MiniChild[]
): MiniElement {
  // TODO：按文件开头的规则实现。
  // 当前实现把 key 留在 props 里，也没有展平 / 过滤 children，
  // 所以元素形状、key、children 相关断言都会失败。
  return {
    type,
    key: null,
    props: { ...(props ?? {}), children },
  }
}
