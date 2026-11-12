// 练习 2：React 19 中透传 ref prop（15 分钟）
// 不要使用 forwardRef。实现 FancyInput，让父组件的 ref 指向内部 input。

import { useRef } from 'react'

type FancyInputProps = {
  label: string
  ref: React.Ref<HTMLInputElement>
}

function FancyInput({ label, ref }: FancyInputProps) {
  return <label>
    {label}
    <input ref={ref} />
  </label>
}

export default function ProfileEditor() {
  const nameRef = useRef<HTMLInputElement>(null)
  return <section aria-label="个人资料">
    <FancyInput label="昵称" ref={nameRef} />
    <button onClick={() => nameRef.current?.focus()}>编辑昵称</button>
  </section>
}
