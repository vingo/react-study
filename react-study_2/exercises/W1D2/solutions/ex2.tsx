import { useState } from 'react'

type Profile = { name: string; preferences: { theme: 'light' | 'dark' } }

export default function ThemeProfile() {
  const [profile, setProfile] = useState<Profile>({
    name: 'Ada',
    preferences: { theme: 'light' },
  })

  function enableDarkTheme() {
    setProfile((p) => ({
      ...p,
      preferences: { ...p.preferences, theme: 'dark' },
    }))
  }

  return (
    <section aria-label="个人资料">
      <p>主题：{profile.preferences.theme}</p>
      <button onClick={enableDarkTheme}>启用深色主题</button>
    </section>
  )
}
