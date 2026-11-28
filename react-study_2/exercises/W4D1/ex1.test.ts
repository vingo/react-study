import {
  classifyModules,
  type ModuleGraphReport,
  type ModuleNode,
} from './ex1'

test("client 边界只把客户端入口及其传递依赖划入客户端图", () => {
  const modules: ModuleNode[] = [
    {
      path: 'app/page.tsx',
      imports: ['app/cart.tsx', 'app/shell.tsx', 'lib/db.ts'],
    },
    { path: 'app/cart.tsx', imports: ['app/price.tsx'] },
    { path: 'app/price.tsx', imports: [] },
    {
      path: 'app/shell.tsx',
      useClient: true,
      imports: ['app/chart.tsx', 'app/loop-a.ts'],
    },
    {
      path: 'app/chart.tsx',
      imports: ['app/format.ts', 'app/loop-b.ts', 'app/tooltip.tsx'],
    },
    { path: 'app/loop-a.ts', imports: ['app/loop-b.ts'] },
    { path: 'app/loop-b.ts', imports: ['app/loop-a.ts'] },
    { path: 'app/tooltip.tsx', imports: ['app/format.ts'] },
    { path: 'app/format.ts', imports: [] },
    { path: 'lib/db.ts', serverOnly: true, imports: [] },
  ]

  const report: ModuleGraphReport = classifyModules(modules)

  expect(report.environments).toEqual({
    'app/page.tsx': 'server',
    'app/cart.tsx': 'server',
    'app/price.tsx': 'server',
    'app/shell.tsx': 'client',
    'app/chart.tsx': 'client',
    'app/loop-a.ts': 'client',
    'app/loop-b.ts': 'client',
    'app/tooltip.tsx': 'client',
    'app/format.ts': 'client',
    'lib/db.ts': 'server',
  })
  // page 自己 import 了 Server 端的 db，不是违规；
  // 它 import shell 也不会让自己变成 Client。
  expect(report.violations).toEqual([])
})

test('Server Component 读取 server-only 模块不产生违规', () => {
  const modules: ModuleNode[] = [
    {
      path: 'app/page.tsx',
      imports: ['app/order-list.tsx', 'lib/db.ts'],
    },
    { path: 'app/order-list.tsx', imports: ['lib/db.ts'] },
    { path: 'lib/db.ts', serverOnly: true, imports: [] },
  ]

  expect(classifyModules(modules)).toEqual({
    environments: {
      'app/page.tsx': 'server',
      'app/order-list.tsx': 'server',
      'lib/db.ts': 'server',
    },
    violations: [],
  })
})

test('客户端图任意深度 import server-only 都会报违规，且同一条边去重', () => {
  const modules: ModuleNode[] = [
    {
      path: 'app/page.tsx',
      imports: ['app/panel.tsx', 'lib/db.ts'],
    },
    {
      path: 'app/panel.tsx',
      useClient: true,
      imports: ['lib/helper.ts', 'lib/db.ts', 'lib/db.ts'],
    },
    { path: 'lib/helper.ts', imports: ['lib/db.ts'] },
    { path: 'lib/db.ts', serverOnly: true, imports: [] },
  ]

  const report = classifyModules(modules)

  expect(report.environments['app/page.tsx']).toBe('server')
  expect(report.environments['app/panel.tsx']).toBe('client')
  expect(report.environments['lib/helper.ts']).toBe('client')
  expect(report.violations).toEqual([
    { importer: 'app/panel.tsx', imported: 'lib/db.ts' },
    { importer: 'lib/helper.ts', imported: 'lib/db.ts' },
  ])
})
