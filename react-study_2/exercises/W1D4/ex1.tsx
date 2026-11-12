// 练习 1：让“聚焦搜索框”真正聚焦 input（10 分钟）
// TODO：创建正确类型的 DOM ref，挂到 input，并在点击时调用 focus。

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
