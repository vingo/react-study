// 练习 3（小功能，约 20 分钟）
// 任务：在表单上增加"紧凑模式"按钮：开启后 section 额外带上 compact 类名，再点一次取消。
// 验收：在输入框里填写内容后，无论切换主题还是切换紧凑模式，已填写的内容都不能丢失。
// 提示：先运行测试，看看现有代码是否已经满足"内容不丢失"。

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


 let classNameList = [dark ? 'dark' : 'light', compact ? '  compact' : ''].join(' ')
  return (
    <section className={classNameList} aria-label="资料表单">
      <Field label="昵称" />
      <Field label="城市" />
      <button onClick={() => setDark((d) => !d)}>切换主题</button>
      <button onClick={() => setCompact((c) => !c)}>紧凑模式</button>
    </section>
  )
}
