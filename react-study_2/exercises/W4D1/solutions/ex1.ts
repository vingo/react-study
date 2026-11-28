// 参考答案 1：客户端图的传递闭包 + server-only 越界检查
//
// 1. 每个 'use client' 模块都是客户端图入口；从入口做一次 BFS/DFS，
//    把所有可达模块标记为 client。
// 2. 没被客户端图到达的模块保持 server。Server Component import Client
//    Component 不会反向污染自己。
// 3. 最后遍历所有 client 模块的边，目标带 serverOnly 就记违规。用 Set 去重，
//    再按 importer/imported 排序，让输出稳定。
//
// 这只是二进制语义模型。真实 Next.js 中一个模块可以同时被服务端图和客户端图
// 使用，并分别编译；本练习用“是否被客户端入口到达”决定它的归属。

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
  const byPath = new Map<string, ModuleNode>()
  const environments: Record<string, ModuleEnvironment> = {}

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
}
