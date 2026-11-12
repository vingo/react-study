import { useState } from 'react'

export default function NameForm() {
  const [firstName, setFirstName] = useState('Ada')
  const [lastName, setLastName] = useState('Lovelace')
  const fullName = `${firstName} ${lastName}`

  return <section aria-label="姓名表单">
    <label>名<input value={firstName} onChange={e => setFirstName(e.target.value)} /></label>
    <label>姓<input value={lastName} onChange={e => setLastName(e.target.value)} /></label>
    <p>全名：{fullName}</p>
  </section>
}
