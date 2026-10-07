import { useMemo, useState } from 'react'
import {
  budgetsApi,
  categoriesApi,
  type Budget,
  type BudgetLine,
  type BudgetMode,
  type Category,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { MoneyField } from '../components/ui/MoneyField'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { toneFromSeverity } from '../lib/severity'
import {
  currentCompetence,
  formatCompetence,
  formatMoney,
  formatMoneyInput,
  formatPercent,
  parseMoney,
} from '../lib/format'
import { readDefaultBudgetMode } from '../lib/preferences'
import styles from './page.module.css'

const STATUS_LABEL: Record<string, string> = {
  Ok: 'Dentro do plano',
  Attention: 'Atenção',
  Limit: 'No limite',
  Exceeded: 'Estourou',
}

function lineKey(line: BudgetLine, index: number): string {
  return line.categoryId ?? `group-${line.block}-${line.groupName}-${index}`
}

function BudgetLineRow({ line, index }: { line: BudgetLine; index: number }) {
  const tone = toneFromSeverity(line.status)
  return (
    <li key={lineKey(line, index)} className={styles.row}>
      <span className={styles.rowMain}>
        <strong>{line.categoryName}</strong>
        {line.groupName && line.groupName !== '—' ? (
          <span className={styles.rowSub}>{line.groupName}</span>
        ) : null}
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
}

export function BudgetPage() {
  const [ym, setYm] = useState(currentCompetence)
  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const year = useMemo(() => Number(ym.slice(0, 4)), [ym])
  const yearData = useLoad(() => budgetsApi.getYear(year), [year])
  const categories = useLoad(() => categoriesApi.list('Expense'), [])
  const copy = useAction()

  async function copyPrevious() {
    if (await copy.run(() => budgetsApi.copyPrevious(ym))) {
      budget.reload()
      yearData.reload()
    }
  }

  const data = budget.data
  const editorKey = data
    ? `${data.competenceYm}:${data.mode}:${data.lines
        .filter((line) => line.categoryId && !line.isGroup)
        .map((line) => `${line.categoryId}=${line.plannedAmount}`)
        .join(',')}`
    : ym

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
      <ErrorText message={budget.error ?? copy.error ?? categories.error ?? yearData.error} />
      {budget.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroTop}>
              <span>Renda disponível ({formatCompetence(data.competenceYm)})</span>
            </div>
            <strong>{formatMoney(data.spendableIncome)}</strong>
            {data.incomeSources.length > 0 ? (
              <ul className={styles.list}>
                {data.incomeSources.map((source) => (
                  <li key={source.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>{source.name}</strong>
                    </span>
                    <span className={styles.amount}>{formatMoney(source.netSpendable)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>Cadastre fontes de renda no diagnóstico financeiro.</p>
            )}
          </section>

          {data.blocks.map((block) => (
            <section key={block.block} className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{block.name}</h2>
                <span className={styles.rowSub}>
                  {formatPercent(block.percentOfSpendable)} da renda disponível
                </span>
              </div>
              <div className={styles.grid3}>
                <div className={styles.stat}>
                  <span>Planejado</span>
                  <strong>{formatMoney(block.plannedAmount)}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Realizado</span>
                  <strong>{formatMoney(block.actualAmount)}</strong>
                </div>
              </div>
              {block.lines.length === 0 ? (
                <p className={styles.muted}>Nenhuma linha neste bloco.</p>
              ) : (
                <ul className={styles.list}>
                  {block.lines.map((line, index) => (
                    <BudgetLineRow key={lineKey(line, index)} line={line} index={index} />
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className={styles.grid3}>
            <div className={styles.stat}>
              <span>Resultado do mês</span>
              <strong>{formatMoney(data.monthResult)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Total planejado</span>
              <strong>{formatMoney(data.totalPlanned)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Projeção de despesa</span>
              <strong>{formatMoney(data.projectedExpense)}</strong>
            </div>
          </div>

          <BudgetEditor
            key={editorKey}
            ym={ym}
            budget={data}
            categories={categories.data ?? []}
            onSaved={() => {
              budget.reload()
              yearData.reload()
            }}
          />

          <BudgetYearSection year={year} data={yearData.data} loading={yearData.loading} />
        </>
      ) : null}
    </div>
  )
}

function BudgetYearSection({
  year,
  data,
  loading,
}: {
  year: number
  data: Awaited<ReturnType<typeof budgetsApi.getYear>> | null | undefined
  loading: boolean
}) {
  if (loading && !data) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Visão anual {year}</h2>
        <Loading />
      </section>
    )
  }
  if (!data) {
    return null
  }

  const monthLabels = data.months.map((m) => m.slice(5, 7))

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Visão anual {year}</h2>
      {data.lines.length === 0 ? (
        <p className={styles.muted}>Sem dados de orçamento para este ano.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-md)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Categoria</th>
                {monthLabels.map((label, index) => (
                  <th key={data.months[index]} style={{ textAlign: 'right', padding: '8px 4px', whiteSpace: 'nowrap' }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line, rowIndex) => (
                <tr key={line.categoryId ?? `y-${line.categoryName}-${rowIndex}`}>
                  <td style={{ padding: '8px 4px', borderTop: '1px solid var(--border-subtle)' }}>{line.categoryName}</td>
                  {data.months.map((monthYm) => {
                    const cell = line.months.find((m) => m.competenceYm === monthYm)
                    return (
                      <td
                        key={monthYm}
                        style={{ textAlign: 'right', padding: '8px 4px', borderTop: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}
                      >
                        {cell ? (
                          <>
                            {formatMoney(cell.plannedAmount)}
                            <br />
                            <span style={{ color: 'var(--text-muted)' }}>{formatMoney(cell.actualAmount)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ padding: '8px 4px', borderTop: '1px solid var(--border-subtle)', fontWeight: 600 }}>Total</td>
                {data.months.map((monthYm) => {
                  const cell = data.totals.find((t) => t.competenceYm === monthYm)
                  return (
                    <td
                      key={monthYm}
                      style={{ textAlign: 'right', padding: '8px 4px', borderTop: '1px solid var(--border-subtle)', fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {cell ? (
                        <>
                          {formatMoney(cell.plannedAmount)}
                          <br />
                          <span style={{ color: 'var(--text-muted)' }}>{formatMoney(cell.actualAmount)}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
          <p className={styles.muted}>Em cada mês: planejado (linha de cima) e realizado (linha de baixo).</p>
        </div>
      )}
    </section>
  )
}

type EditorProps = {
  ym: string
  budget: Budget
  categories: Category[]
  onSaved: () => void
}

function BudgetEditor({ ym, budget, categories, onSaved }: EditorProps) {
  const [mode, setMode] = useState<BudgetMode>(() =>
    budget.lines.some((line) => !line.isGroup && line.plannedAmount > 0) ? budget.mode : readDefaultBudgetMode(),
  )
  const editableCategories = useMemo(() => {
    const detailIds = new Set(
      budget.lines.filter((line) => line.categoryId && !line.isGroup).map((line) => line.categoryId as string),
    )
    if (mode === 'Detailed') {
      return categories.filter((c) => c.isActive)
    }
    return categories.filter((c) => c.isActive && detailIds.has(c.id))
  }, [budget.lines, categories, mode])

  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const line of budget.lines) {
      if (line.categoryId && !line.isGroup) {
        initial[line.categoryId] = formatMoneyInput(line.plannedAmount)
      }
    }
    return initial
  })
  const action = useAction()

  async function save() {
    const lines: { categoryId: string; plannedAmount: number }[] = []
    for (const category of editableCategories) {
      const text = drafts[category.id] ?? ''
      if (!text.trim()) {
        continue
      }
      const plannedAmount = parseMoney(text)
      if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
        action.setError('Há um valor inválido no orçamento.')
        return
      }
      lines.push({ categoryId: category.id, plannedAmount })
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
      {mode === 'Simple' && editableCategories.length === 0 ? (
        <p className={styles.muted}>No modo simples, edite valores nas categorias já planejadas ou mude para detalhado.</p>
      ) : null}
      <div className={styles.form}>
        {editableCategories.map((category) => (
          <MoneyField
            key={category.id}
            label={category.name}
            name={`budget-${category.id}`}
            value={drafts[category.id] ?? ''}
            onChange={(value) => setDrafts((current) => ({ ...current, [category.id]: value }))}
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
