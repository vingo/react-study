import { act, fireEvent, screen } from '@testing-library/react'
import { appRoutes } from './ex1'
import { currentUrl, renderRouter } from './test-utils'

function clickLink(name: string) {
  return act(async () => {
    fireEvent.click(screen.getByRole('link', { name }))
  })
}

test('布局头部与首页子路由同时渲染', async () => {
  renderRouter(appRoutes)

  expect(screen.getByRole('heading', { name: '任务中心' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: '所有任务' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '写文档' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '修 bug' })).toBeInTheDocument()
})

test('点击任务后保持布局，内容从列表切换到详情', async () => {
  const { router } = renderRouter(appRoutes)

  expect(await screen.findByRole('heading', { name: '所有任务' })).toBeInTheDocument()

  await clickLink('写文档')

  expect(await screen.findByRole('heading', { name: '写文档' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '任务中心' })).toBeInTheDocument()
  expect(screen.getByText('状态：未完成')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '所有任务' })).not.toBeInTheDocument()
  expect(currentUrl(router)).toBe('/tasks/t1')
})

test('NavLink 的 active 状态只标记当前页面', async () => {
  renderRouter(appRoutes)

  expect(await screen.findByRole('heading', { name: '所有任务' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '统计' })).not.toHaveAttribute('aria-current')

  await clickLink('统计')

  expect(await screen.findByRole('heading', { name: '任务统计' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '统计' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '首页' })).not.toHaveAttribute('aria-current')
})
