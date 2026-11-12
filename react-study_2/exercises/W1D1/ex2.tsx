// 练习 2（补全实现，约 15 分钟）
// 任务：实现排行榜，按分数从高到低排列；分数相同时按名字字母序（a → z）。
// 要求：不能修改传入的 players（父组件还要用原始的报名顺序）。

export type Player = { name: string; score: number }

export default function Leaderboard({ players }: { players: Player[] }) {
  const ranked = players.toSorted((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score // 按分数从高到低排序
    } else {
      return a.name.localeCompare(b.name) // 分数相同时按名字字母序排序
    }
  })

  return (
    <ol>
      {ranked.map((p) => (
        <li key={p.name}>
          {p.name}: {p.score}
        </li>
      ))}
    </ol>
  )
}
