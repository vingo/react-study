import { useState } from 'react'

export default function ScoreBoard() {
  const [score, setScore] = useState(0)

  function addThree() {
    setScore((s) => s + 1)
    setScore((s) => s + 1)
    setScore((s) => s + 1)
  }

  return <button onClick={addThree}>分数：{score}（+3）</button>
}
