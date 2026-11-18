import { fireEvent, render, screen } from '@testing-library/react'
import InventoryDashboard, {
  getFilterComputationCount,
  getStatsComputationCount,
  getTableRenderCount,
  resetDashboardCounters,
} from './ex3'

beforeEach(() => {
  resetDashboardCounters()
})

test('首次挂载统计正确，只聚合与过滤各一次', () => {
  render(<InventoryDashboard />)

  expect(getStatsComputationCount()).toBe(1)
  expect(getFilterComputationCount()).toBe(1)
  expect(getTableRenderCount()).toBe(1)

  const stats = screen.getByLabelText('库存统计')
  expect(stats).toHaveTextContent('总库存：49')
  expect(stats).toHaveTextContent('低库存：3')
  expect(stats).toHaveTextContent('总价值：¥15651')

  expect(screen.getAllByRole('row')).toHaveLength(6)
})

test('展开帮助这类无关状态不触发统计、过滤或表格渲染', () => {
  render(<InventoryDashboard />)
  resetDashboardCounters()

  fireEvent.click(screen.getByRole('button', { name: '帮助' }))

  expect(screen.getByRole('note')).toHaveTextContent(
    '低于阈值的商品需要补货。',
  )
  expect(getStatsComputationCount()).toBe(0)
  expect(getFilterComputationCount()).toBe(0)
  expect(getTableRenderCount()).toBe(0)

  expect(screen.getByLabelText('库存统计')).toHaveTextContent('总库存：49')
})

test('搜索只更新列表，不重新做库存统计', () => {
  render(<InventoryDashboard />)
  resetDashboardCounters()

  fireEvent.change(screen.getByLabelText('搜索库存'), {
    target: { value: '键盘' },
  })

  expect(getStatsComputationCount()).toBe(0)
  expect(getFilterComputationCount()).toBe(1)
  expect(getTableRenderCount()).toBe(1)

  const rows = screen.getAllByRole('row')
  expect(rows).toHaveLength(1)
  expect(rows[0]).toHaveTextContent('机械键盘')

  // 统计结果没有因为搜索而改变。
  expect(screen.getByLabelText('库存统计')).toHaveTextContent('总库存：49')
})

test('修改阈值只重算统计，不重新过滤、也不重渲染表格', () => {
  render(<InventoryDashboard />)
  resetDashboardCounters()

  fireEvent.change(screen.getByLabelText('低库存阈值'), {
    target: { value: '3' },
  })

  expect(getStatsComputationCount()).toBe(1)
  expect(getFilterComputationCount()).toBe(0)
  expect(getTableRenderCount()).toBe(0)

  const stats = screen.getByLabelText('库存统计')
  expect(stats).toHaveTextContent('总库存：49')
  expect(stats).toHaveTextContent('低库存：1')
  expect(stats).toHaveTextContent('总价值：¥15651')
})

test('选择行更新表格，但不重算统计或重新过滤', () => {
  render(<InventoryDashboard />)
  resetDashboardCounters()

  fireEvent.click(screen.getByRole('button', { name: '选择 显示器' }))

  expect(getStatsComputationCount()).toBe(0)
  expect(getFilterComputationCount()).toBe(0)
  expect(getTableRenderCount()).toBe(1)

  expect(screen.getByText('当前选中：i-2')).toBeInTheDocument()
  const row = screen
    .getByRole('button', { name: '选择 显示器' })
    .closest('tr')
  expect(row).toHaveAttribute('data-selected', 'true')
})

test('添加商品会同时更新统计与列表', () => {
  render(<InventoryDashboard />)
  resetDashboardCounters()

  fireEvent.click(screen.getByRole('button', { name: '添加商品' }))

  expect(getStatsComputationCount()).toBe(1)
  expect(getFilterComputationCount()).toBe(1)
  expect(getTableRenderCount()).toBe(1)

  const stats = screen.getByLabelText('库存统计')
  expect(stats).toHaveTextContent('总库存：51')
  expect(stats).toHaveTextContent('低库存：4')
  expect(stats).toHaveTextContent('总价值：¥15851')

  expect(screen.getAllByRole('row')).toHaveLength(7)
  expect(screen.getByText('新增商品 7')).toBeInTheDocument()
})
