// toSorted 返回新数组，不修改 players；也可以写成 [...players].sort(...)。
// 直接 players.sort(...) 会原地修改父组件的数据（冻结数组时还会直接报错）。

export type Player = { name: string; score: number }

export default function Leaderboard({ players }: { players: Player[] }) {
  const ranked = players.toSorted(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  )

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
