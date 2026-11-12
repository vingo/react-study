// 练习 3：受控输入与提交后命令式重置（20 分钟）
// 实现：输入文字后“发送”可用；点击发送会把内容显示为“已发送：xxx”、清空输入框并把焦点放回输入框。
// text 影响 UI，必须用 state；聚焦 DOM 时才使用 ref。

import { useState, useRef } from 'react'

export default function ChatComposer() {
  const [text, setText] = useState('')
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit() {
    if (text.trim()) {
      setSentMessage(text)
      setText('')
      inputRef.current?.focus()
    }
  }

  return <section aria-label="聊天输入">
     <label>
      消息
    <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} />
    </label>
    <button onClick={handleSubmit} disabled={!text.trim()}>发送</button>
    {sentMessage !== null && <p>已发送：{sentMessage}</p>}
  </section>
}
