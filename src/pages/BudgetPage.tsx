import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  budgetsApi,
  chartAccountsApi,
  type Budget,
  type BudgetLine,
  type BudgetMode,
  type ChartAccount,
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
  return line.chartAccountId ?? `group-${line.section}-${line.groupName}-${index}`
}

function BudgetLineRow({ line, index, ym }: { line: BudgetLine; index: number; ym: string }) {
  const tone = toneFromSeverity(line.status)
  const rowClass = line.actualAmount > 0 ? styles.budgetRowActual : styles.budgetRowPlanned
  const accountCell =
    line.chartAccountId && !line.isGroup ? (
      <Link
        className={styles.budgetAccountLink}
        to={`/lancamentos?competenceYm=${encodeURIComponent(ym)}&chartAccountId=${encodeURIComponent(line.chartAccountId)}`}
      >
        {line.chartAccountName}
      </Link>
    ) : (
      <strong>{line.chartAccountName}</strong>
    )

  return (
    <tr key={lineKey(line, index)} className={rowClass}>
      <td>
        {accountCell}
        {line.groupName && line.groupName !== '—' && !line.isGroup ? (
          <div className={styles.rowSub}>{line.groupName}</div>
        ) : null}
      </td>
      <td className={styles.num}>{formatMoney(line.plannedAmount)}</td>
      <td className={styles.num}>{formatMoney(line.actualAmount)}</td>
      <td className={styles.num}>{formatPercent(line.percent)}</td>
      <td>
        <Badge tone={tone}>{STATUS_LABEL[line.status] ?? line.status}</Badge>
      </td>
    </tr>
  )
}

export function BudgetPage() {
  const [ym, setYm] = useState(currentCompetence)
  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const year = useMemo(() => Number(ym.slice(0, 4)), [ym])
  const yearData = useLoad(() => budgetsApi.getYear(year), [year])
  const categories = useLoad(() => chartAccountsApi.list(undefined, false, true), [])
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
        .filter((line) => line.chartAccountId && !line.isGroup)
        .map((line) => `${line.chartAccountId}=${line.plannedAmount}`)
        .join(',')}`
    : ym

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Planejamento"
        title="Raio-X"
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
              <span>Raio-X · {formatCompetence(data.competenceYm)}</span>
            </div>
            <div className={styles.heroSplit} aria-label="Receita prevista e recebida">
              <div>
                <span>Receita prevista</span>
                <strong>{formatMoney(data.spendableIncome)}</strong>
              </div>
              <div>
                <span>Receita recebida</span>
                <strong className={styles.positive}>{formatMoney(data.receivedIncome)}</strong>
              </div>
            </div>
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

          {data.sections.map((section) => (
            <section key={section.section} className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>{section.name}</h2>
                <span className={styles.rowSub}>
                  {formatPercent(section.percentOfSpendable)} da renda disponível
                </span>
              </div>
              <div className={styles.grid3}>
                <div className={styles.stat}>
                  <span>Previsto</span>
                  <strong>{formatMoney(section.plannedAmount)}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Realizado até hoje</span>
                  <strong>{formatMoney(section.actualAmount)}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Projeção do mês</span>
                  <strong>{formatMoney(data.projectedExpense)}</strong>
                </div>
              </div>
              {section.lines.length === 0 ? (
                <p className={styles.muted}>Nenhuma linha nesta conta.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.budgetTable}>
                    <thead>
                      <tr>
                        <th>Conta</th>
                        <th className={styles.num}>Previsto</th>
                        <th className={styles.num}>Realizado</th>
                        <th className={styles.num}>Variação</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.lines.map((line, index) => (
                        <BudgetLineRow key={lineKey(line, index)} line={line} index={index} ym={ym} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          <div className={styles.grid3}>
            <div className={styles.stat}>
              <span>Resultado do mês</span>
              <strong>{formatMoney(data.monthResult)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Total previsto</span>
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
                <tr key={line.chartAccountId ?? `y-${line.chartAccountName}-${rowIndex}`}>
                  <td style={{ padding: '8px 4px', borderTop: '1px solid var(--border-subtle)' }}>{line.chartAccountName}</td>
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
  categories: ChartAccount[]
  onSaved: () => void
}

function BudgetEditor({ ym, budget, categories, onSaved }: EditorProps) {
  const [mode, setMode] = useState<BudgetMode>(() =>
    budget.lines.some((line) => !line.isGroup && line.plannedAmount > 0) ? budget.mode : readDefaultBudgetMode(),
  )
  const expenseSections = new Set(['Discount', 'LifeProject', 'Essential', 'Social'])
  const editableCategories = useMemo(() => {
    const detailIds = new Set(
      budget.lines.filter((line) => line.chartAccountId && !line.isGroup).map((line) => line.chartAccountId as string),
    )
    const pool = categories.filter(
      (c) => c.isActive && c.level === 'Analytical' && expenseSections.has(c.section),
    )
    if (mode === 'Detailed') {
      return pool
    }
    return pool.filter((c) => detailIds.has(c.id))
  }, [budget.lines, categories, mode])

  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const line of budget.lines) {
      if (line.chartAccountId && !line.isGroup) {
        initial[line.chartAccountId] = formatMoneyInput(line.plannedAmount)
      }
    }
    return initial
  })
  const action = useAction()

  async function save() {
    const lines: { chartAccountId: string; plannedAmount: number }[] = []
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
      lines.push({ chartAccountId: category.id, plannedAmount })
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
