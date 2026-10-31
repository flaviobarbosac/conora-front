import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from './ui/Icon'
import styles from './InfoHint.module.css'

type Props = {
  /** Accessible name for the toggle and dialog. */
  label: string
  /** Optional shorter title attribute on the button. */
  title?: string
  children: ReactNode
}

/**
 * Standard Conora info affordance: circle-i opens a compact popover.
 * Place next to the section title (same pattern as Raio-X legend).
 */
export function InfoHint({ label, title, children }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        title={title ?? label}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <Icon name="info" size={20} />
      </button>
      {open ? (
        <div id={panelId} className={styles.popover} role="dialog" aria-label={label}>
          <div className={styles.body}>{children}</div>
        </div>
      ) : null}
    </div>
  )
}
