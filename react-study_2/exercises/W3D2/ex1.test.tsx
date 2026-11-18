import { fireEvent, render, screen } from '@testing-library/react'
import ProductSearch, {
  filterProducts,
  getListRenderLog,
  resetListRenderLog,
} from './ex1'

beforeEach(() => {
  resetListRenderLog()
})

test('输入立即更新，列表先保留旧结果，随后更新为一致的最终结果', () => {
  render(<ProductSearch />)
  // 初始挂载的那次 render 不计入观察。
  resetListRenderLog()

  const input = screen.getByLabelText('搜索商品')
  expect(input).toHaveValue('')

  fireEvent.change(input, { target: { value: 'phone' } })

  // 1. 紧急输入立即更新，不等列表过滤。
  expect(input).toHaveValue('phone')

  // 2. 最终 DOM 一致：输入、列表查询值、列表内容三者对齐。
  const panel = screen.getByLabelText('商品列表')
  expect(panel).toHaveAttribute('data-list-query', 'phone')
  expect(panel).toHaveAttribute('data-stale', 'false')
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
    filterProducts('phone').map((product) => product.name),
  )

  // 3. 渲染记录证明列表经历了一个“新 query + 旧 listQuery”的过渡状态，
  //    即列表先保留旧结果，再在后台更新。不依赖任何真实计时。
  const log = getListRenderLog()
  const staleIndex = log.findIndex(
    (entry) => entry.query === 'phone' && entry.listQuery === '',
  )
  const freshIndex = log.findIndex(
    (entry) => entry.query === 'phone' && entry.listQuery === 'phone',
  )

  expect(staleIndex).toBeGreaterThanOrEqual(0)
  expect(freshIndex).toBeGreaterThan(staleIndex)
  expect(log[staleIndex].count).toBe(filterProducts('').length)
  expect(log[freshIndex].count).toBe(filterProducts('phone').length)
})

test('连续输入只提交与当前 query 一致的最终结果，不出现错位数据', () => {
  render(<ProductSearch />)
  resetListRenderLog()

  const input = screen.getByLabelText('搜索商品')
  fireEvent.change(input, { target: { value: 'lap' } })
  fireEvent.change(input, { target: { value: 'laptop 1' } })

  expect(input).toHaveValue('laptop 1')

  const panel = screen.getByLabelText('商品列表')
  expect(panel).toHaveAttribute('data-list-query', 'laptop 1')
  expect(panel).toHaveAttribute('data-stale', 'false')
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
    filterProducts('laptop 1').map((product) => product.name),
  )

  // 每一次 render 的 count 都必须对应当次实际使用的 listQuery，
  // 不允许出现“列表内容属于另一个查询”的中间结果。
  for (const entry of getListRenderLog()) {
    expect(entry.count).toBe(filterProducts(entry.listQuery).length)
  }
})
