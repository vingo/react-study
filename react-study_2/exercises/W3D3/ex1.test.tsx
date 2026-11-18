import { fireEvent, render, screen } from '@testing-library/react'
import SalesDashboard, {
  getReportProfilerCommits,
  getReportRenderCount,
  getReportRenderLog,
  getSummaryComputationCount,
  resetPerformanceLogs,
} from './ex1'

beforeEach(() => {
  resetPerformanceLogs()
})

test('首次挂载渲染一次报表，并完成一次聚合', () => {
  render(<SalesDashboard />)

  expect(getReportRenderCount()).toBe(1)
  expect(getReportProfilerCommits()).toBe(1)
  expect(getSummaryComputationCount()).toBe(1)

  expect(screen.getByLabelText('区域业绩报表')).toHaveAttribute(
    'data-region',
    '华东',
  )
  expect(screen.getByLabelText('区域汇总')).toHaveTextContent(
    '共 2 条，合计 ¥2000',
  )
})

test('无关的备注输入不再重渲染报表，也不重复聚合', () => {
  render(<SalesDashboard />)
  resetPerformanceLogs()

  const note = screen.getByLabelText('备注')
  fireEvent.change(note, { target: { value: 'a' } })
  fireEvent.change(note, { target: { value: 'ab' } })

  // 备注本身立即更新，说明父组件确实在响应输入。
  expect(note).toHaveValue('ab')
  expect(screen.getByText('备注预览：ab')).toBeInTheDocument()

  // 但报表既没有 render，也没有 commit，更没有重新聚合。
  expect(getReportRenderCount()).toBe(0)
  expect(getReportProfilerCommits()).toBe(0)
  expect(getSummaryComputationCount()).toBe(0)
  expect(getReportRenderLog()).toEqual([])
})

test('切换区域仍然重新聚合，并刷新报表 DOM', () => {
  render(<SalesDashboard />)
  resetPerformanceLogs()

  fireEvent.change(screen.getByLabelText('区域'), {
    target: { value: '华南' },
  })

  expect(getReportRenderCount()).toBe(1)
  expect(getReportProfilerCommits()).toBe(1)
  expect(getSummaryComputationCount()).toBe(1)

  const report = screen.getByLabelText('区域业绩报表')
  expect(report).toHaveAttribute('data-region', '华南')
  expect(screen.getByLabelText('区域汇总')).toHaveTextContent(
    '共 2 条，合计 ¥2200',
  )
  expect(getReportRenderLog().at(-1)).toMatchObject({
    region: '华南',
    total: 2200,
  })
})

test('切换密度只重渲染报表，不重复聚合同一区域的数据', () => {
  render(<SalesDashboard />)
  resetPerformanceLogs()

  fireEvent.click(screen.getByLabelText('紧凑模式'))

  expect(getReportRenderCount()).toBe(1)
  expect(getReportProfilerCommits()).toBe(1)
  expect(getSummaryComputationCount()).toBe(0)

  const report = screen.getByLabelText('区域业绩报表')
  expect(report).toHaveAttribute('data-density', 'comfortable')
  expect(screen.getByLabelText('区域汇总')).toHaveTextContent(
    '共 2 条，合计 ¥2000',
  )
})

test('选择行会更新选中状态，但不重复聚合', () => {
  render(<SalesDashboard />)
  resetPerformanceLogs()

  fireEvent.click(screen.getByRole('button', { name: '选择 陈晨' }))

  expect(getReportRenderCount()).toBe(1)
  expect(getReportProfilerCommits()).toBe(1)
  expect(getSummaryComputationCount()).toBe(0)

  expect(screen.getByText('当前选中：r-1')).toBeInTheDocument()
  const row = screen
    .getByRole('button', { name: '选择 陈晨' })
    .closest('li')
  expect(row).toHaveAttribute('data-selected', 'true')
})
