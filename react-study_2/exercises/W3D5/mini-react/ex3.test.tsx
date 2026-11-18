import { createElement, render, useState } from './ex3'

// 所有缺失 DOM 都先经过这个 helper，保证失败来自断言而不是 TypeError。
function query(parent: ParentNode, selector: string): Element {
  const element = parent.querySelector(selector)
  expect(element).not.toBeNull()
  return element as Element
}

function button(parent: ParentNode, label: string): HTMLButtonElement {
  const found = [...parent.querySelectorAll('button')].find(
    (item) => item.textContent === label,
  )
  expect(found).not.toBeUndefined()
  return found as HTMLButtonElement
}

function changeInput(input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function valueOf(parent: ParentNode, selector: string): string {
  return (query(parent, selector) as HTMLInputElement).value
}

test('同位置更新文本与属性，删除旧属性', () => {
  const container = document.createElement('div')

  render(
    createElement('p', { className: 'old', title: '提示' }, '旧文本'),
    container,
  )
  expect(query(container, 'p').textContent).toBe('旧文本')
  expect(query(container, 'p').getAttribute('class')).toBe('old')

  render(createElement('p', { className: 'new' }, '新文本'), container)

  expect(container.querySelectorAll('p')).toHaveLength(1)
  expect(query(container, 'p').textContent).toBe('新文本')
  expect(query(container, 'p').getAttribute('class')).toBe('new')
  expect(query(container, 'p').getAttribute('title')).toBeNull()
})

test('useState 支持多个 hook、函数式更新与重渲染', () => {
  function Counter() {
    const [count, setCount] = useState(0)
    const [step, setStep] = useState(1)

    return createElement(
      'section',
      null,
      createElement('output', { 'aria-label': 'count' }, String(count)),
      createElement('output', { 'aria-label': 'step' }, String(step)),
      createElement(
        'button',
        { onClick: () => setCount((value) => value + step) },
        '加',
      ),
      createElement(
        'button',
        { onClick: () => setCount((value) => value - step) },
        '减',
      ),
      createElement(
        'button',
        { onClick: () => setStep((value) => value + 1) },
        '步长 +1',
      ),
    )
  }

  const container = document.createElement('div')
  render(createElement(Counter), container)

  expect(query(container, '[aria-label="count"]').textContent).toBe('0')
  expect(query(container, '[aria-label="step"]').textContent).toBe('1')

  button(container, '加').click()
  expect(query(container, '[aria-label="count"]').textContent).toBe('1')

  button(container, '加').click()
  expect(query(container, '[aria-label="count"]').textContent).toBe('2')

  button(container, '步长 +1').click()
  expect(query(container, '[aria-label="step"]').textContent).toBe('2')

  button(container, '加').click()
  expect(query(container, '[aria-label="count"]').textContent).toBe('4')

  button(container, '减').click()
  expect(query(container, '[aria-label="count"]').textContent).toBe('2')
})

test('受控输入框：onChange 更新 state，value 随重渲染更新', () => {
  function NameField() {
    const [name, setName] = useState('')

    return createElement(
      'div',
      null,
      createElement('input', {
        'aria-label': '名字',
        value: name,
        onChange: (event: Event) =>
          setName((event.target as HTMLInputElement).value),
      }),
      createElement('p', null, `你好，${name || '匿名'}`),
    )
  }

  const container = document.createElement('div')
  render(createElement(NameField), container)

  expect(query(container, 'p').textContent).toBe('你好，匿名')

  changeInput(query(container, 'input') as HTMLInputElement, 'Ada')
  expect(valueOf(container, 'input')).toBe('Ada')
  expect(query(container, 'p').textContent).toBe('你好，Ada')

  changeInput(
    query(container, 'input') as HTMLInputElement,
    'Ada Lovelace',
  )
  expect(valueOf(container, 'input')).toBe('Ada Lovelace')
  expect(query(container, 'p').textContent).toBe('你好，Ada Lovelace')
})

type Row = { id: string; label: string }

function RowItem(props: { row: Row }) {
  const [note, setNote] = useState('')

  return createElement(
    'li',
    { 'data-id': props.row.id },
    createElement('span', null, props.row.label),
    createElement('input', {
      'aria-label': `note-${props.row.id}`,
      value: note,
      onChange: (event: Event) =>
        setNote((event.target as HTMLInputElement).value),
    }),
  )
}

function RowList(props: { rows: Row[] }) {
  return createElement(
    'ul',
    null,
    ...props.rows.map((row) => createElement(RowItem, { key: row.id, row })),
  )
}

test('keyed 重排：state 与 DOM 节点跟着 key 移动', () => {
  const rows: Row[] = [
    { id: 'a', label: '任务 A' },
    { id: 'b', label: '任务 B' },
    { id: 'c', label: '任务 C' },
  ]
  const container = document.createElement('div')

  render(createElement(RowList, { rows }), container)

  const inputA = query(
    container,
    '[aria-label="note-a"]',
  ) as HTMLInputElement
  changeInput(inputA, 'A 的草稿')
  changeInput(
    query(container, '[aria-label="note-b"]') as HTMLInputElement,
    'B 的草稿',
  )

  render(createElement(RowList, { rows: [rows[2], rows[0], rows[1]] }), container)

  expect(
    [...container.querySelectorAll('li')].map((item) =>
      item.getAttribute('data-id'),
    ),
  ).toEqual(['c', 'a', 'b'])
  expect(valueOf(container, '[aria-label="note-a"]')).toBe('A 的草稿')
  expect(valueOf(container, '[aria-label="note-b"]')).toBe('B 的草稿')
  expect(valueOf(container, '[aria-label="note-c"]')).toBe('')
  // keyed diff 复用 DOM：输入框节点本身也应该移动到新位置。
  expect(query(container, '[aria-label="note-a"]')).toBe(inputA)
})

test('keyed 插入、删除与 props 更新：无关项的 state 不被顶替', () => {
  const rows: Row[] = [
    { id: 'a', label: '任务 A' },
    { id: 'b', label: '任务 B' },
    { id: 'c', label: '任务 C' },
  ]
  const container = document.createElement('div')

  render(createElement(RowList, { rows }), container)
  changeInput(
    query(container, '[aria-label="note-a"]') as HTMLInputElement,
    'A 的草稿',
  )
  changeInput(
    query(container, '[aria-label="note-b"]') as HTMLInputElement,
    'B 的草稿',
  )

  const nextRows: Row[] = [{ id: 'x', label: '任务 X' }, rows[0], rows[2]]
  render(createElement(RowList, { rows: nextRows }), container)

  expect(
    [...container.querySelectorAll('li')].map((item) =>
      item.getAttribute('data-id'),
    ),
  ).toEqual(['x', 'a', 'c'])
  expect(valueOf(container, '[aria-label="note-a"]')).toBe('A 的草稿')
  expect(valueOf(container, '[aria-label="note-x"]')).toBe('')
  expect(container.querySelector('[aria-label="note-b"]')).toBeNull()
  expect(valueOf(container, '[aria-label="note-c"]')).toBe('')

  const renamed: Row[] = nextRows.map((row) =>
    row.id === 'c' ? { ...row, label: '任务 C2' } : row,
  )
  render(createElement(RowList, { rows: renamed }), container)

  expect(query(container, '[data-id="c"] span').textContent).toBe('任务 C2')
  expect(valueOf(container, '[aria-label="note-a"]')).toBe('A 的草稿')
})

test('同一事件中两次 setState 都进入更新队列', () => {
  function Stepper() {
    const [count, setCount] = useState(0)

    return createElement(
      'div',
      null,
      createElement('output', { 'aria-label': 'count' }, String(count)),
      createElement(
        'button',
        {
          onClick: () => {
            setCount((value) => value + 1)
            setCount((value) => value + 1)
          },
        },
        '加二',
      ),
    )
  }

  const container = document.createElement('div')
  render(createElement(Stepper), container)

  expect(query(container, '[aria-label="count"]').textContent).toBe('0')
  button(container, '加二').click()
  expect(query(container, '[aria-label="count"]').textContent).toBe('2')
  button(container, '加二').click()
  expect(query(container, '[aria-label="count"]').textContent).toBe('4')
})
