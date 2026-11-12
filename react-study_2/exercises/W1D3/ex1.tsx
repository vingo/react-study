// 练习 1：去掉不必要的 Effect（10 分钟）
// 修改 firstName 或 lastName 后，立即显示新 fullName。
// 不要为 fullName 使用 useState 或 useEffect。

import { useEffect, useState } from 'react'

export default function NameForm() {
  const [firstName, setFirstName] = useState('Ada')
  const [lastName, setLastName] = useState('Lovelace')
  // const [fullName, setFullName] = useState('')

  // useEffect(() => {
  //   setFullName(`${firstName} ${lastName}`)
  // }, [firstName, lastName])

  return <section aria-label="姓名表单">
    <label>名<input value={firstName} onChange={e => setFirstName(e.target.value)} /></label>
    <label>姓<input value={lastName} onChange={e => setLastName(e.target.value)} /></label>
    <p>全名：{firstName} {lastName}</p>
  </section>
}
