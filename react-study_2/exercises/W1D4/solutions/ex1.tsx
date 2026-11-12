import { useRef } from 'react'

export default function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null)

  function focusSearch() {
    inputRef.current?.focus()
  }

  return <section aria-label="搜索">
    <input ref={inputRef} aria-label="关键词" placeholder="输入关键词" />
    <button onClick={focusSearch}>聚焦搜索框</button>
  </section>
}
