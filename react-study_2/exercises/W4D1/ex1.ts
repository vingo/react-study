// 练习 1：从模块图判断 Server / Client，并找出越界导入（15 分钟）
//
// 背景（语义模型，不是运行 Next.js）：
// - 在 App Router 里，页面和布局默认是 Server Component。
// - 文件顶部的 'use client' 是「模块图边界」：该模块以及它 import 的模块
//   都会进入客户端图，代码会被打进浏览器 bundle。
// - Server Component 可以 import 一个 Client Component；在服务端拿到的只是
//   一个 client reference，不会把 Client 组件当普通函数执行。
// - Client 模块图不能 import server-only 模块。真实 Next.js 会在构建期报错；
//   本练习用一个 isServerOnly 标记来模拟这条规则。
//
// 目标：
// 完成 classifyModules(modules)，返回：
// 1. environments：每个模块最终属于 'server' 还是 'client'。
//    - 有 useClient 标记的模块是客户端入口；
//    - 从客户端入口出发，沿 imports 递归可达的所有模块都是 client；
//    - 其余模块是 server。import 客户端组件的 Server Component 自己仍是 server。
// 2. violations：客户端图里的模块 import 了 isServerOnly 模块时，报一条
//    { importer, imported }。只报「客户端模块 -> server-only 模块」这条边；
//    Server Component 读取 server-only 模块是合法的。重复的同一 import 只报一次。
//
// 约定：
// - 模块 path 唯一；imports 里可以出现当前测试数据之外的路径，请忽略未知路径。
// - import 可能成环，分类不能死循环。
// - violations 按 importer、imported 的字典序排序，保证结果稳定。
//
// 测试依赖：export 的 classifyModules 和类型。不要修改测试断言。

export type ModuleNode = {
  path: string
  imports: string[]
  useClient?: boolean
  serverOnly?: boolean
}

export type ModuleEnvironment = 'server' | 'client'

export type ServerOnlyViolation = {
  importer: string
  imported: string
}

export type ModuleGraphReport = {
  environments: Record<string, ModuleEnvironment>
  violations: ServerOnlyViolation[]
}

export function classifyModules(modules: ModuleNode[]): ModuleGraphReport {
  const environments: Record<string, ModuleEnvironment> = {}

  for (const module of modules) {
    environments[module.path] = module.useClient ? 'client' : 'server'
  }
  const byPath = new Map<string, ModuleNode>()
  
  for (const module of modules) {
    byPath.set(module.path, module)
    environments[module.path] = 'server'
  }
  
    // 从所有客户端入口出发，标记传递依赖。
    const queue: string[] = []
    for (const module of modules) {
      if (module.useClient) {
        environments[module.path] = 'client'
        queue.push(module.path)
      }
    }
  
    for (let index = 0; index < queue.length; index += 1) {
      const current = byPath.get(queue[index])
      if (!current) continue
  
      for (const importedPath of current.imports) {
        if (!byPath.has(importedPath)) continue
        if (environments[importedPath] === 'client') continue
  
        environments[importedPath] = 'client'
        queue.push(importedPath)
      }
    }
  
    // 客户端图里任何一条指向 server-only 模块的边都是构建期违规。
    const seenEdges = new Set<string>()
    const violations: ServerOnlyViolation[] = []
  
    for (const [path, environment] of Object.entries(environments)) {
      if (environment !== 'client') continue
  
      const current = byPath.get(path)
      if (!current) continue
  
      for (const importedPath of current.imports) {
        const imported = byPath.get(importedPath)
        if (!imported?.serverOnly) continue
  
        const edge = `${path}\u0000${importedPath}`
        if (seenEdges.has(edge)) continue
        seenEdges.add(edge)
        violations.push({ importer: path, imported: importedPath })
      }
    }
  
    violations.sort((a, b) => {
      const byImporter = a.importer.localeCompare(b.importer)
      return byImporter !== 0 ? byImporter : a.imported.localeCompare(b.imported)
    })
  
    return { environments, violations }

  // BUG：只标记了直接写了 'use client' 的文件。
  // 它 import 的组件、工具函数，以及这些模块继续 import 的模块，都还没进入
  // 客户端图；同时也没有检查客户端图里的 server-only 导入。
  return { environments, violations: [] }
}
