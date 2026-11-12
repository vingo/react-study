// 练习 2：不可变地更新嵌套 state（15 分钟）
// 点击后把主题改为 dark。不要直接修改 profile 或 profile.preferences。

import { useState } from 'react'

type Profile = { name: string; preferences: { theme: 'light' | 'dark' } }

export default function ThemeProfile() {
  const [profile, setProfile] = useState<Profile>({
    name: 'Ada',
    preferences: { theme: 'light' },
  })

  function enableDarkTheme(profile: Profile) {
    setProfile({
      ...profile,
      preferences: { ...profile.preferences, theme: 'dark' }
    })
  }

  return (
    <section aria-label="个人资料">
      <p>主题：{profile.preferences.theme}</p>
      <button onClick={() => enableDarkTheme(profile)}>启用深色主题</button>
    </section>
  )
}
