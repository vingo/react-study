// 练习 2：补全异步加载的四种状态与重试（15 分钟）
//
// 现状：只实现了 success。请求进行中、请求失败、列表为空都没有对应 UI，
// 失败后也没有重试入口。
//
// 要求：
// - loading：请求未完成时显示 <p role="status">加载中…</p>；
// - error：请求失败（非 2xx 或网络错误）时显示 <p role="alert">加载失败，请重试</p>
//   和“重试”按钮；点击后重新请求，并再次显示 loading；
// - empty：成功但数组为空时显示“收件箱为空”；
// - success：成功且非空时渲染消息列表；
// - 组件卸载或重试时，旧请求晚到不能覆盖新状态。
//
// 测试使用 fetch mock：GET /api/inbox 可以返回延迟响应、500、空数组或数据。
// 不要修改测试断言；不要用 sleep / setTimeout 等真实计时。
//
// 提示：
// - `response.ok` 为 false 时不要继续解析成功数据；
// - 重试最简单的做法是递增一个 attempt state，并把它放进 Effect 依赖；
// - 在 Effect 开头把状态重置为 loading，这样重试时用户能看见反馈；
// - 用 ignore 标记（或 AbortController）避免卸载/重试后的过期响应写回 state。

import { useEffect, useState } from 'react'

export type Message = {
  id: string
  title: string
}

export default function InboxPanel() {
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    let ignore = false

    fetch('/api/inbox')
      .then((response) => response.json())
      .then((data: Message[]) => {
        if (!ignore) setMessages(data)
      })
      .catch(() => {
        // TODO：失败状态
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <section aria-label="收件箱">
      {/* TODO：loading / error + 重试 / empty / success */}
      <ul aria-label="消息列表">
        {messages.map((message) => (
          <li key={message.id}>{message.title}</li>
        ))}
      </ul>
    </section>
  )
}
