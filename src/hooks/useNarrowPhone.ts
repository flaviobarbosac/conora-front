import { useEffect, useState } from 'react'

const QUERY = '(max-width: 719px)'

/** True when the budget row uses the compact money column (same breakpoint as page.module.css). */
export function useNarrowPhone(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const onChange = () => setNarrow(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return narrow
}
