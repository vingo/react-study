// 练习 1：修复「+3」只加 1 的 bug（10 分钟）
// 要求：点击一次「+3」后，分数从 0 变成 3。
// 提示：同一个事件处理函数里的 score 是固定快照。

import { useState } from 'react'

export default function ScoreBoard() {
  const [score, setScore] = useState(0)
  function addThree() {
    setScore((prevScore => prevScore + 3))
  }

  return <button onClick={addThree}>分数：{score}（+3）</button>
}
