// 原代码的 bug：Field 定义在 ProfileForm 内部，每次渲染都是一个新的函数，
// React 认为同一位置的组件类型变了，于是卸载旧 input、挂载新 input，已输入的内容丢失。
// 修复：把 Field 移到模块顶层。紧凑模式只是再加一个独立的 state。

import { useState } from 'react'

function Field({ label }: { label: string }) {
  return (
    <label>
      {label}
      <input />
    </label>
  )
}

export default function ProfileForm() {
  const [dark, setDark] = useState(false)
  const [compact, setCompact] = useState(false)

  const className = [dark ? 'dark' : 'light', compact && 'compact'].filter(Boolean).join(' ')

  return (
    <section className={className} aria-label="资料表单">
      <Field label="昵称" />
      <Field label="城市" />
      <button onClick={() => setDark((d) => !d)}>切换主题</button>
      <button aria-pressed={compact} onClick={() => setCompact((c) => !c)}>
        紧凑模式
      </button>
    </section>
  )
}
