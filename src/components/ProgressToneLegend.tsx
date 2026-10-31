import { InfoHint } from './InfoHint'
import page from '../pages/pageStyles'
import styles from './ProgressToneLegend.module.css'

/** Color legend for planned×actual tones — InfoHint (circle-i) opens the popover. */
export function ProgressToneLegend() {
  return (
    <InfoHint
      label="Legenda de cores do previsto versus realizado"
      title="Legenda de cores"
    >
      <ul className={styles.list}>
        <li>
          <span className={`${styles.mark} ${page.raioxToneUnbudgeted}`}>Amarelo</span>
          {' = sem orçamento'}
        </li>
        <li>
          <span className={`${styles.mark} ${page.raioxToneOk}`}>Azul</span>
          {' = no previsto'}
        </li>
        <li>
          <span className={`${styles.mark} ${page.raioxToneOver}`}>Vermelho</span>
          {' = acima'}
        </li>
        <li>
          <span className={`${styles.mark} ${page.raioxToneMuted}`}>Cinza</span>
          {' = sem movimento'}
        </li>
      </ul>
    </InfoHint>
  )
}
