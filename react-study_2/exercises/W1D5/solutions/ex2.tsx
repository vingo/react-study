import { useState } from 'react'

type Contact = { id: string; name: string }
const contacts: Contact[] = [
  { id: 'ada', name: 'Ada' },
  { id: 'grace', name: 'Grace' },
]

function Chat({ recipient }: { recipient: Contact }) {
  const [draft, setDraft] = useState('')
  return (
    <section aria-label={`${recipient.name} 的聊天`}>
      <label>
        给 {recipient.name} 的消息
        <input value={draft} onChange={(event) => setDraft(event.target.value)} />
      </label>
    </section>
  )
}

export default function Messenger() {
  const [recipient, setRecipient] = useState(contacts[0])
  return (
    <section aria-label="信使">
      {contacts.map((contact) => (
        <button
          key={contact.id}
          aria-pressed={contact.id === recipient.id}
          onClick={() => setRecipient(contact)}
        >
          {contact.name}
        </button>
      ))}
      <Chat key={recipient.id} recipient={recipient} />
    </section>
  )
}
