import {
  serializeRscPayload,
  type ClientModuleRegistry,
  type RscNode,
} from './ex3'

test('Server 输出被序列化为纯数据，不包含组件代码或 Client 占位', () => {
  const tree: RscNode = {
    kind: 'element',
    tag: 'article',
    children: [
      { kind: 'text', text: '订单 #42' },
      {
        kind: 'element',
        tag: 'ul',
        children: [
          {
            kind: 'element',
            tag: 'li',
            children: [{ kind: 'text', text: '键盘' }],
          },
        ],
      },
      { kind: 'element', tag: 'hr' },
    ],
  }

  expect(serializeRscPayload(tree, {})).toEqual({
    kind: 'element',
    tag: 'article',
    children: [
      { kind: 'text', text: '订单 #42' },
      {
        kind: 'element',
        tag: 'ul',
        children: [
          {
            kind: 'element',
            tag: 'li',
            children: [{ kind: 'text', text: '键盘' }],
          },
        ],
      },
      { kind: 'element', tag: 'hr', children: [] },
    ],
  })
})

test('Client 占位保留组件引用、props 和 Server children 槽', () => {
  const tree: RscNode = {
    kind: 'client',
    name: 'Modal',
    props: { title: '购物车', count: 1 },
    children: [
      {
        kind: 'element',
        tag: 'p',
        children: [{ kind: 'text', text: '键盘 × 1' }],
      },
    ],
  }

  const clientModules: ClientModuleRegistry = {
    Modal: 'static/chunks/modal.js',
  }

  const payload = serializeRscPayload(tree, clientModules)

  expect(payload).toEqual({
    kind: 'client',
    name: 'Modal',
    chunk: 'static/chunks/modal.js',
    props: { title: '购物车', count: 1 },
    children: [
      {
        kind: 'element',
        tag: 'p',
        children: [{ kind: 'text', text: '键盘 × 1' }],
      },
    ],
  })
  expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
})

test('children 槽可以嵌套 Client 占位，Server 输出结构保持不变', () => {
  const tree: RscNode = {
    kind: 'element',
    tag: 'main',
    children: [
      {
        kind: 'client',
        name: 'Modal',
        props: { open: true },
        children: [
          {
            kind: 'element',
            tag: 'div',
            children: [
              {
                kind: 'client',
                name: 'CopyButton',
                props: { text: '复制' },
                children: [{ kind: 'text', text: '订单号 #42' }],
              },
            ],
          },
        ],
      },
    ],
  }

  const clientModules: ClientModuleRegistry = {
    Modal: 'chunks/modal.js',
    CopyButton: 'chunks/copy-button.js',
  }

  expect(serializeRscPayload(tree, clientModules)).toEqual({
    kind: 'element',
    tag: 'main',
    children: [
      {
        kind: 'client',
        name: 'Modal',
        chunk: 'chunks/modal.js',
        props: { open: true },
        children: [
          {
            kind: 'element',
            tag: 'div',
            children: [
              {
                kind: 'client',
                name: 'CopyButton',
                chunk: 'chunks/copy-button.js',
                props: { text: '复制' },
                children: [{ kind: 'text', text: '订单号 #42' }],
              },
            ],
          },
        ],
      },
    ],
  })
})

test('未注册的 Client Component 不能被静默当成宿主元素', () => {
  const tree: RscNode = {
    kind: 'client',
    name: 'SecretPanel',
    props: {},
    children: [],
  }

  expect(() =>
    serializeRscPayload(tree, { Modal: 'chunks/modal.js' }),
  ).toThrow(/SecretPanel/)
})
