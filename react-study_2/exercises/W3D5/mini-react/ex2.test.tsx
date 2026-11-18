import { createElement, render, useState } from './ex2'

// 所有缺失 DOM 都先经过这个 helper，保证失败来自断言而不是 TypeError。
function query(parent: ParentNode, selector: string): Element {
  const element = parent.querySelector(selector)
  expect(element).not.toBeNull()
  return element as Element
}

function button(parent: ParentNode, selector = 'button'): HTMLButtonElement {
  return query(parent, selector) as HTMLButtonElement
}

test('挂载宿主元素树：标签、属性、文本与顺序', () => {
  const container = document.createElement('div')

  render(
    createElement(
      'section',
      { id: 'board', className: 'kanban' },
      createElement('h1', null, '任务看板'),
      createElement(
        'ul',
        { 'data-count': 2 },
        createElement('li', null, '设计'),
        createElement('li', null, '实现'),
      ),
      createElement('p', null, '共 ', 2, ' 项'),
    ),
    container,
  )

  const section = query(container, 'section')
  expect(section.getAttribute('id')).toBe('board')
  expect(section.getAttribute('class')).toBe('kanban')
  expect(query(container, 'h1').textContent).toBe('任务看板')
  expect(query(container, 'ul').getAttribute('data-count')).toBe('2')
  expect(
    [...container.querySelectorAll('li')].map((item) => item.textContent),
  ).toEqual(['设计', '实现'])
  expect(query(container, 'p').textContent).toBe('共 2 项')
})

test('函数组件被调用，返回值继续渲染', () => {
  function Badge(props: { label: string }) {
    return createElement('span', { className: 'badge' }, props.label)
  }

  function Header(props: { title: string }) {
    return createElement(
      'header',
      null,
      createElement('h1', null, props.title),
      createElement(Badge, { label: 'mini-react' }),
    )
  }

  const container = document.createElement('div')
  render(createElement(Header, { title: 'W3D5' }), container)

  expect(query(container, 'header')).not.toBeNull()
  expect(query(container, 'h1').textContent).toBe('W3D5')
  expect(query(container, '.badge').textContent).toBe('mini-react')
})

test('文本、数字、数组、布尔与 null 子节点按顺序渲染', () => {
  const container = document.createElement('div')

  render(
    createElement(
      'div',
      null,
      'a',
      0,
      false,
      null,
      true,
      undefined,
      ['b', [null, 2]],
    ),
    container,
  )

  expect(query(container, 'div').textContent).toBe('a0b2')
})

test('点击事件触发 useState 更新并重新渲染 DOM', () => {
  function Counter() {
    const [count, setCount] = useState(0)

    return createElement(
      'div',
      null,
      createElement('output', { 'aria-label': 'count' }, `count: ${count}`),
      createElement(
        'button',
        { onClick: () => setCount((value) => value + 1) },
        '加一',
      ),
    )
  }

  const container = document.createElement('div')
  render(createElement(Counter), container)

  expect(query(container, 'output').textContent).toBe('count: 0')

  button(container).click()
  expect(query(container, 'output').textContent).toBe('count: 1')

  button(container).click()
  expect(query(container, 'output').textContent).toBe('count: 2')
})

test('再次 render 更新文本 / 属性并替换事件监听', () => {
  const calls: string[] = []
  const container = document.createElement('div')

  render(
    createElement(
      'button',
      {
        className: 'old',
        title: '旧提示',
        onClick: () => calls.push('old'),
      },
      '第一版',
    ),
    container,
  )

  const first = button(container)
  expect(first.textContent).toBe('第一版')
  expect(first.getAttribute('class')).toBe('old')
  expect(first.getAttribute('title')).toBe('旧提示')
  first.click()
  expect(calls).toEqual(['old'])

  render(
    createElement(
      'button',
      {
        className: 'new',
        onClick: () => calls.push('new'),
      },
      '第二版',
    ),
    container,
  )

  expect(container.querySelectorAll('button')).toHaveLength(1)
  const second = button(container)
  expect(second.textContent).toBe('第二版')
  expect(second.getAttribute('class')).toBe('new')
  expect(second.getAttribute('title')).toBeNull()
  second.click()
  expect(calls).toEqual(['old', 'new'])
})

test('子节点删除、插入与重排后 DOM 顺序正确', () => {
  function List(props: { items: string[] }) {
    return createElement(
      'ul',
      null,
      ...props.items.map((item) => createElement('li', { key: item }, item)),
    )
  }

  const container = document.createElement('div')

  render(createElement(List, { items: ['a', 'b', 'c'] }), container)
  expect(
    [...container.querySelectorAll('li')].map((item) => item.textContent),
  ).toEqual(['a', 'b', 'c'])

  render(createElement(List, { items: ['c', 'a', 'd'] }), container)
  const items = [...container.querySelectorAll('li')]
  expect(items).toHaveLength(3)
  expect(items.map((item) => item.textContent)).toEqual(['c', 'a', 'd'])
})

test('条件渲染为 null 时移除对应 DOM，保留兄弟节点', () => {
  function Notice(props: { show: boolean }) {
    return createElement(
      'div',
      null,
      createElement('strong', null, '注意'),
      props.show
        ? createElement('p', { role: 'status' }, '已保存')
        : null,
    )
  }

  const container = document.createElement('div')

  render(createElement(Notice, { show: true }), container)
  expect(query(container, '[role="status"]').textContent).toBe('已保存')
  expect(query(container, 'strong').textContent).toBe('注意')

  render(createElement(Notice, { show: false }), container)
  expect(container.querySelector('[role="status"]')).toBeNull()
  expect(query(container, 'strong').textContent).toBe('注意')
  expect(query(container, 'div').children).toHaveLength(1)
})
