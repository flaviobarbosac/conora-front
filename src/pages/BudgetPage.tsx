import { useState } from 'react'
import { budgetsApi, categoriesApi, type Budget, type BudgetMode, type Category } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { toneFromSeverity } from '../lib/severity'
import { currentCompetence, formatMoney, formatPercent, parseMoney } from '../lib/format'
import styles from './page.module.css'

const STATUS_LABEL: Record<string, string> = {
  Ok: 'Dentro do plano',
  Attention: 'Atenção',
  Limit: 'No limite',
  Exceeded: 'Estourou',
}

export function BudgetPage() {
  const [ym, setYm] = useState(currentCompetence)
  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const categories = useLoad(() => categoriesApi.list('Expense'), [])
  const copy = useAction()

  async function copyPrevious() {
    if (await copy.run(() => budgetsApi.copyPrevious(ym))) {
      budget.reload()
    }
  }

  const data = budget.data
  const editorKey = data ? `${data.competenceYm}:${data.lines.map((line) => `${line.categoryId}=${line.plannedAmount}`).join(',')}` : ym

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Planejamento"
        title="Orçamento"
        actions={
          <>
            <CompetencePicker value={ym} onChange={setYm} />
            <Button variant="secondary" disabled={copy.busy} onClick={() => void copyPrevious()}>
              Copiar mês anterior
            </Button>
          </>
        }
      />
      <ErrorText message={budget.error ?? copy.error ?? categories.error} />
      {budget.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <div className={styles.grid3}>
            <div className={styles.stat}>
              <span>Planejado</span>
              <strong>{formatMoney(data.totalPlanned)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Realizado</span>
              <strong>{formatMoney(data.totalActual)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Projeção de despesa</span>
              <strong>{formatMoney(data.projectedExpense)}</strong>
            </div>
          </div>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Planejado x realizado</h2>
            {data.lines.length === 0 ? (
              <p className={styles.muted}>Nenhuma linha de orçamento neste mês.</p>
            ) : (
              <ul className={styles.list}>
                {data.lines.map((line) => {
                  const tone = toneFromSeverity(line.status)
                  return (
                    <li key={line.categoryId} className={styles.row}>
                      <span className={styles.rowMain}>
                        <strong>{line.categoryName}</strong>
                        <span className={styles.rowSub}>
                          {formatMoney(line.actualAmount)} de {formatMoney(line.plannedAmount)} · resta {formatMoney(line.remaining)}
                        </span>
                        <span className={styles.progress} aria-hidden>
                          <span
                            className={`${styles.progressFill} ${styles[`progressFill_${tone === 'info' ? 'ok' : tone}`]}`}
                            style={{ width: `${Math.min(line.percent ?? 0, 100)}%` }}
                          />
                        </span>
                      </span>
                      <Badge tone={tone}>
                        {STATUS_LABEL[line.status] ?? line.status} · {formatPercent(line.percent)}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          <BudgetEditor
            key={editorKey}
            ym={ym}
            budget={data}
            categories={categories.data ?? []}
            onSaved={budget.reload}
          />
        </>
      ) : null}
    </div>
  )
}

type EditorProps = {
  ym: string
  budget: Budget
  categories: Category[]
  onSaved: () => void
}

function BudgetEditor({ ym, budget, categories, onSaved }: EditorProps) {
  const [mode, setMode] = useState<BudgetMode>(budget.mode)
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(budget.lines.map((line) => [line.categoryId, String(line.plannedAmount).replace('.', ',')])),
  )
  const action = useAction()

  async function save() {
    const lines: { categoryId: string; plannedAmount: number }[] = []
    for (const [categoryId, text] of Object.entries(drafts)) {
      if (!text.trim()) {
        continue
      }
      const plannedAmount = parseMoney(text)
      if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
        action.setError('Há um valor inválido no orçamento.')
        return
      }
      lines.push({ categoryId, plannedAmount })
    }

    if (await action.run(() => budgetsApi.upsert(ym, mode, lines))) {
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Definir orçamento</h2>
        <div className={styles.segmented} role="group" aria-label="Modo do orçamento">
          <button type="button" aria-pressed={mode === 'Simple'} onClick={() => setMode('Simple')}>
            Simples
          </button>
          <button type="button" aria-pressed={mode === 'Detailed'} onClick={() => setMode('Detailed')}>
            Detalhado
          </button>
        </div>
      </div>
      <div className={styles.form}>
        {categories.map((category) => (
          <Field
            key={category.id}
            label={category.name}
            name={`budget-${category.id}`}
            inputMode="decimal"
            placeholder="0,00"
            value={drafts[category.id] ?? ''}
            onChange={(event) => setDrafts((current) => ({ ...current, [category.id]: event.target.value }))}
          />
        ))}
      </div>
      <ErrorText message={action.error} />
      <div className={styles.actions}>
        <Button disabled={action.busy} onClick={() => void save()}>
          Salvar orçamento
        </Button>
      </div>
    </section>
  )
}
