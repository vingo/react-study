import { type Ref, useRef } from 'react'

type FancyInputProps = {
  label: string
  ref?: Ref<HTMLInputElement>
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
