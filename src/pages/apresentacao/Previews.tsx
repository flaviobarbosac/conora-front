import { Icon } from '../../components/ui/Icon'
import styles from './previews.module.css'

/*
 * Illustrative, static mini-screens of the product. Numbers are sample data only —
 * these components never read the user's real finances.
 */

const BUDGET_ROWS = [
  { label: 'Moradia', planned: 100, actual: 92 },
  { label: 'Mercado', planned: 100, actual: 108 },
  { label: 'Educação', planned: 100, actual: 74 },
  { label: 'Lazer', planned: 100, actual: 55 },
] as const

export function BudgetPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewHead}>
        <span>Previsto × realizado</span>
        <span className={styles.pill}>Out/2026</span>
      </div>
      <ul className={styles.bars}>
        {BUDGET_ROWS.map((row) => (
          <li key={row.label}>
            <span className={styles.barLabel}>{row.label}</span>
            <span className={styles.barTrack}>
              <span
                className={`${styles.barFill} ${row.actual > row.planned ? styles.over : ''}`}
                style={{ width: `${Math.min(row.actual, 100)}%` }}
              />
            </span>
            <span className={`${styles.barValue} ${row.actual > row.planned ? styles.overText : ''}`}>
              {row.actual}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const RAIO_X_ROWS = [
  { depth: 0, label: 'Receita líquida', value: '18.420,00', tone: 'income' },
  { depth: 1, label: 'Essenciais', value: '9.310,40', tone: 'expense' },
  { depth: 2, label: 'Moradia', value: '4.150,00', tone: 'expense' },
  { depth: 2, label: 'Alimentação', value: '2.870,15', tone: 'expense' },
  { depth: 1, label: 'Projetos de vida', value: '3.000,00', tone: 'goal' },
  { depth: 1, label: 'Social', value: '1.842,00', tone: 'expense' },
] as const

export function RaioXPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewHead}>
        <span>Raio-X do mês</span>
        <Icon name="budget" size={16} />
      </div>
      <ul className={styles.tree}>
        {RAIO_X_ROWS.map((row) => (
          <li key={row.label} style={{ paddingLeft: `${row.depth * 14}px` }} data-depth={row.depth}>
            <span className={styles.treeLabel}>
              {row.depth < 2 ? <span className={styles.caret}>▾</span> : <span className={styles.dot} />}
              {row.label}
            </span>
            <span className={`${styles.treeValue} ${styles[row.tone]}`}>R$ {row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PatrimonyPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewHead}>
        <span>Patrimônio líquido</span>
        <span className={styles.pillSuccess}>+4,2% no ano</span>
      </div>
      <div className={styles.donutRow}>
        <div className={styles.donut}>
          <span>
            <small>PL</small>
            <strong>R$ 1,28 mi</strong>
          </span>
        </div>
        <ul className={styles.legend}>
          <li>
            <span className={styles.swatchA} /> Imóveis
          </li>
          <li>
            <span className={styles.swatchB} /> Investimentos
          </li>
          <li>
            <span className={styles.swatchC} /> Passivos
          </li>
        </ul>
      </div>
    </div>
  )
}

export function ProjectPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewHead}>
        <span>Intercâmbio da Ana</span>
        <Icon name="goal" size={16} />
      </div>
      <div className={styles.goalValue}>
        <strong>R$ 21.600</strong>
        <span>de R$ 36.000</span>
      </div>
      <span className={styles.goalTrack}>
        <span className={styles.goalFill} style={{ width: '60%' }} />
      </span>
      <p className={styles.goalHint}>
        Parcela sugerida <strong>R$ 1.200/mês</strong> até jul/2027
      </p>
    </div>
  )
}

export function ChatPreview() {
  return (
    <div className={`${styles.preview} ${styles.chat}`} aria-hidden="true">
      <span className={styles.bubbleOut}>
        mercado 312,90 cartão nubank
        <small>18:42 ✓✓</small>
      </span>
      <span className={styles.bubbleIn}>
        Rascunho criado: <strong>Alimentação · R$ 312,90</strong>. Confirme no Conora.
        <small>18:42</small>
      </span>
      <div className={styles.draft}>
        <Icon name="list" size={16} />
        <span>1 rascunho aguardando confirmação</span>
      </div>
    </div>
  )
}

export function AiPreview() {
  return (
    <div className={`${styles.preview} ${styles.chat}`} aria-hidden="true">
      <span className={styles.bubbleOut}>Quanto gastamos com lazer este mês?</span>
      <span className={styles.bubbleIn}>
        R$ 1.104,30 — 55% do previsto. Ainda há R$ 895,70 disponíveis em Lazer.
      </span>
    </div>
  )
}

/** Phone-shaped mock of the home dashboard. */
export function PhonePreview() {
  return (
    <div className={styles.phone} aria-hidden="true">
      <div className={styles.phoneNotch} />
      <div className={styles.phoneScreen}>
        <p className={styles.phoneHello}>Olá, família Souza</p>
        <div className={styles.balanceCard}>
          <small>Saldo do mês</small>
          <strong>R$ 4.267,45</strong>
          <span className={styles.balanceRow}>
            <span>
              <Icon name="income" size={16} /> R$ 18.420
            </span>
            <span>
              <Icon name="expense" size={16} /> R$ 14.152
            </span>
          </span>
        </div>
        <BudgetPreview />
        <div className={styles.phoneNav}>
          {(['home', 'list', 'budget', 'folder', 'search'] as const).map((name, index) => (
            <span key={name} className={index === 0 ? styles.phoneNavActive : undefined}>
              <Icon name={name} size={20} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
