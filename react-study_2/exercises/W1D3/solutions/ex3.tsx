import { useEffect, useState } from 'react'

export default function Stopwatch() {
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  return <section aria-label="秒表">
    <p>秒数：{seconds}</p>
    <button onClick={() => setRunning(r => !r)}>{running ? '停止' : '开始'}</button>
  </section>
}
