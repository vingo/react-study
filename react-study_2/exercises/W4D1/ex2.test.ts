import {
  validateClientProps,
  type ClientPropIssue,
} from './ex2'

test('允许标量、Date、数组、普通对象和重复引用，不产生错误', () => {
  const sharedAddress = { city: '上海', postalCode: '200000' }

  expect(
    validateClientProps({
      id: 'order-1',
      total: 0,
      bigTotal: 12n,
      paid: false,
      note: null,
      coupon: undefined,
      createdAt: new Date('2026-11-24T08:00:00.000Z'),
      items: [
        { sku: 'KB-1', qty: 2, tags: ['sale'] },
        { sku: 'MS-2', qty: 1, tags: [] },
      ],
      billing: sharedAddress,
      shipping: sharedAddress,
    }),
  ).toEqual([])
})

test('收集嵌套函数、Symbol 和类实例，并给出精确路径', () => {
  class Account {
    constructor(public readonly name: string) {}
  }

  const props = {
    createdAt: new Date('2026-11-24T08:00:00.000Z'),
    title: 'ok',
    onClick: () => undefined,
    meta: {
      label: '订单',
      symbol: Symbol('token'),
      account: new Account('Ada'),
    },
    items: [
      { name: 'ok' },
      { save: () => undefined },
      new Account('Bob'),
    ],
    lookup: new Map([['a', 1]]),
  }

  const expected: ClientPropIssue[] = [
    { path: '$.onClick', reason: 'function' },
    { path: '$.meta.symbol', reason: 'symbol' },
    { path: '$.meta.account', reason: 'class-instance' },
    { path: '$.items[1].save', reason: 'function' },
    { path: '$.items[2]', reason: 'class-instance' },
    { path: '$.lookup', reason: 'class-instance' },
  ]

  expect(validateClientProps(props)).toEqual(expected)
})

test('检测对象和数组中的循环引用，但在兄弟位置重复出现不算循环', () => {
  const self: Record<string, unknown> = { id: 1 }
  self.self = self

  const list: unknown[] = []
  list.push(list)

  const shared = { code: 'CNY' }

  expect(validateClientProps(self)).toEqual([
    { path: '$.self', reason: 'circular-reference' },
  ])
  expect(validateClientProps({ list })).toEqual([
    { path: '$.list[0]', reason: 'circular-reference' },
  ])
  expect(
    validateClientProps({ from: shared, to: shared, nested: [shared, shared] }),
  ).toEqual([])
})
