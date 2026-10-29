import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './ui/Icon'
import styles from '../pages/pageStyles'

/** Color legend for planned×actual tones — icon opens a compact popover. */
export function ProgressToneLegend() {
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
    <div className={styles.raioxLegendWrap} ref={rootRef}>
      <button
        type="button"
        className={styles.raioxLegendToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Legenda de cores"
        title="Legenda de cores"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <Icon name="help" size={20} />
      </button>
      {open ? (
        <div
          id={panelId}
          className={styles.raioxLegendPopover}
          role="dialog"
          aria-label="Legenda de cores do previsto versus realizado"
        >
          <p className={styles.raioxLegend}>
            <span className={styles.raioxLegendItem}>
              <span className={`${styles.raioxLegendMark} ${styles.raioxToneUnbudgeted}`}>Amarelo</span>
              {' = sem orçamento'}
            </span>
            <span className={styles.raioxLegendItem}>
              <span className={`${styles.raioxLegendMark} ${styles.raioxToneOk}`}>Azul</span>
              {' = no previsto'}
            </span>
            <span className={styles.raioxLegendItem}>
              <span className={`${styles.raioxLegendMark} ${styles.raioxToneOver}`}>Vermelho</span>
              {' = acima'}
            </span>
            <span className={styles.raioxLegendItem}>
              <span className={`${styles.raioxLegendMark} ${styles.raioxToneMuted}`}>Cinza</span>
              {' = sem movimento'}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  )
}
