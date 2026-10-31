import { InfoHint } from './InfoHint'
import styles from './ProgressToneLegend.module.css'

/** Abbreviation rules for large amounts — InfoHint (circle-i) opens the popover. */
export function MoneyAbbrevLegend() {
  return (
    <InfoHint
      label="Informação sobre abreviação de valores"
      title="Abreviação de valores"
    >
      <ul className={styles.list}>
        <li>
          A partir de R$&nbsp;10&nbsp;mil: mostra <strong>mil</strong> (ex.: 10&nbsp;mil, 100&nbsp;mil).
        </li>
        <li>
          A partir de R$&nbsp;1&nbsp;milhão: mostra <strong>mi</strong> (ex.: 1,2&nbsp;mi).
        </li>
        <li>Abaixo de R$&nbsp;10&nbsp;mil: valor completo em reais.</li>
        <li>Toque no número para ver o valor completo.</li>
      </ul>
    </InfoHint>
  )
}
