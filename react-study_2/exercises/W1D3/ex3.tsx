// 练习 3：Effect 建立的定时器使用最新 state（20 分钟）
// 点击开始后每秒 +1，停止后不再增加；卸载时也清除定时器。
// TODO：实现 interval Effect。不要把 count 放到依赖中，也不要遗漏 cleanup。

import { useState, useEffect } from 'react'

export default function Stopwatch() {
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    let interval: number
    if (running) { // 只在 running 为 true 时建立定时器
      interval = setInterval(() => setSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(interval) // 清理定时器
  }, [running]) // 依赖 running，确保在停止时清理定时器

  return <section aria-label="秒表">
    <p>秒数：{seconds}</p>
    <button onClick={() => setRunning(r => !r)}>{running ? '停止' : '开始'}</button>
  </section>
}
