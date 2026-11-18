import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { appRoutes } from './ex3'
import { currentUrl, renderRouter } from './test-utils'

function getTaskList(): HTMLElement {
  return screen.getByRole('list', { name: '任务列表' })
}

function getTaskTitles(): string[] {
  return within(getTaskList())
    .getAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent ?? '')
}

async function clickStatus(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

test('默认 URL 不筛选，显示全部任务', async () => {
  const { router } = renderRouter(appRoutes)

  expect(await screen.findByRole('heading', { name: '任务列表' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '进行中' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('textbox', { name: '搜索任务' })).toHaveValue('')
  expect(getTaskTitles()).toEqual(['写周报', '修复登录 bug', '评审 PR', '准备演示'])
  expect(currentUrl(router)).toBe('/')
})

test('点击状态按钮更新 URL，并让 loader 返回过滤后的列表', async () => {
  const { router } = renderRouter(appRoutes)
  expect(await screen.findByText('写周报')).toBeInTheDocument()

  await clickStatus('已完成')

  expect(currentUrl(router)).toBe('/?status=done')
  await waitFor(() => expect(getTaskTitles()).toEqual(['修复登录 bug', '评审 PR']))
  expect(screen.getByRole('button', { name: '已完成' })).toHaveAttribute('aria-pressed', 'true')

  await clickStatus('进行中')

  expect(currentUrl(router)).toBe('/?status=active')
  await waitFor(() => expect(getTaskTitles()).toEqual(['写周报', '准备演示']))
  expect(screen.getByRole('button', { name: '进行中' })).toHaveAttribute('aria-pressed', 'true')
})

test('直接以 ?status=done 打开时恢复筛选状态', async () => {
  const { router } = renderRouter(appRoutes, ['/?status=done'])

  expect(await screen.findByRole('list', { name: '任务列表' })).toBeInTheDocument()
  await waitFor(() => expect(getTaskTitles()).toEqual(['修复登录 bug', '评审 PR']))
  expect(screen.getByRole('button', { name: '已完成' })).toHaveAttribute('aria-pressed', 'true')
  expect(currentUrl(router)).toBe('/?status=done')
})

test('后退/前进时 URL 与列表一起恢复', async () => {
  const { router } = renderRouter(appRoutes)
  expect(await screen.findByText('写周报')).toBeInTheDocument()

  await clickStatus('已完成')
  await waitFor(() => expect(getTaskTitles()).toHaveLength(2))

  await act(async () => {
    await router.navigate(-1)
  })

  expect(currentUrl(router)).toBe('/')
  await waitFor(() => expect(getTaskTitles()).toHaveLength(4))
  expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true')

  await act(async () => {
    await router.navigate(1)
  })

  expect(currentUrl(router)).toBe('/?status=done')
  await waitFor(() => expect(getTaskTitles()).toEqual(['修复登录 bug', '评审 PR']))
})

test('搜索词写入 URL，并由 loader 按标题过滤', async () => {
  const { router } = renderRouter(appRoutes)
  expect(await screen.findByText('写周报')).toBeInTheDocument()

  const input = screen.getByRole('textbox', { name: '搜索任务' })
  await act(async () => {
    fireEvent.change(input, { target: { value: 'bug' } })
  })

  expect(currentUrl(router)).toBe('/?q=bug')
  await waitFor(() => expect(getTaskTitles()).toEqual(['修复登录 bug']))
  expect(input).toHaveValue('bug')
})

test('切回“全部”时删除 status 参数，URL 保持干净', async () => {
  const { router } = renderRouter(appRoutes)
  expect(await screen.findByText('写周报')).toBeInTheDocument()

  await clickStatus('已完成')
  expect(currentUrl(router)).toBe('/?status=done')
  await waitFor(() => expect(getTaskTitles()).toEqual(['修复登录 bug', '评审 PR']))

  await clickStatus('全部')
  expect(currentUrl(router)).toBe('/')
  await waitFor(() => expect(getTaskTitles()).toHaveLength(4))
})

test('清空搜索框时删除 q 参数', async () => {
  const { router } = renderRouter(appRoutes, ['/?q=bug'])
  expect(await screen.findByText('修复登录 bug')).toBeInTheDocument()

  const input = screen.getByRole('textbox', { name: '搜索任务' })
  expect(input).toHaveValue('bug')

  await act(async () => {
    fireEvent.change(input, { target: { value: '' } })
  })

  expect(currentUrl(router)).toBe('/')
  await waitFor(() => expect(getTaskTitles()).toHaveLength(4))
})
