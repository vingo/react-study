// 参考答案 2：loading / error / empty / success + 重试
//
// - attempt 作为 Effect 依赖，点击“重试”只是递增它；
// - Effect 一开始把状态设为 loading，重试时用户立刻看到反馈；
// - 非 2xx 与网络错误都进入 error；成功后再区分 empty / success；
// - ignore 标记避免重试或卸载后，旧响应覆盖新状态。

import { useEffect, useState } from 'react'

export type Message = {
  id: string
  title: string
}

type Status = 'loading' | 'error' | 'success'

export default function InboxPanel() {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<Status>('loading')
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    let ignore = false

    setStatus('loading')
    setMessages([])

    async function load() {
      try {
        const response = await fetch('/api/inbox')

        if (!response.ok) {
          throw new Error(`请求失败：${response.status}`)
        }

        const data = (await response.json()) as Message[]

        if (!ignore) {
          setMessages(data)
          setStatus('success')
        }
      } catch {
        if (!ignore) {
          setStatus('error')
        }
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [attempt])

  return (
    <section aria-label="收件箱">
      {status === 'loading' && <p role="status">加载中…</p>}

      {status === 'error' && (
        <>
          <p role="alert">加载失败，请重试</p>
          <button
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
          >
            重试
          </button>
        </>
      )}

      {status === 'success' && messages.length === 0 && (
        <p>收件箱为空</p>
      )}

      {status === 'success' && messages.length > 0 && (
        <ul aria-label="消息列表">
          {messages.map((message) => (
            <li key={message.id}>{message.title}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
