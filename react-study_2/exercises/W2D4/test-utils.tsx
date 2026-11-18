// W2D4 测试工具（不需要修改）
//
// 每个测试都要新建一个 router：路由状态（location、loader 数据、history）
// 都挂在 router 实例上，复用 router 会让用例互相影响。
//
// renderRouter 用 createMemoryRouter 创建数据路由（支持 loader/action），
// 再用 RouterProvider 渲染。返回值里同时有 router 和 RTL 的 render 结果：
// - router.state.location 用来断言当前 URL；
// - router.navigate(-1) / router.navigate(1) 用来模拟浏览器后退/前进。
//
// 注意：loader 是异步的，首次渲染后要使用 findBy* / waitFor 等待路由数据就绪。

import { render } from '@testing-library/react'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'

// 最外层加一个 pathless 路由，只提供初始 hydration 的 fallback：
// 带 loader 的路由在首次渲染前要等数据，React Router 会先渲染 HydrateFallback，
// 否则会在开发环境打印 "No HydrateFallback element provided"。
const RouterRoot = () => <p role="status">加载中…</p>

export function renderRouter(
  routes: RouteObject[],
  initialEntries: string[] = ['/'],
) {
  const router = createMemoryRouter(
    [{ HydrateFallback: RouterRoot, children: routes }],
    { initialEntries },
  )
  const result = render(<RouterProvider router={router} />)
  return { router, ...result }
}

/** 当前 URL 的 pathname + search，例如 "/?status=done"。 */
export function currentUrl(router: ReturnType<typeof createMemoryRouter>): string {
  return `${router.state.location.pathname}${router.state.location.search}`
}
