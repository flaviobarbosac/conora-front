import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { familyApi, projectsApi, type LifeProject, type LifeProjectScope } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Pager } from '../components/Pager'
import { ChartAccountSelect } from '../components/ChartAccountSelect'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { Select } from '../components/ui/Select'
import { TextArea } from '../components/ui/TextArea'
import { useAction } from '../hooks/useAction'
import { useClientPagination } from '../hooks/useClientPagination'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
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
} from '../lib/format'
import { LIFE_HORIZONS, type HorizonKey } from '../lib/lifeHorizon'
import styles from './page.module.css'

function isHorizon(value: string | null): value is HorizonKey {
  return value === 'short' || value === 'mid' || value === 'long'
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const horizonte = isHorizon(searchParams.get('horizonte')) ? searchParams.get('horizonte') : null
  const projects = useLoad(() => projectsApi.list(), [])
  const [showForm, setShowForm] = useState(false)

  const list = useMemo(() => {
    const all = projects.data ?? []
    if (!horizonte) {
      return all
    }
    return all.filter((project) => project.horizon === horizonte)
  }, [projects.data, horizonte])

  const pagination = useClientPagination(list, 10)

  function setHorizonFilter(next: HorizonKey | null) {
    if (!next) {
      setSearchParams({})
      return
    }
    setSearchParams({ horizonte: next })
  }

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Metas"
        title="Projetos de vida"
        actions={
          <Button onClick={() => setShowForm((value) => !value)}>
            {showForm ? 'Fechar cadastro' : 'Novo projeto'}
          </Button>
        }
      />

      <section className={styles.horizonBlock} aria-label="Resumo por horizonte">
        {LIFE_HORIZONS.map((horizon) => {
          const items = (projects.data ?? []).filter((project) => project.horizon === horizon.key)
          const goal = items.reduce((sum, project) => sum + project.goalAmount, 0)
          const accumulated = items.reduce((sum, project) => sum + project.accumulatedAmount, 0)
          const percent = goal <= 0 ? 0 : Math.min(100, (accumulated / goal) * 100)
          const active = horizonte === horizon.key
          return (
            <button
              key={horizon.key}
              type="button"
              className={`${styles.horizonRow} ${active ? styles.horizonRowActive : ''}`}
              onClick={() => setHorizonFilter(active ? null : horizon.key)}
            >
              <span className={styles.horizonMeta}>
                <strong>{horizon.label}</strong>
                <span>
                  {items.length} {items.length === 1 ? 'projeto' : 'projetos'} · {formatMoney(accumulated)} de{' '}
                  {goal > 0 ? formatMoney(goal) : '—'} · {formatPercent(percent)}
                </span>
              </span>
              <span className={styles.progress} aria-hidden>
                <span className={styles.progressFill} style={{ width: `${percent}%` }} />
              </span>
            </button>
          )
        })}
      </section>

      <div className={styles.segmented} role="group" aria-label="Filtro por horizonte">
        <button type="button" aria-pressed={!horizonte} onClick={() => setHorizonFilter(null)}>
          Todos
        </button>
        {LIFE_HORIZONS.map((horizon) => (
          <button
            key={horizon.key}
            type="button"
            aria-pressed={horizonte === horizon.key}
            onClick={() => setHorizonFilter(horizon.key)}
          >
            {horizon.label.replace(' prazo', '')}
          </button>
        ))}
      </div>

      <ErrorText message={projects.error} />
      {projects.loading && !projects.data ? <Loading /> : null}
      {projects.data && list.length === 0 ? (
        <Empty>{horizonte ? 'Nenhum projeto neste horizonte.' : 'Nenhum projeto ainda. Crie o primeiro abaixo.'}</Empty>
      ) : null}

      {pagination.pageItems.map((project) => {
        const label = LIFE_HORIZONS.find((item) => item.key === project.horizon)?.label
        return (
          <Link key={project.id} className={`${styles.section} ${styles.projectDashCard}`} to={`/projetos/${project.id}`}>
            <div className={styles.sectionHead}>
              <span className={styles.rowMain}>
                <strong>
                  {project.name}{' '}
                  <Badge tone={project.scope === 'Group' ? 'info' : 'ok'}>
                    {project.scope === 'Group' ? 'Família' : 'Pessoal'}
                  </Badge>
                  {label ? <Badge>{label}</Badge> : null}
                </strong>
                <span className={styles.rowSub}>
                  {formatMoney(project.accumulatedAmount)} de {formatMoney(project.goalAmount)}
                  {` · até ${formatDate(project.dueDate)}`}
                  {project.chartAccountName ? ` · ${project.chartAccountName}` : ''}
                </span>
              </span>
              <strong>{formatPercent(project.progressPercent)}</strong>
            </div>
            <span className={styles.progress} aria-hidden>
              <span className={styles.progressFill} style={{ width: `${Math.min(project.progressPercent, 100)}%` }} />
            </span>
            {project.detailedDescription ? (
              <p className={styles.muted}>{project.detailedDescription.slice(0, 140)}{project.detailedDescription.length > 140 ? '…' : ''}</p>
            ) : null}
          </Link>
        )
      })}

      <Pager
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
      />

      {showForm ? (
        <ProjectForm
          existing={projects.data ?? []}
          onSaved={(id) => {
            projects.reload()
            setShowForm(false)
            navigate(`/projetos/${id}`)
          }}
        />
      ) : null}
    </div>
  )
}

function ProjectForm({ existing, onSaved }: { existing: LifeProject[]; onSaved: (id: string) => void }) {
  const family = useLoad(() => familyApi.group(), [])
  const lookups = useLookups()
  const usedAccounts = new Set(existing.map((project) => project.chartAccountId).filter(Boolean))
  const lifeAccounts = lookups.cashFlowAccounts.filter(
    (account) => account.section === 'LifeProject' && !usedAccounts.has(account.id),
  )
  const [name, setName] = useState('')
  const [detailedDescription, setDetailedDescription] = useState('')
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
    let createdId = ''
    if (
      await action.run(async () => {
        const created = await projectsApi.create({
          name: name.trim(),
          goalAmount,
          dueDate: dateToApi(`${dueYm}-01`),
          contributionStartYm: startYm,
          scope: projectScope,
          chartAccountId,
          detailedDescription: detailedDescription.trim() || undefined,
        })
        createdId = created.id
      })
    ) {
      onSaved(createdId)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Novo projeto</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
          <Field label="Nome" name="projectName" required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className={styles.formWide}>
          <TextArea
            label="Descrição detalhada"
            name="projectDescription"
            rows={4}
            value={detailedDescription}
            onChange={(event) => setDetailedDescription(event.target.value)}
            maxLength={4000}
          />
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
