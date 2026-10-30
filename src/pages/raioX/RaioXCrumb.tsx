import { useEffect, useMemo, useRef, useState } from 'react'
import type { Category } from '../../api/finance'
import { categoryLabel } from '../../lib/categoryLabel'
import { isNativeApp } from '../../lib/platform'
import { formatClickCrumb } from './categoryCrumb'
import styles from './raioX.module.css'

/** Portrait ≤719px, or phone landscape (short height), or native shell. */
const PHONE_CHROME =
  '(max-width: 719px), (orientation: landscape) and (max-height: 500px)'

function usePhoneChrome(): boolean {
  const [phone, setPhone] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return isNativeApp() || window.matchMedia(PHONE_CHROME).matches
  })

  useEffect(() => {
    if (isNativeApp()) {
      setPhone(true)
      return
    }
    const media = window.matchMedia(PHONE_CHROME)
    const onChange = () => setPhone(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return phone
}

function pathNames(accountId: string, byId: Map<string, Category>): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  let current = byId.get(accountId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    names.unshift(categoryLabel(current))
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return names
}

function labelFor(names: string[], nav: HTMLElement): string {
  const style = getComputedStyle(nav)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return formatClickCrumb(names, () => true)
  }
  ctx.font = style.font
  const pad = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)
  const max = Math.max(0, nav.clientWidth - pad)
  return formatClickCrumb(names, (text) => ctx.measureText(text).width <= max + 0.5)
}

/** Phone trail of the clicked category path. Text changes only on click. Same in portrait and landscape. */
export function RaioXCrumb({
  accounts,
  selectedId,
}: {
  accounts: Category[]
  selectedId: string | null
}) {
  const phone = usePhoneChrome()
  const slotRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [stuck, setStuck] = useState(false)
  const [pinTop, setPinTop] = useState(0)
  const [label, setLabel] = useState('')
  const byId = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const names = useMemo(() => (selectedId ? pathNames(selectedId, byId) : []), [selectedId, byId])

  useEffect(() => {
    if (!phone) {
      return
    }
    let frame = 0
    const update = () => {
      const slot = slotRef.current
      const header = document.querySelector('header')
      if (!slot || !(header instanceof HTMLElement)) {
        return
      }
      const headerBottom = Math.round(header.getBoundingClientRect().bottom)
      const shouldStick = slot.getBoundingClientRect().top <= headerBottom + 1
      setPinTop((current) => (current === headerBottom ? current : headerBottom))
      setStuck((current) => (current === shouldStick ? current : shouldStick))
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    schedule()
    document.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [phone])

  useEffect(() => {
    if (!phone) {
      return
    }
    const nav = navRef.current
    if (!nav || names.length === 0) {
      setLabel('')
      return
    }
    const measure = () => {
      if (nav.clientWidth <= 0) {
        return
      }
      setLabel(labelFor(names, nav))
    }
    measure()
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [phone, names, stuck])

  if (!phone) {
    return null
  }

  return (
    <div ref={slotRef} className={styles.raioxCrumbSlot}>
      <nav
        ref={navRef}
        className={stuck ? styles.raioxCrumbFixed : styles.raioxCrumb}
        style={stuck ? { top: pinTop } : undefined}
        data-stuck={stuck ? 'true' : 'false'}
        aria-label="Caminho da categoria"
      >
        {label}
      </nav>
    </div>
  )
}
