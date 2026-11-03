import page from '../pages/pageStyles'
import styles from './ProgressToneLegend.module.css'

/** Color legend for planned×actual tones, shown inline next to the category tree. */
export function ProgressToneLegend() {
  return (
    <ul className={styles.list} aria-label="Legenda de cores">
      <li className={styles.item}>
        <span className={`${styles.bullet} ${page.raioxToneUnbudgeted}`} aria-hidden />
        sem orçamento
      </li>
      <li className={styles.item}>
        <span className={`${styles.bullet} ${page.raioxToneOk}`} aria-hidden />
        no previsto
      </li>
      <li className={styles.item}>
        <span className={`${styles.bullet} ${page.raioxToneOver}`} aria-hidden />
        acima
      </li>
      <li className={styles.item}>
        <span className={`${styles.bullet} ${page.raioxToneMuted}`} aria-hidden />
        sem movimento
      </li>
    </ul>
  )
}
