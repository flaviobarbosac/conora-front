import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { dashboardApi, type Alert } from '../api/finance'
import { useLoad } from '../hooks/useLoad'
import { alertTarget } from '../lib/alertTarget'
import { currentCompetence } from '../lib/format'
import { severityLabelPt } from '../lib/severityLabel'
import { toneFromSeverity } from '../lib/severity'
import { Badge } from './ui/Feedback'
import { Icon } from './ui/Icon'
import styles from './AlertsBell.module.css'

type Props = {
  /** When true, closes the panel (e.g. profile menu opened). */
  peerOpen?: boolean
  onOpen?: () => void
}

export function AlertsBell({ peerOpen = false, onOpen }: Props) {
  const { pathname } = useLocation()
  const ym = currentCompetence()
  const alerts = useLoad(() => dashboardApi.alerts(ym), [ym, pathname])
  const [open, setOpen] = useState(false)
  /** Optimistic overlay so the badge drops as soon as the panel opens. */
  const [localSeen, setLocalSeen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const remote = alerts.data ?? []
  const items: Alert[] = localSeen
    ? remote.map((alert) => ({ ...alert, seen: true }))
    : remote
  const count = items.filter((alert) => !alert.seen).length

  useEffect(() => {
    setOpen(false)
    setLocalSeen(false)
  }, [pathname, ym])

  useEffect(() => {
    if (peerOpen) {
      setOpen(false)
    }
  }, [peerOpen])

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function markOpenSeen(snapshot: Alert[]) {
    const unseen = snapshot.filter((alert) => !alert.seen)
    if (unseen.length === 0) {
      return
    }
    setLocalSeen(true)
    try {
      await dashboardApi.markAlertsSeen(
        ym,
        unseen.map((alert) => ({ code: alert.code, categoryId: alert.categoryId })),
      )
      alerts.reload()
    } catch {
      setLocalSeen(false)
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.bellBtn}
        aria-label={count > 0 ? `Alertas, ${count} não lidos` : 'Alertas'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => {
            const next = !value
            if (next) {
              onOpen?.()
              void markOpenSeen(remote)
            }
            return next
          })
        }}
      >
        <Icon name="bell" size={20} />
        {count > 0 ? (
          <span className={styles.badge} aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={styles.panel} role="menu" aria-label="Alertas">
          <div className={styles.panelHead}>
            <strong>Alertas</strong>
            <span className={styles.panelMeta}>{ym}</span>
          </div>
          {alerts.loading && !alerts.data ? <p className={styles.empty}>Carregando…</p> : null}
          {alerts.error ? <p className={styles.empty}>{alerts.error}</p> : null}
          {!alerts.loading && !alerts.error && items.length === 0 ? (
            <p className={styles.empty}>Tudo em ordem nesta competência.</p>
          ) : null}
          {items.length > 0 ? (
            <ul className={styles.list}>
              {items.map((alert) => {
                const tone = toneFromSeverity(alert.severity)
                const to = alertTarget(alert, ym)
                return (
                  <li key={`${alert.code}-${alert.categoryId ?? ''}-${alert.message}`}>
                    <Link
                      to={to}
                      className={styles.item}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      <span className={styles.itemIcon} aria-hidden="true">
                        <Icon name="alert" size={16} />
                      </span>
                      <span className={styles.itemMain}>
                        <strong>{alert.message}</strong>
                      </span>
                      <Badge tone={tone}>
                        {alert.percent !== null
                          ? `${Math.round(alert.percent)}%`
                          : severityLabelPt(alert.severity)}
                      </Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
