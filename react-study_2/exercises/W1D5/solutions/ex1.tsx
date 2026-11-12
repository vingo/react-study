import { type ReactNode, useState } from 'react'

type PanelProps = {
  title: string
  children: ReactNode
  isOpen: boolean
  onToggle: () => void
}

function Panel({ title, children, isOpen, onToggle }: PanelProps) {
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
  const [activeTitle, setActiveTitle] = useState<string | null>(null)
  const toggle = (title: string) => {
    setActiveTitle((active) => active === title ? null : title)
  }

  return (
    <>
      <Panel title="账户" isOpen={activeTitle === '账户'} onToggle={() => toggle('账户')}>
        账户设置内容
      </Panel>
      <Panel title="订单" isOpen={activeTitle === '订单'} onToggle={() => toggle('订单')}>
        订单记录内容
      </Panel>
    </>
  )
}
