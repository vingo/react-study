// 练习 1：状态提升（15 分钟）
// 需求：账户和订单最多只能展开一个。
// 将状态移到最近公共父组件；Panel 只通过 props 显示状态、通过回调请求变更。

import { type ReactNode, useState } from 'react'

type PanelProps = { title: string; children: ReactNode; isOpen: boolean; onToggle: () => void }

function Panel({ title, children,isOpen, onToggle }: PanelProps) {
  return (
    <section aria-label={`${title}面板`}>
      <h2>{title}</h2>
      <button aria-expanded={isOpen} onClick={onToggle}>
        {isOpen ? `收起${title}` : `展开${title}`}
      </button>
      {isOpen && <p>{children}</p>}
    </section>
  )
}

export default function Accordion() {
  const [openType, setIsOpenPanelType] = useState<string | null>(null)
  const onToggle = (title: string) => {
    setIsOpenPanelType((active) => active === title ? null : title)
  }
  return (
    <>
      <Panel title="账户" isOpen={openType === '账户'} onToggle={() => { onToggle('账户')}}>账户设置内容</Panel>
      <Panel title="订单" isOpen={openType === '订单'} onToggle={() => { onToggle('订单')}}>订单记录内容</Panel>
    </>
  )
}
