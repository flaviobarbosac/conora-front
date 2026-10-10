import styles from '../pages/page.module.css'

/** One-line legend for planned×actual percent tones (budget / Raio-X). */
export function ProgressToneLegend() {
  return (
    <p className={styles.raioxLegend}>
      <span className={styles.raioxLegendItem}>
        <span className={`${styles.raioxLegendMark} ${styles.raioxToneUnbudgeted}`}>Amarelo</span>
        {' = sem orçamento lançado'}
      </span>
      <span className={styles.raioxLegendSep} aria-hidden>
        ·
      </span>
      <span className={styles.raioxLegendItem}>
        <span className={`${styles.raioxLegendMark} ${styles.raioxToneOk}`}>Azul</span>
        {' = dentro do previsto'}
      </span>
      <span className={styles.raioxLegendSep} aria-hidden>
        ·
      </span>
      <span className={styles.raioxLegendItem}>
        <span className={`${styles.raioxLegendMark} ${styles.raioxToneOver}`}>Vermelho</span>
        {' = acima do previsto'}
      </span>
      <span className={styles.raioxLegendSep} aria-hidden>
        ·
      </span>
      <span className={styles.raioxLegendItem}>
        <span className={`${styles.raioxLegendMark} ${styles.raioxToneMuted}`}>Cinza</span>
        {' = sem movimento'}
      </span>
    </p>
  )
}
