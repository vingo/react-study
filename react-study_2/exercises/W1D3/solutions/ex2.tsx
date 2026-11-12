import { useEffect, useState } from 'react'

export default function WindowWidth() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return <p aria-live="polite">宽度：{width}</p>
}
