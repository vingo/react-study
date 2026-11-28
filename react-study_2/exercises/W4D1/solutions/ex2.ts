// 参考答案 2：递归校验 props 子集，并区分“循环”与“重复引用”
//
// 关键点：
// - 用 ancestors（当前递归栈）记录祖先对象，而不是用全局 visited：同一个对象
//   在兄弟位置出现两次是合法的共享引用，不是循环。
// - Date 虽然是 built-in 类实例，但本题把它列为允许的类型。
// - 普通对象只接受 Object.prototype 原型；Map/Set/Promise/类实例统一报
//   class-instance（本练习的简化归类，真实 RSC 支持 Map/Set/Promise）。
// - 每个问题都带路径，遇到错误后继续检查兄弟节点。

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

  visit(props, '$', new Set())
  return issues
}
