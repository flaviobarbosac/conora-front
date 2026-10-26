import { Button } from './ui/Button'
import { ianPortrait } from '../lib/speakPt'
import styles from './ConoraCelebrate.module.css'

type Props = {
  title: string
  message: string
  showIan?: boolean
  onClose: () => void
  closeLabel?: string
}

/** Motivational full-screen moment with Conora branding. */
export function ConoraCelebrate({
  title,
  message,
  showIan = false,
  onClose,
  closeLabel = 'Continuar',
}: Props) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="conora-celebrate-title">
      <div className={styles.card}>
        <img
          className={styles.symbol}
          src={`${import.meta.env.BASE_URL}brand/simbolo.png`}
          alt=""
          width={72}
          height={72}
        />
        {showIan ? (
          <img className={styles.ian} src={ianPortrait('ian')} alt="" width={96} height={96} />
        ) : null}
        <h2 id="conora-celebrate-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>
        <Button type="button" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </div>
  )
}
