import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  consoleApi,
  type ConsoleFeature,
  type ConsoleKpis,
  type ConsoleMetric,
  type ConsoleMonth,
  type ConsoleWeek,
} from '../api/finance'
import { KpiBarChart, KpiLineChart, KpiMultiLineChart, KpiPieChart, type KpiPoint, type KpiSeries } from '../components/charts/KpiCharts'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import type { ConsoleSectionId } from '../lib/consoleNav'
import layout from './page.module.css'
import styles from './ConsolePage.module.css'

const MONTHS_MIN = 1
const MONTHS_MAX = 24

type MetricsSection = Exclude<ConsoleSectionId, 'feedback' | 'abandonamento'>
type Cell = string | { text: string; hint?: string }

const SECTION_INTRO: Record<MetricsSection, { title: string; text: string }> = {
  metodo: {
    title: 'Método',
    text: 'Adesão ao caminho do Conora: orçamento, teto e conquistas. Usuário é quem tem cadastro.',
  },
  engajamento: {
    title: 'Engajamento',
    text: 'Quem está ativo e o que toca no app. Conta alteração de registro, não clique.',
  },
  tendencias: {
    title: 'Tendências',
    text: 'Como o método evolui mês a mês. Ajuste a janela no controle abaixo.',
  },
  saude: {
    title: 'Saúde',
    text: 'Falhas da API sem nome de usuário e sem a mensagem original.',
  },
}

const SERIES = [
  { key: 'signups', label: 'Novos usuários', color: '#375984', pick: (week: ConsoleWeek) => week.signups },
  { key: 'active', label: 'Usuários ativos', color: '#2f9e44', pick: (week: ConsoleWeek) => week.active },
  { key: 'budgets', label: 'Orçamentos criados', color: '#f59f00', pick: (week: ConsoleWeek) => week.budgets },
  { key: 'closes', label: 'Fechamentos', color: '#6aacff', pick: (week: ConsoleWeek) => week.closes },
  { key: 'errors', label: 'Erros', color: '#e03131', pick: (week: ConsoleWeek) => week.errors },
]

const MONTH_COUNTS: { key: string; label: string; color: string; pick: (month: ConsoleMonth) => number }[] = [
  { key: 'withBudget', label: 'Com orçamento', color: '#375984', pick: (month) => month.withBudget },
  { key: 'within', label: 'Dentro do teto', color: '#2f9e44', pick: (month) => month.budgetWithin },
  { key: 'closed', label: 'Mês fechado', color: '#6aacff', pick: (month) => month.closed },
  { key: 'entries', label: 'Com lançamento', color: '#f59f00', pick: (month) => month.withEntry },
  { key: 'signups', label: 'Novos usuários', color: '#868e96', pick: (month) => month.signups },
  { key: 'errors', label: 'Erros', color: '#e03131', pick: (month) => month.errors },
]

const MONTH_RATES: { key: string; label: string; color: string; pick: (month: ConsoleMonth) => number }[] = [
  { key: 'budgetPercent', label: 'Fizeram orçamento', color: '#375984', pick: (month) => month.budgetPercent },
  { key: 'withinPercent', label: 'Dentro do teto', color: '#2f9e44', pick: (month) => month.withinPercent },
  { key: 'closedPercent', label: 'Fecharam o mês', color: '#6aacff', pick: (month) => month.closedPercent },
]

const HINTS: Record<string, string> = {
  onboarding:
    'Usuário que saiu da tela de primeiros passos. A conta é marcada quando ele entra no início ou segue para uma etapa. Não exige as seis etapas concluídas. A base é todos os usuários ativos.',
  diagnosis:
    'Usuário com ao menos uma fonte de renda no diagnóstico. Conta a pessoa, não a quantidade de fontes. A base é todos os usuários ativos.',
  budget:
    'Usuário com ao menos um orçamento gravado, em qualquer mês. A base é todos os usuários ativos.',
  card: 'Usuário com ao menos um cartão de crédito cadastrado. A base é todos os usuários ativos.',
  close:
    'Usuário que fechou ao menos um mês. Vale o cadeado do mês marcado como fechado. A base é todos os usuários ativos.',
  reserve:
    'Usuário com saldo na reserva de emergência. Se existe projeto na conta LIFE_RESERVE do plano de contas, vale o acumulado dele. Senão, soma os aportes nessa conta. Entra quem tem saldo maior que zero.',
  projects: 'Usuário com ao menos um projeto de vida cadastrado. A base é todos os usuários ativos.',
  'within-ever':
    'Usuário que já fechou um mês dentro do teto. O teto é a soma do previsto de todas as linhas do orçamento. O gasto soma despesas, aportes e aportes de projeto nas seções Essencial, Social, Projeto de vida e Desconto. Dentro do teto quando o previsto é maior que zero e o gasto não passa dele.',
  streak:
    'Usuário com três meses fechados seguidos, cada um dentro do teto. Um mês sem fechar, ou fechado acima do teto, zera a sequência.',
  'reserve-complete':
    'Usuário cuja reserva cobre a meta de meses. O saldo da reserva dividido pelo previsto essencial deste mês é comparado com a meta gravada na conta do usuário.',
  'project-advanced':
    'Usuário com ao menos um projeto de vida que já recebeu aporte. O acumulado do projeto é maior que zero.',
  'previous-entries':
    'Usuário com algum lançamento na competência anterior. A base do índice é todos os usuários ativos.',
  'previous-closed':
    'Entre quem lançou no mês anterior, quantos fecharam o mês. A base é quem teve lançamento, não todos os usuários.',
  'previous-open':
    'Entre quem lançou no mês anterior, quantos ainda não fecharam. A base é quem teve lançamento.',
  'previous-within':
    'Entre os meses anteriores já fechados, quantos ficaram com o gasto dentro do previsto. A base é quem fechou.',
  'previous-over':
    'Entre os meses anteriores já fechados, quantos passaram do previsto. A base é quem fechou.',
  'error-day':
    'Falhas de API neste dia. O índice é a quantidade do dia dividida pelos erros dos últimos 30 dias. O histórico começa nesta versão.',
  'error-status':
    'Falhas agrupadas pelo código e pelo título curto. A mensagem original e o usuário não entram. A base é o total de erros em 30 dias.',
  'error-area':
    'Falhas agrupadas pela área da API, o primeiro trecho do endereço. A base é o total de erros em 30 dias.',
}

const FEATURE_HINTS: Record<string, string> = {
  entries: 'Lançamentos atualizados nos últimos 30 dias. Usuários distintos e quantidade de registros. Não é clique.',
  budgets: 'Orçamentos atualizados nos últimos 30 dias.',
  months: 'Fechamentos de mês atualizados nos últimos 30 dias.',
  diagnosis: 'Fontes de renda do diagnóstico atualizadas nos últimos 30 dias.',
  accounts:
    'Contas bancárias atualizadas nos últimos 30 dias: banco, carteira ou outro lugar onde está o dinheiro. Não é o cadastro do usuário.',
  cards: 'Cartões e compras no cartão atualizados nos últimos 30 dias.',
  categories:
    'Contas do plano de contas criadas ou alteradas pelo usuário nos últimos 30 dias. As contas padrão do sistema não entram.',
  projects: 'Projetos de vida atualizados nos últimos 30 dias.',
  patrimony: 'Itens de patrimônio atualizados nos últimos 30 dias.',
  imports: 'Importações atualizadas nos últimos 30 dias.',
  receipts: 'Recibos lidos nos últimos 30 dias.',
  whatsapp: 'Rascunhos do WhatsApp atualizados nos últimos 30 dias.',
  family: 'Vínculos de grupo familiar atualizados nos últimos 30 dias.',
  members: 'Membros da família atualizados nos últimos 30 dias.',
  ian: 'Perguntas ao Ian nos últimos 30 dias.',
  feedback: 'Feedbacks enviados nos últimos 30 dias.',
}

const STAT_HINTS = {
  users:
    'Cadastros de usuário ativos. Conta excluída não entra. Não é conta bancária nem conta do plano de contas.',
  active1: 'Usuários distintos que alteraram algum registro nas últimas 24 horas. Não conta clique.',
  active7: 'Usuários distintos que alteraram algum registro nos últimos 7 dias. Não conta clique.',
  active30: 'Usuários distintos que alteraram algum registro nos últimos 30 dias. Não conta clique.',
  withBudget: 'Usuários com um orçamento gravado na competência atual.',
  withoutBudget: 'Usuários ativos sem orçamento nesta competência. É o total de usuários menos quem já orçou.',
  within:
    'Entre quem tem orçamento neste mês: o previsto de todas as linhas é maior que zero e o gasto nas seções do método não passou desse previsto. O índice usa como base quem orçou, não todos os usuários.',
  errors7: 'Falhas de API nos últimos 7 dias. Sem nome de usuário e sem a mensagem original. O histórico começa nesta versão.',
  errors30: 'Falhas de API nos últimos 30 dias. Sem nome de usuário e sem a mensagem original.',
}

function count(value: number): string {
  return value.toLocaleString('pt-BR')
}

function percent(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function weekLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function points(rows: ConsoleMetric[], field: 'percent' | 'count' = 'percent'): KpiPoint[] {
  return rows.map((row) => ({ key: row.key, label: row.label, value: row[field] }))
}

function share(countValue: number, base: number): number {
  if (base <= 0) return 0
  return Math.round((countValue * 1000) / base) / 10
}

function metricHint(row: ConsoleMetric): string {
  if (HINTS[row.key]) return HINTS[row.key]
  if (/^\d{4}-\d{2}-\d{2}$/.test(row.key)) return HINTS['error-day']
  if (/^\d{3}$/.test(row.key)) return HINTS['error-status']
  return HINTS['error-area']
}

function cellText(cell: Cell): string {
  return typeof cell === 'string' ? cell : cell.text
}

export function ConsolePage({ section }: { section: MetricsSection }) {
  const report = useLoad(() => consoleApi.kpis(), [])
  const data = report.data
  const [months, setMonths] = useState(6)
  const intro = SECTION_INTRO[section]

  return (
    <div className={styles.stage}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>{intro.title}</h2>
          <p className={layout.muted}>{intro.text}</p>
        </div>
        {data ? <span className={styles.competence}>Competência {data.competenceYm}</span> : null}
      </div>
      <ErrorText message={report.error} />
      {report.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          {section === 'metodo' ? <MethodTab data={data} /> : null}
          {section === 'engajamento' ? <UsageTab data={data} /> : null}
          {section === 'tendencias' ? (
            <EvolutionTab data={data} months={months} onMonths={setMonths} />
          ) : null}
          {section === 'saude' ? <ErrorsTab data={data} /> : null}
        </>
      ) : null}
    </div>
  )
}

function MethodTab({ data }: { data: ConsoleKpis }) {
  return (
    <div className={styles.stack}>
      <div className={`${layout.grid3} ${styles.stats}`}>
        <Stat label="Usuários" value={count(data.accounts)} hint={STAT_HINTS.users} />
        <Stat label="Com orçamento neste mês" value={count(data.withBudget)} note={percent(share(data.withBudget, data.accounts))} hint={STAT_HINTS.withBudget} />
        <Stat label="Sem orçamento neste mês" value={count(data.withoutBudget)} note={percent(share(data.withoutBudget, data.accounts))} hint={STAT_HINTS.withoutBudget} />
        <Stat label="Dentro do teto" value={count(data.budgetWithin)} note={percent(share(data.budgetWithin, data.withBudget))} hint={STAT_HINTS.within} />
      </div>
      <div className={styles.board}>
        <Panel title="Jornada do método" hint="Percentual dos usuários em cada passo. O passo não exige que os anteriores estejam feitos.">
          <KpiBarChart points={points(data.journey)} format={percent} />
          <MetricTable rows={data.journey} quantity="Usuários" />
        </Panel>
        <Panel title="Orçamento deste mês" hint="Quem gravou o orçamento da competência atual e quem ainda não gravou.">
          <KpiPieChart
            points={[
              { key: 'with', label: 'Com orçamento', value: data.withBudget },
              { key: 'without', label: 'Sem orçamento', value: data.withoutBudget },
            ]}
          />
          <SimpleTable
            headers={[
              { text: 'Situação', hint: 'Recorte da competência atual.' },
              { text: 'Usuários', hint: STAT_HINTS.users },
              { text: 'Índice', hint: 'Usuários da situação divididos por todos os usuários ativos.' },
            ]}
            rows={[
              [{ text: 'Com orçamento', hint: STAT_HINTS.withBudget }, count(data.withBudget), percent(share(data.withBudget, data.accounts))],
              [{ text: 'Sem orçamento', hint: STAT_HINTS.withoutBudget }, count(data.withoutBudget), percent(share(data.withoutBudget, data.accounts))],
            ]}
          />
        </Panel>
        <Panel title="Teto do orçamento" hint="Só entra quem tem orçamento neste mês.">
          <KpiPieChart
            points={[
              { key: 'within', label: 'Dentro do teto', value: data.budgetWithin },
              { key: 'over', label: 'Acima do teto', value: data.budgetOver },
              { key: 'empty', label: 'Orçamento vazio', value: data.budgetEmpty },
            ]}
          />
          <SimpleTable
            headers={[
              'Situação',
              'Usuários',
              { text: 'Índice', hint: 'Dividido por quem tem orçamento neste mês, não por todos os usuários.' },
            ]}
            rows={[
              [
                { text: 'Dentro do teto', hint: STAT_HINTS.within },
                count(data.budgetWithin),
                percent(share(data.budgetWithin, data.withBudget)),
              ],
              [
                {
                  text: 'Acima do teto',
                  hint: 'Quem orçou neste mês e o gasto nas seções do método passou da soma do previsto.',
                },
                count(data.budgetOver),
                percent(share(data.budgetOver, data.withBudget)),
              ],
              [
                {
                  text: 'Orçamento vazio',
                  hint: 'Quem tem orçamento neste mês, mas a soma do previsto é zero.',
                },
                count(data.budgetEmpty),
                percent(share(data.budgetEmpty, data.withBudget)),
              ],
            ]}
          />
        </Panel>
        <Panel title={`Mês anterior (${data.previousCompetenceYm})`} hint="A base muda de linha para linha. O hint de cada indicador diz qual é.">
          <KpiBarChart points={points(data.previousMonth, 'count')} />
          <MetricTable rows={data.previousMonth} quantity="Usuários" />
        </Panel>
        <Panel title="Conquistas do método" hint="Usuários que alcançaram o marco ao menos uma vez.">
          <KpiBarChart points={points(data.achievements)} format={percent} />
          <MetricTable rows={data.achievements} quantity="Usuários" />
        </Panel>
      </div>
    </div>
  )
}

function UsageTab({ data }: { data: ConsoleKpis }) {
  return (
    <div className={styles.stack}>
      <div className={`${layout.grid3} ${styles.stats}`}>
        <Stat label="Ativos hoje" value={count(data.active1d)} note={percent(share(data.active1d, data.accounts))} hint={STAT_HINTS.active1} />
        <Stat label="Ativos em 7 dias" value={count(data.active7d)} note={percent(share(data.active7d, data.accounts))} hint={STAT_HINTS.active7} />
        <Stat label="Ativos em 30 dias" value={count(data.active30d)} note={percent(share(data.active30d, data.accounts))} hint={STAT_HINTS.active30} />
      </div>
      <div className={styles.board}>
        <Panel title="Uso por funcionalidade" hint="Últimos 30 dias. Usuários distintos e registros atualizados." wide>
          <KpiBarChart points={data.features.map((row) => ({ key: row.key, label: row.label, value: row.users }))} />
          <FeatureTable rows={data.features} />
        </Panel>
        <Panel title="Atividade em 12 semanas" hint="Semana começa na segunda, em UTC. Ativo é quem alterou algum registro naquela semana." wide>
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
      </div>
    </div>
  )
}

function EvolutionTab({
  data,
  months,
  onMonths,
}: {
  data: ConsoleKpis
  months: number
  onMonths: (value: number) => void
}) {
  const window = data.months.slice(-months)
  const categories = window.map((month) => monthLabel(month.competenceYm))
  const counts: KpiSeries[] = MONTH_COUNTS.map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    values: window.map(item.pick),
  }))
  const rates: KpiSeries[] = MONTH_RATES.map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    values: window.map(item.pick),
  }))

  return (
    <div className={styles.stack}>
      <label className={`${layout.periodSlider} ${styles.slider}`}>
        <span className={layout.periodSliderValue}>{months === 1 ? 'Mês atual' : `Últimos ${months} meses`}</span>
        <span className={layout.periodSliderEnds} aria-hidden>
          {MONTHS_MIN}
        </span>
        <input
          type="range"
          min={MONTHS_MIN}
          max={MONTHS_MAX}
          step={1}
          value={months}
          aria-label="Meses a acompanhar"
          aria-valuemin={MONTHS_MIN}
          aria-valuemax={MONTHS_MAX}
          aria-valuenow={months}
          aria-valuetext={months === 1 ? 'Mês atual' : `Últimos ${months} meses`}
          onChange={(event) => onMonths(Number(event.target.value))}
        />
        <span className={layout.periodSliderEnds} aria-hidden>
          {MONTHS_MAX}
        </span>
      </label>
      <div className={styles.board}>
        <Panel title="Quantidade por mês" hint="A base de cada mês são os usuários que já existiam até o fim daquele mês." wide>
          <KpiMultiLineChart categories={categories} series={counts} />
        </Panel>
        <Panel
          title="Índices por mês"
          hint="Orçamento sobre a base do mês. Dentro do teto sobre quem orçou. Fechamento sobre quem lançou."
          wide
        >
          <KpiMultiLineChart categories={categories} series={rates} />
          <MonthTable rows={window} />
        </Panel>
      </div>
    </div>
  )
}

function ErrorsTab({ data }: { data: ConsoleKpis }) {
  return (
    <div className={styles.stack}>
      <div className={`${layout.grid3} ${styles.stats}`}>
        <Stat label="Erros em 7 dias" value={count(data.errors7d)} hint={STAT_HINTS.errors7} />
        <Stat label="Erros em 30 dias" value={count(data.errors30d)} hint={STAT_HINTS.errors30} />
      </div>
      <div className={styles.board}>
        <Panel title="Erros por dia" hint="Últimos 14 dias. O histórico começa a contar a partir desta versão." wide>
          <KpiLineChart points={points(data.errorDays, 'count')} />
          <MetricTable rows={data.errorDays} quantity="Erros" />
        </Panel>
        <Panel title="Erros por funcionalidade" hint="Últimos 30 dias, agrupados pela área da API.">
          <KpiBarChart points={points(data.errorsByArea, 'count')} />
          <MetricTable rows={data.errorsByArea} quantity="Erros" />
        </Panel>
        <Panel title="Erros por tipo" hint="Código e título, sem a mensagem original.">
          <KpiBarChart points={points(data.errorsByStatus, 'count')} />
          <MetricTable rows={data.errorsByStatus} quantity="Erros" />
        </Panel>
        <Panel title="Detalhe dos erros" hint="Quantidade por dia, tipo e área." wide>
          <SimpleTable
            headers={['Dia', 'Tipo', 'Área', 'Quantidade']}
            rows={data.errorRows.map((row) => [row.day, `${row.statusCode} ${row.title}`, row.area, count(row.count)])}
          />
        </Panel>
      </div>
    </div>
  )
}

function Stat({ label, value, note, hint }: { label: string; value: string; note?: string; hint?: string }) {
  return (
    <div className={layout.stat}>
      <Tip text={label} hint={hint} />
      <strong>{value}</strong>
      {note ? <span>{note}</span> : null}
    </div>
  )
}

function Panel({ title, hint, wide, children }: { title: string; hint: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={[layout.section, wide ? styles.wide : ''].filter(Boolean).join(' ')}>
      <h2 className={layout.sectionTitle}>{title}</h2>
      <p className={layout.muted}>{hint}</p>
      {children}
    </section>
  )
}

function MetricTable({ rows, quantity }: { rows: ConsoleMetric[]; quantity: string }) {
  return (
    <SimpleTable
      headers={[
        { text: 'Indicador', hint: 'Passe o mouse no nome para ver a regra do cálculo.' },
        { text: quantity, hint: quantity === 'Usuários' ? 'Cadastros distintos que cumpriram a regra.' : 'Falhas de API no recorte.' },
        { text: 'Base', hint: 'Denominador do índice. A regra de cada linha diz quem entra na base.' },
        { text: 'Índice', hint: 'Quantidade dividida pela base.' },
      ]}
      rows={rows.map((row) => [
        { text: row.label, hint: metricHint(row) },
        count(row.count),
        count(row.base),
        percent(row.percent),
      ])}
    />
  )
}

function FeatureTable({ rows }: { rows: ConsoleFeature[] }) {
  return (
    <SimpleTable
      headers={[
        'Funcionalidade',
        { text: 'Usuários', hint: 'Usuários distintos que atualizaram a funcionalidade nos últimos 30 dias.' },
        { text: 'Registros', hint: 'Registros atualizados. Não é contagem de cliques.' },
        { text: 'Índice', hint: 'Usuários da funcionalidade divididos por todos os usuários ativos.' },
      ]}
      rows={rows.map((row) => [
        { text: row.label, hint: FEATURE_HINTS[row.key] ?? row.label },
        count(row.users),
        count(row.events),
        percent(row.percent),
      ])}
    />
  )
}

function WeekTable({ rows }: { rows: ConsoleWeek[] }) {
  return (
    <SimpleTable
      headers={[
        'Semana',
        { text: 'Novos usuários', hint: 'Cadastros criados na semana.' },
        { text: 'Ativos', hint: 'Usuários distintos que alteraram algum registro na semana.' },
        { text: 'Orçamentos', hint: 'Orçamentos criados na semana, não usuários distintos.' },
        { text: 'Fechamentos', hint: 'Meses fechados na semana.' },
        { text: 'Erros', hint: 'Falhas de API na semana.' },
      ]}
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

function MonthTable({ rows }: { rows: ConsoleMonth[] }) {
  return (
    <SimpleTable
      headers={[
        'Mês',
        { text: 'Base', hint: 'Usuários que já existiam até o fim daquele mês.' },
        { text: 'Com orçamento', hint: 'Usuários com orçamento gravado naquela competência.' },
        { text: 'Sem orçamento', hint: 'Base menos quem orçou.' },
        { text: 'Dentro do teto', hint: 'Quem orçou e o gasto não passou do previsto.' },
        { text: 'Acima do teto', hint: 'Quem orçou e o gasto passou do previsto.' },
        { text: 'Orçamento vazio', hint: 'Quem tem orçamento, mas o previsto somado é zero.' },
        { text: 'Com lançamento', hint: 'Usuários com algum lançamento na competência.' },
        { text: 'Fechado', hint: 'Usuários que fecharam aquele mês.' },
        { text: 'Fechado no teto', hint: 'Meses fechados em que o gasto ficou dentro do previsto.' },
        { text: 'Novos usuários', hint: 'Cadastros criados dentro do mês.' },
        { text: 'Erros', hint: 'Falhas de API com data dentro do mês.' },
        { text: 'Índice de orçamento', hint: 'Com orçamento dividido pela base do mês.' },
        { text: 'Índice do teto', hint: 'Dentro do teto dividido por quem orçou.' },
        { text: 'Índice de fechamento', hint: 'Mês fechado dividido por quem lançou.' },
      ]}
      rows={rows.map((row) => [
        monthLabel(row.competenceYm),
        count(row.base),
        count(row.withBudget),
        count(row.withoutBudget),
        count(row.budgetWithin),
        count(row.budgetOver),
        count(row.budgetEmpty),
        count(row.withEntry),
        count(row.closed),
        count(row.closedWithin),
        count(row.signups),
        count(row.errors),
        percent(row.budgetPercent),
        percent(row.withinPercent),
        percent(row.closedPercent),
      ])}
    />
  )
}

function SimpleTable({ headers, rows }: { headers: Cell[]; rows: Cell[][] }) {
  if (rows.length === 0) {
    return <p className={layout.muted}>Nenhum registro.</p>
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={cellText(header)} scope="col">
                <CellView cell={header} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${cellText(row[0])}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellText(headers[cellIndex])}-${cellText(cell)}`}>
                  {cellIndex > 0 ? (
                    <span className={styles.fieldLabel}>
                      <CellView cell={headers[cellIndex]} />
                    </span>
                  ) : null}
                  <span className={styles.fieldValue}>
                    <CellView cell={cell} />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CellView({ cell }: { cell: Cell }) {
  if (typeof cell === 'string') return cell
  return <Tip text={cell.text} hint={cell.hint} />
}

function placeTip(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  const width = Math.min(320, window.innerWidth - 16)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const estimated = 128
  const below = rect.bottom + 8
  const top = below + estimated > window.innerHeight - 96 ? Math.max(8, rect.top - estimated - 8) : below
  return { top, left }
}

function coarsePointer() {
  return window.matchMedia('(pointer: coarse)').matches
}

function Tip({ text, hint }: { text: string; hint?: string }) {
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!place) return
    function close(event: Event) {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return
      setPlace(null)
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [place])

  if (!hint) return text

  return (
    <button
      ref={ref}
      type="button"
      className={styles.tip}
      aria-expanded={place !== null}
      onMouseEnter={(event) => {
        if (!coarsePointer()) setPlace(placeTip(event.currentTarget))
      }}
      onMouseLeave={() => {
        if (!coarsePointer()) setPlace(null)
      }}
      onClick={() => {
        if (!coarsePointer()) return
        setPlace((current) => (current || !ref.current ? null : placeTip(ref.current)))
      }}
    >
      {text}
      {place ? (
        <span className={styles.tipBubble} style={{ top: place.top, left: place.left }} role="tooltip">
          {hint}
        </span>
      ) : null}
    </button>
  )
}
