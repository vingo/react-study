// 练习 2：正确订阅和清理浏览器事件（15 分钟）
// 显示当前 window.innerWidth。窗口 resize 后更新；组件卸载后不得再保留监听器。
// TODO：实现 Effect，并在 cleanup 中移除监听器。

import { useState, useEffect } from 'react'

export default function WindowWidth() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth) // 更新宽度
    window.addEventListener('resize', handleResize) // 订阅 resize 事件
    handleResize() // 初始化宽度
    return () => window.removeEventListener('resize', handleResize) // 清理监听器
  }, [])

  return <p aria-live="polite">宽度：{width}</p>
}
