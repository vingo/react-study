import { render, screen } from '@testing-library/react'
import Leaderboard, { type Player } from './ex2'

const make = (): Player[] => [
  { name: 'carol', score: 80 },
  { name: 'alice', score: 95 },
  { name: 'bob', score: 80 },
  { name: 'dave', score: 60 },
]

test('按分数降序，同分按名字升序', () => {
  render(<Leaderboard players={make()} />)
  const rows = screen.getAllByRole('listitem').map((li) => li.textContent)
  expect(rows).toEqual(['alice: 95', 'bob: 80', 'carol: 80', 'dave: 60'])
})

test('不修改传入的 players（数组被冻结时也能正常渲染）', () => {
  const players = Object.freeze(make()) as Player[]
  expect(() => render(<Leaderboard players={players} />)).not.toThrow()
  expect(players.map((p) => p.name)).toEqual(['carol', 'alice', 'bob', 'dave'])
})
