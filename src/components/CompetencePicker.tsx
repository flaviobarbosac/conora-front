import { formatCompetence, shiftCompetence } from '../lib/format'
import { Button } from './ui/Button'
import styles from '../pages/page.module.css'

type Props = {
  value: string
  onChange: (ym: string) => void
}

export function CompetencePicker({ value, onChange }: Props) {
  return (
    <div className={styles.picker}>
      <Button variant="secondary" aria-label="Mês anterior" onClick={() => onChange(shiftCompetence(value, -1))}>
        ‹
      </Button>
      <strong>{formatCompetence(value)}</strong>
      <Button variant="secondary" aria-label="Próximo mês" onClick={() => onChange(shiftCompetence(value, 1))}>
        ›
      </Button>
    </div>
  )
}
