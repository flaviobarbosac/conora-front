import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { familyApi, projectsApi, type Account, type LifeProject, type LifeProjectScope } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Pager } from '../components/Pager'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { ChartAccountSelect } from '../components/ChartAccountSelect'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useClientPagination } from '../hooks/useClientPagination'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { confirmDestructive } from '../lib/confirm'
import {
  currentCompetence,
  dateToApi,
  formatCompetence,
  formatDate,
  formatMoney,
  formatPercent,
  monthsInclusive,
  parseMoney,
  shiftCompetence,
  todayInput,
} from '../lib/format'
import { LIFE_HORIZONS, horizonCodeOf, horizonLabelOf, type HorizonKey } from '../lib/lifeHorizon'
import styles from './page.module.css'

export function ProjectsPage() {
  const [searchParams] = useSearchParams()
  const horizonte = searchParams.get('horizonte') as HorizonKey | null
  const projects = useLoad(() => projectsApi.list(), [])
  const lookups = useLookups()
  const remove = useAction()
  const list = useMemo(() => {
    const all = projects.data ?? []
    if (!horizonte) {
      return all
    }
    const code = LIFE_HORIZONS.find((item) => item.key === horizonte)?.code
    if (!code) {
      return all
    }
    return all.filter((project) => horizonCodeOf(project.chartAccountId, lookups.chartAccounts) === code)
  }, [projects.data, horizonte, lookups.chartAccounts])
  const pagination = useClientPagination(list, 10)
  const title = LIFE_HORIZONS.find((item) => item.key === horizonte)?.label

  async function removeProject(project: LifeProject) {
    if (!(await confirmDestructive(`Excluir o projeto "${project.name}"?`, { title: 'Excluir projeto' }))) {
      return
    }
    if (await remove.run(() => projectsApi.remove(project.id))) {
      projects.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader kicker="Metas" title={title ? `Projetos · ${title}` : 'Projetos de vida'} />
      <ErrorText message={projects.error ?? remove.error} />
      {projects.loading && !projects.data ? <Loading /> : null}
      {projects.data && list.length === 0 ? <Empty>Nenhum projeto neste horizonte.</Empty> : null}
      {pagination.pageItems.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          horizon={horizonLabelOf(project.chartAccountId, lookups.chartAccounts)}
          accounts={lookups.accounts}
          onChanged={() => {
            projects.reload()
            lookups.reloadAccounts()
          }}
          onRemove={() => void removeProject(project)}
        />
      ))}
      <Pager
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
      />
      <ProjectForm existing={projects.data ?? []} onSaved={projects.reload} />
    </div>
  )
}

type CardProps = {
  project: LifeProject
  horizon: string | null
  accounts: Account[]
  onChanged: () => void
  onRemove: () => void
}

function ProjectCard({ project, horizon, accounts, onChanged, onRemove }: CardProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayInput)
  const [accountId, setAccountId] = useState('')
  const action = useAction()

  async function contribute(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (!Number.isFinite(value) || value <= 0) {
      action.setError('Informe um valor maior que zero.')
      return
    }
    if (await action.run(() => projectsApi.contribute(project.id, value, dateToApi(date), accountId || undefined))) {
      setAmount('')
      setOpen(false)
      onChanged()
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.rowMain}>
          <strong>
            {project.name}{' '}
            <Badge tone={project.scope === 'Group' ? 'info' : 'ok'}>
              {project.scope === 'Group' ? 'Família' : 'Pessoal'}
            </Badge>
            {horizon ? <Badge>{horizon}</Badge> : null}
          </strong>
          <span className={styles.rowSub}>
            {formatMoney(project.accumulatedAmount)} de {formatMoney(project.goalAmount)}
            {` · até ${formatDate(project.dueDate)}`}
            {project.chartAccountName ? ` · ${project.chartAccountName}` : ''}
          </span>
        </span>
        <span className={styles.rowEnd}>
          <strong>{formatPercent(project.progressPercent)}</strong>
          <Button variant="secondary" className={styles.compact} onClick={() => setOpen((value) => !value)}>
            Aportar
          </Button>
          <DeleteIconButton onClick={onRemove} />
        </span>
      </div>
      <span className={styles.progress} aria-hidden>
        <span className={styles.progressFill} style={{ width: `${Math.min(project.progressPercent, 100)}%` }} />
      </span>
      {open ? (
        <form className={styles.form} onSubmit={(event) => void contribute(event)}>
          <MoneyField label="Valor (R$)" name={`contribAmount-${project.id}`} required value={amount} onChange={setAmount} />
          <Field label="Data" name={`contribDate-${project.id}`} type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
          <Select label="Conta de origem" name={`contribAccount-${project.id}`} required value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Selecione</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <div className={styles.formWide}>
            <ErrorText message={action.error} />
          </div>
          <div className={styles.formActions}>
            <Button type="submit" disabled={action.busy}>
              Registrar aporte
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

function ProjectForm({ existing, onSaved }: { existing: LifeProject[]; onSaved: () => void }) {
  const family = useLoad(() => familyApi.group(), [])
  const lookups = useLookups()
  const usedAccounts = new Set(existing.map((project) => project.chartAccountId).filter(Boolean))
  const lifeAccounts = lookups.cashFlowAccounts.filter(
    (account) => account.section === 'LifeProject' && !usedAccounts.has(account.id),
  )
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [dueYm, setDueYm] = useState('')
  const [startYm, setStartYm] = useState(() => shiftCompetence(currentCompetence(), 1))
  const [scope, setScope] = useState<LifeProjectScope>('Personal')
  const [chartAccountId, setChartAccountId] = useState('')
  const action = useAction()
  const hasFamilyGroup = Boolean(family.data?.groupId)
  const currentYm = currentCompetence()
  const months = dueYm ? monthsInclusive(startYm, dueYm) : []
  const goalAmount = parseMoney(goal)
  const parcel = months.length > 0 && Number.isFinite(goalAmount) && goalAmount > 0 ? goalAmount / months.length : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
      action.setError('Informe uma meta maior que zero.')
      return
    }
    if (!chartAccountId) {
      action.setError('Escolha a conta do plano de contas.')
      return
    }
    if (!dueYm) {
      action.setError('Informe o prazo.')
      return
    }
    if (startYm < currentYm) {
      action.setError('O início do aporte não pode ser antes do mês atual.')
      return
    }
    if (startYm > dueYm) {
      action.setError('O início do aporte não pode ser depois do prazo.')
      return
    }
    const projectScope = scope === 'Group' && hasFamilyGroup ? 'Group' : 'Personal'
    if (
      await action.run(() =>
        projectsApi.create(name.trim(), goalAmount, dateToApi(`${dueYm}-01`), startYm, projectScope, chartAccountId),
      )
    ) {
      setName('')
      setGoal('')
      setDueYm('')
      setStartYm(shiftCompetence(currentCompetence(), 1))
      setScope('Personal')
      setChartAccountId('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Novo projeto</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
          <Field label="Nome" name="projectName" required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <ChartAccountSelect
          label="Conta do plano"
          name="projectChartAccount"
          required
          value={chartAccountId}
          onChange={setChartAccountId}
          options={lifeAccounts}
          tree={lookups.chartAccounts}
          emptyLabel="Selecione"
        />
        <Select
          label="Escopo"
          name="projectScope"
          value={scope}
          onChange={(event) => setScope(event.target.value as LifeProjectScope)}
        >
          <option value="Personal">Pessoal</option>
          <option value="Group" disabled={!hasFamilyGroup}>
            Família{hasFamilyGroup ? '' : ' (entre no grupo primeiro)'}
          </option>
        </Select>
        <MoneyField label="Meta (R$)" name="projectGoal" required value={goal} onChange={setGoal} />
        <Field
          label="Prazo"
          name="projectDue"
          type="month"
          required
          value={dueYm}
          min={startYm || currentYm}
          onChange={(event) => setDueYm(event.target.value)}
        />
        <Field
          label="Início do aporte"
          name="projectStart"
          type="month"
          required
          value={startYm}
          min={currentYm}
          max={dueYm || undefined}
          onChange={(event) => setStartYm(event.target.value)}
        />
        {parcel !== null ? (
          <p className={`${styles.muted} ${styles.formWide}`}>
            Parcela sugerida: {formatMoney(parcel)}/mês · {months.length} {months.length === 1 ? 'mês' : 'meses'} (de{' '}
            {formatCompetence(months[0])} até {formatCompetence(months[months.length - 1])})
          </p>
        ) : null}
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Criar projeto
          </Button>
        </div>
      </form>
    </section>
  )
}
