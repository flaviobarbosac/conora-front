import type { ReactNode } from 'react'
import { consoleApi, type ConsoleFeature, type ConsoleMetric, type ConsoleWeek } from '../api/finance'
import { KpiBarChart, KpiLineChart, KpiMultiLineChart, KpiPieChart, type KpiPoint } from '../components/charts/KpiCharts'
import { PageHeader } from '../components/PageHeader'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import layout from './page.module.css'
import styles from './ConsolePage.module.css'

const SERIES = [
  { key: 'signups', label: 'Novas contas', color: '#375984', pick: (week: ConsoleWeek) => week.signups },
  { key: 'active', label: 'Contas ativas', color: '#2f9e44', pick: (week: ConsoleWeek) => week.active },
  { key: 'budgets', label: 'Orçamentos criados', color: '#f59f00', pick: (week: ConsoleWeek) => week.budgets },
  { key: 'closes', label: 'Fechamentos', color: '#6aacff', pick: (week: ConsoleWeek) => week.closes },
  { key: 'errors', label: 'Erros', color: '#e03131', pick: (week: ConsoleWeek) => week.errors },
]

function count(value: number): string {
  return value.toLocaleString('pt-BR')
}

function percent(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function weekLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const label = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return label.replace('.', '')
}

function points(rows: ConsoleMetric[], field: 'percent' | 'count' = 'percent'): KpiPoint[] {
  return rows.map((row) => ({ key: row.key, label: row.label, value: row[field] }))
}

export function ConsolePage() {
  const report = useLoad(() => consoleApi.kpis(), [])
  const data = report.data

  return (
    <div className={layout.page}>
      <PageHeader
        kicker="Console"
        title="Acompanhamento do método"
        actions={data ? <span className={layout.muted}>Competência {data.competenceYm}</span> : null}
      />
      <p className={layout.muted}>
        Índices agregados das contas. Nenhum nome, e-mail ou lançamento individual aparece aqui. O produto é medido
        pela adoção do método: diagnóstico, orçamento, teto, fechamento, reserva e projeto de vida.
      </p>
      <ErrorText message={report.error} />
      {report.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <div className={layout.grid3}>
            <Stat label="Contas" value={count(data.accounts)} />
            <Stat label="Ativas em 7 dias" value={count(data.active7d)} hint={percent(share(data.active7d, data.accounts))} />
            <Stat label="Ativas em 30 dias" value={count(data.active30d)} hint={percent(share(data.active30d, data.accounts))} />
            <Stat label="Com orçamento neste mês" value={count(data.withBudget)} hint={percent(share(data.withBudget, data.accounts))} />
            <Stat label="Sem orçamento neste mês" value={count(data.withoutBudget)} hint={percent(share(data.withoutBudget, data.accounts))} />
            <Stat label="Dentro do teto" value={count(data.budgetWithin)} hint={percent(share(data.budgetWithin, data.withBudget))} />
            <Stat label="Erros em 7 dias" value={count(data.errors7d)} />
            <Stat label="Erros em 30 dias" value={count(data.errors30d)} />
            <Stat label="Ativas hoje" value={count(data.active1d)} hint={percent(share(data.active1d, data.accounts))} />
          </div>

          <div className={styles.board}>
            <Panel title="Jornada do método" hint="Percentual das contas em cada passo.">
              <KpiBarChart points={points(data.journey)} format={percent} />
              <MetricTable rows={data.journey} />
            </Panel>
            <Panel title="Orçamento deste mês" hint="Quem já montou o orçamento da competência e quem ainda não montou.">
              <KpiPieChart
                points={[
                  { key: 'with', label: 'Com orçamento', value: data.withBudget },
                  { key: 'without', label: 'Sem orçamento', value: data.withoutBudget },
                ]}
              />
              <SimpleTable
                headers={['Situação', 'Contas', 'Índice']}
                rows={[
                  ['Com orçamento', count(data.withBudget), percent(share(data.withBudget, data.accounts))],
                  ['Sem orçamento', count(data.withoutBudget), percent(share(data.withoutBudget, data.accounts))],
                ]}
              />
            </Panel>
            <Panel title="Teto do orçamento" hint="Entre quem tem orçamento neste mês: dentro do previsto, acima ou sem valor planejado.">
              <KpiPieChart
                points={[
                  { key: 'within', label: 'Dentro do teto', value: data.budgetWithin },
                  { key: 'over', label: 'Acima do teto', value: data.budgetOver },
                  { key: 'empty', label: 'Orçamento vazio', value: data.budgetEmpty },
                ]}
              />
              <SimpleTable
                headers={['Situação', 'Contas', 'Índice sobre quem orçou']}
                rows={[
                  ['Dentro do teto', count(data.budgetWithin), percent(share(data.budgetWithin, data.withBudget))],
                  ['Acima do teto', count(data.budgetOver), percent(share(data.budgetOver, data.withBudget))],
                  ['Orçamento vazio', count(data.budgetEmpty), percent(share(data.budgetEmpty, data.withBudget))],
                ]}
              />
            </Panel>
            <Panel title={`Mês anterior (${data.previousCompetenceYm})`} hint="Base do fechamento: contas que lançaram na competência anterior.">
              <KpiBarChart points={points(data.previousMonth, 'count')} />
              <MetricTable rows={data.previousMonth} />
            </Panel>
            <Panel title="Conquistas do método" hint="Contas que alcançaram o marco ao menos uma vez.">
              <KpiBarChart points={points(data.achievements)} format={percent} />
              <MetricTable rows={data.achievements} />
            </Panel>
            <Panel title="Uso por funcionalidade" hint="Últimos 30 dias. Contas distintas e registros atualizados. Não é contagem de cliques." wide>
              <KpiBarChart points={data.features.map((row) => ({ key: row.key, label: row.label, value: row.users }))} />
              <FeatureTable rows={data.features} />
            </Panel>
            <Panel title="Evolução em 12 semanas" hint="Novas contas, atividade, orçamentos criados, fechamentos e erros." wide>
              <KpiMultiLineChart
                categories={data.weeks.map((week) => weekLabel(week.weekStart))}
                series={SERIES.map((item) => ({
                  key: item.key,
                  label: item.label,
                  color: item.color,
                  values: data.weeks.map(item.pick),
                }))}
              />
              <WeekTable rows={data.weeks} />
            </Panel>
            <Panel title="Erros por dia" hint="Últimos 14 dias. O histórico começa a contar a partir desta versão." wide>
              <KpiLineChart points={points(data.errorDays, 'count')} />
              <MetricTable rows={data.errorDays} />
            </Panel>
            <Panel title="Erros por funcionalidade" hint="Últimos 30 dias, agrupados pela área da API.">
              <KpiBarChart points={points(data.errorsByArea, 'count')} />
              <MetricTable rows={data.errorsByArea} />
            </Panel>
            <Panel title="Erros por tipo" hint="Código e título, sem a mensagem original.">
              <KpiBarChart points={points(data.errorsByStatus, 'count')} />
              <MetricTable rows={data.errorsByStatus} />
            </Panel>
            <Panel title="Detalhe dos erros" hint="Quantidade por dia, tipo e área." wide>
              <SimpleTable
                headers={['Dia', 'Tipo', 'Área', 'Quantidade']}
                rows={data.errorRows.map((row) => [row.day, `${row.statusCode} ${row.title}`, row.area, count(row.count)])}
              />
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  )
}

function share(countValue: number, base: number): number {
  if (base <= 0) return 0
  return Math.round((countValue * 1000) / base) / 10
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={layout.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  )
}

function Panel({
  title,
  hint,
  wide,
  children,
}: {
  title: string
  hint: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <section className={[layout.section, wide ? styles.wide : ''].filter(Boolean).join(' ')}>
      <h2 className={layout.sectionTitle}>{title}</h2>
      <p className={layout.muted}>{hint}</p>
      {children}
    </section>
  )
}

function MetricTable({ rows }: { rows: ConsoleMetric[] }) {
  return (
    <SimpleTable
      headers={['Indicador', 'Quantidade', 'Base', 'Índice']}
      rows={rows.map((row) => [row.label, count(row.count), count(row.base), percent(row.percent)])}
    />
  )
}

function FeatureTable({ rows }: { rows: ConsoleFeature[] }) {
  return (
    <SimpleTable
      headers={['Funcionalidade', 'Contas', 'Registros', 'Índice das contas']}
      rows={rows.map((row) => [row.label, count(row.users), count(row.events), percent(row.percent)])}
    />
  )
}

function WeekTable({ rows }: { rows: ConsoleWeek[] }) {
  return (
    <SimpleTable
      headers={['Semana', 'Novas contas', 'Ativas', 'Orçamentos', 'Fechamentos', 'Erros']}
      rows={rows.map((row) => [
        weekLabel(row.weekStart),
        count(row.signups),
        count(row.active),
        count(row.budgets),
        count(row.closes),
        count(row.errors),
      ])}
    />
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <p className={layout.muted}>Nenhum registro.</p>
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${headers[cellIndex]}-${cell}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
