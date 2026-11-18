// W3D4 测试工具（不需要修改）
//
// 本练习环境没有安装 MSW，所以这里用一个轻量的 fetch mock 代替。
// 它的用法与 MSW 的 handler 很接近：按 HTTP method + URL pathname 匹配，
// 返回一个真实的 Response 对象；组件代码仍然调用全局 fetch，不需要为了
// 测试额外注入依赖。
//
// 与 MSW 的对应关系：
//   MSW:        http.get('/api/inbox', () => HttpResponse.json([...]))
//   这里:       server.on('GET', '/api/inbox', () => jsonResponse([...]))
//
// 到了 Kanban v2 会换成真正的 MSW，见 README 的说明。

export type MockRequest = {
  url: URL
  method: string
  body: string | null
  headers: Headers
  signal: AbortSignal | null
}

export type MockHandler = (
  request: MockRequest,
) => Response | Promise<Response>

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function textResponse(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/plain;charset=utf-8')
  }
  return new Response(body, { ...init, headers })
}

/** 可在测试中手动 resolve / reject 的 promise，用来精确控制请求时序。 */
export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const BASE_URL = 'http://localhost'

function isRequest(value: unknown): value is Request {
  return typeof Request !== 'undefined' && value instanceof Request
}

function stringifyBody(body: BodyInit | null | undefined): string | null {
  if (body == null) return null
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  return null
}

async function normalizeRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<MockRequest> {
  if (isRequest(input)) {
    const body =
      init?.body !== undefined
        ? stringifyBody(init.body)
        : await input.clone().text()

    return {
      url: new URL(input.url, BASE_URL),
      method: (init?.method ?? input.method).toUpperCase(),
      body: body === '' ? null : body,
      headers: new Headers(init?.headers ?? input.headers),
      signal: init?.signal ?? input.signal,
    }
  }

  const url =
    input instanceof URL ? input : new URL(input, BASE_URL)

  return {
    url,
    method: (init?.method ?? 'GET').toUpperCase(),
    body: stringifyBody(init?.body),
    headers: new Headers(init?.headers),
    signal: init?.signal ?? null,
  }
}

function normalizePath(path: string): string {
  return new URL(path, BASE_URL).pathname
}

/**
 * 安装 fetch mock。模块顶层调用一次即可：
 *
 *   const server = setupFetchMock()
 *   afterAll(() => server.restore())
 *   beforeEach(() => server.reset())
 *
 * - on(method, path, handler)：注册路由；handler 可以返回 Response，
 *   也可以返回 createDeferred<Response>().promise 来模拟慢请求；
 * - reset()：清空路由、请求记录和调用次数，保证用例之间隔离；
 * - restore()：把全局 fetch 换回原实现。
 *
 * 没有注册路由时返回 500 和明确的提示文本，避免测试静默地“什么都没发生”。
 */
export function setupFetchMock() {
  const originalFetch = globalThis.fetch
  const routes = new Map<string, MockHandler>()
  const requests: MockRequest[] = []

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = await normalizeRequest(input, init)
      requests.push(request)

      const key = `${request.method} ${request.url.pathname}`
      const handler = routes.get(key)

      if (!handler) {
        return textResponse(
          `未配置 fetch mock 路由：${key}`,
          { status: 500 },
        )
      }

      return await handler(request)
    },
  )

  globalThis.fetch = fetchMock as unknown as typeof fetch

  return {
    fetchMock,
    requests,
    on(method: string, path: string, handler: MockHandler) {
      routes.set(`${method.toUpperCase()} ${normalizePath(path)}`, handler)
      return this
    },
    reset() {
      routes.clear()
      requests.length = 0
      fetchMock.mockClear()
    },
    restore() {
      globalThis.fetch = originalFetch
    },
  }
}
