import { createElement } from './ex1'

const onClick = () => {}

test('宿主元素：type、props、key 与 children 的形状', () => {
  const config = {
    key: 'save-btn',
    id: 'save',
    onClick,
    disabled: true,
  }
  const element = createElement('button', config, '保存')

  expect(element).toEqual({
    type: 'button',
    key: 'save-btn',
    props: {
      id: 'save',
      onClick,
      disabled: true,
      children: ['保存'],
    },
  })
  expect(element.props).not.toBe(config)
  expect(config).toHaveProperty('key', 'save-btn')
  expect(config).not.toHaveProperty('children')
})

test('函数组件类型被保留，key 从 props 中提取', () => {
  function Badge(props: { label: string }) {
    return createElement('span', null, props.label)
  }

  const icon = createElement('i', null, '!')
  const element = createElement(Badge, { key: 'badge', label: 'W3D5' }, [
    icon,
    false,
    'x',
  ])

  expect(element.type).toBe(Badge)
  expect(typeof element.type).toBe('function')
  expect(element.key).toBe('badge')
  expect(element.props).not.toHaveProperty('key')
  expect(element.props.children).toEqual([icon, 'x'])
})

test('children 递归展平，布尔 / null 被丢弃，数字保留', () => {
  const element = createElement(
    'ul',
    null,
    createElement('li', { key: 'a' }, 'A'),
    [createElement('li', { key: 'b' }, 'B'), [null, false, true, 'C']],
    undefined,
    0,
  )

  expect(element.key).toBeNull()
  expect(element.props.children).toHaveLength(4)
  expect(element.props.children[0]).toMatchObject({ type: 'li', key: 'a' })
  expect(element.props.children[1]).toMatchObject({ type: 'li', key: 'b' })
  expect(element.props.children[2]).toBe('C')
  expect(element.props.children[3]).toBe(0)
})

test('key 支持字符串与数字 0，props.children 也会被规范化', () => {
  const stringKey = createElement('li', { key: 'task-a', id: 'a' }, 'A')
  expect(stringKey.key).toBe('task-a')
  expect(stringKey.props).toEqual({ id: 'a', children: ['A'] })

  const zeroKey = createElement('li', { key: 0 }, 'Z')
  expect(zeroKey.key).toBe(0)
  expect(zeroKey.props).toEqual({ children: ['Z'] })

  const fromProps = createElement('div', {
    children: ['x', [false, 'y']],
  })
  expect(fromProps.props.children).toEqual(['x', 'y'])
})

test('可变参数 children 优先于 props.children，且不修改传入对象', () => {
  const config = { children: 'from-props', className: 'box' }
  const element = createElement('div', config, 'from-args', ['nested'])

  expect(element.props.children).toEqual(['from-args', 'nested'])
  expect(element.props.className).toBe('box')
  expect(config).toEqual({ children: 'from-props', className: 'box' })
})

test('没有 children 时 props.children 是空数组', () => {
  const element = createElement('hr', { key: 'divider' })

  expect(element.key).toBe('divider')
  expect(element.props).toEqual({ children: [] })
})
