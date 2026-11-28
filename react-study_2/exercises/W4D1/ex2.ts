// 练习 2：校验 Server -> Client 的 props 是否可序列化（15 分钟）
//
// 背景（本练习只模拟真实 RSC 序列化能力的一个子集）：
// 从 Server Component 传给 Client Component 的 props 会被序列化进 RSC payload，
// 最终到达浏览器。真实 React 19 支持很多类型（Date、Map、Set、Promise、
// 全局 Symbol、JSX、Server Function 等）；本练习只允许：
// - string / number / boolean / bigint / null / undefined；
// - Date；
// - 由上述值组成的数组；
// - 普通对象：原型必须是 Object.prototype，属性值递归可序列化。
//
// 明确拒绝：
// - 普通函数（函数不能跨 Server -> Client 边界，'use server' 的引用不在本题范围）；
// - Symbol（包括 Symbol('x')；本题不模拟全局 Symbol）；
// - 类实例和其他非普通对象，例如 Map、Set、Promise、new User()；
// - 循环引用（同一个对象出现在自己的祖先链上）。
//
// 注意：同一个对象在两个兄弟位置重复出现不算循环，必须允许。
//
// 目标：完成 validateClientProps，返回所有问题的路径和原因；不要遇到第一个
// 错误就停止。路径格式：
// - 根：'$'
// - 对象属性：'$.user.name'（标识符用点；特殊键用 '$.a["b-c"]' 也可以，测试
//   只覆盖点表示法）
// - 数组下标：'$.items[0]'
// - 循环引用：在“指回祖先”的那个属性/下标位置报告。
//
// 测试依赖：validateClientProps 和 ClientPropIssue。不要修改测试断言。

export type ClientPropIssueReason =
  | 'function'
  | 'symbol'
  | 'class-instance'
  | 'circular-reference'

export type ClientPropIssue = {
  path: string
  reason: ClientPropIssueReason
}

function appendKey(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`
}

export function validateClientProps(props: unknown): ClientPropIssue[] {
  const issues: ClientPropIssue[] = []

  function visit(value: unknown, path: string, ancestors: Set<object>): void {
        if (typeof value === 'function') {
      issues.push({ path, reason: 'function' })
      return
    }

    if (typeof value === 'symbol') {
      issues.push({ path, reason: 'symbol' })
      return
    }
      // string / number / boolean / bigint / undefined / null 都能通过。
    if (value === null || typeof value !== 'object') {
      return
    }
    if (ancestors.has(value)) {
      issues.push({ path, reason: 'circular-reference' })
      return
    }
      // Date 是本练习明确允许的内建对象，不再向下遍历它的内部状态。
    if (value instanceof Date) {
      return
    }

    if (Array.isArray(value)) {
      ancestors.add(value)
      value.forEach((item, index) => {
        visit(item, `${path}[${index}]`, ancestors)
      })
      ancestors.delete(value)
      return
    }
      // 只接受对象字面量创建的普通对象；null 原型和类实例都不允许。
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      issues.push({ path, reason: 'class-instance' })
      return
    }
    
    ancestors.add(value)
    for (const [key, child] of Object.entries(value)) {
      visit(child, appendKey(path, key), ancestors)
    }
    ancestors.delete(value)
  }

  // BUG：只检查了根对象第一层的函数值。
  // - 嵌套对象 / 数组里的函数、Symbol、类实例都还没检查；
  // - 没有识别循环引用；
  // - 也没有对对象按原因分类。
  visit(props, '$', new Set())
  return issues
}
