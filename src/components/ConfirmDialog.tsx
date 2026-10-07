import { useEffect, useId, useRef, useState } from 'react'
import { registerConfirmHandler, type ConfirmRequest } from '../lib/confirm'
import { Button } from './ui/Button'
import styles from './ConfirmDialog.module.css'

type Pending = ConfirmRequest & { resolve: (value: boolean) => void }

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null)
  const titleId = useId()
  const messageId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    registerConfirmHandler((request) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...request, resolve })
      }),
    )
    return () => registerConfirmHandler(null)
  }, [])

  useEffect(() => {
    if (!pending) {
      return
    }
    const previous = document.activeElement as HTMLElement | null
    confirmRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [pending])

  function close(value: boolean) {
    setPending((current) => {
      current?.resolve(value)
      return null
    })
  }

  if (!pending) {
    return null
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close(false)}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h2 id={titleId} className={styles.title}>
          {pending.title}
        </h2>
        <p id={messageId} className={styles.message}>
          {pending.message}
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => close(false)}>
            {pending.cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            className={pending.danger ? styles.danger : undefined}
            onClick={() => close(true)}
          >
            {pending.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
