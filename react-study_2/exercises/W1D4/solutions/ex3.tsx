import { useRef, useState } from 'react'

export default function ChatComposer() {
  const [text, setText] = useState('')
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canSend = text.trim().length > 0

  function send() {
    if (!canSend) return
    setSentMessage(text)
    setText('')
    inputRef.current?.focus()
  }

  return <section aria-label="聊天输入">
    <label>
      消息
      <input
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </label>
    <button disabled={!canSend} onClick={send}>发送</button>
    {sentMessage !== null && <p>已发送：{sentMessage}</p>}
  </section>
}
