// 练习 3：购物车批量加三件（20 分钟）
// 点击「再加 3 件」后，茶的数量应由 1 变为 4，合计也应同步为 4。
// 要求：不修改 cart 或其中的 item；total 不要单独用 state 保存。

import { useState } from 'react'

type Item = { id: string; name: string; quantity: number }

export default function Cart() {
  const [cart, setCart] = useState<Item[]>([
    { id: 'tea', name: '茶', quantity: 1 },
  ])

  function addThreeTeas() {
    const addOneTea = (items: Item[]) => items.map((item) =>
      item.id === 'tea' ? { ...item, quantity: item.quantity + 1 } : item,
    )
    setCart(addOneTea)
    setCart(addOneTea)
    setCart(addOneTea)
  }

  const total = cart.reduce((sum, item) => sum + item.quantity, 0)
  return (
    <section aria-label="购物车">
      <p>{cart[0].name}：{cart[0].quantity} 件</p>
      <p>合计：{total} 件</p>
      <button onClick={addThreeTeas}>再加 3 件</button>
    </section>
  )
}
