import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { familyApi, projectsApi, type LifeProject, type LifeProjectScope } from '../api/finance'
import { CategorySelect } from '../components/CategorySelect'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { Select } from '../components/ui/Select'
import { TextArea } from '../components/ui/TextArea'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import {
  dateToApi,
  formatCompetence,
  formatDate,
  formatMoney,
  formatMoneyInput,
  formatPercent,
  monthsInclusive,
  parseMoney,
  todayInput,
} from '../lib/format'
import {
  horizonBadgeClass,
  isProjectExtrapolated,
  LIFE_HORIZONS,
  projectFillClass,
} from '../lib/lifeHorizon'
import styles from './page.module.css'

function ymFromIso(iso: string | null | undefined): string {
  return iso?.slice(0, 7) ?? ''
}

export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const project = useLoad(() => projectsApi.get(id), [id])
  const remove = useAction()
  const data = project.data
  const horizonLabel = LIFE_HORIZONS.find((item) => item.key === data?.horizon)?.label

  async function removeProject() {
    if (!data) {
      return
    }
    if (!(await confirmDestructive(`Excluir o projeto "${data.name}"?`, { title: 'Excluir projeto' }))) {
      return
    }
    if (await remove.run(() => projectsApi.remove(data.id))) {
      navigate('/projetos')
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Metas"
        title={data?.name ?? 'Projeto'}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/projetos')}>
              Voltar ao dashboard
            </Button>
            {data?.isOwner ? <DeleteIconButton onClick={() => void removeProject()} /> : null}
          </>
        }
      />
      <ErrorText message={project.error ?? remove.error} />
      {project.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.rowMain}>
                <strong>
                  {data.name}{' '}
                  <Badge tone={data.scope === 'Group' ? 'info' : 'ok'}>
                    {data.scope === 'Group' ? 'Família' : 'Pessoal'}
                  </Badge>
                  {horizonLabel && data.horizon ? (
                    <span className={`${styles.badge} ${horizonBadgeClass(styles, data.horizon)}`}>{horizonLabel}</span>
                  ) : null}
                  {isProjectExtrapolated(data) ? (
                    <span className={`${styles.badge} ${styles.badge_danger}`}>Acima da meta</span>
                  ) : null}
                </strong>
                <span className={styles.rowSub}>
                  {formatMoney(data.accumulatedAmount)} de {formatMoney(data.goalAmount)}
                  {` · prazo ${formatDate(data.dueDate)}`}
                  {` · aporte desde ${formatCompetence(data.contributionStartYm)}`}
                  {data.categoryName ? ` · ${data.categoryName}` : ''}
                </span>
              </span>
              <strong>{formatPercent(data.progressPercent)}</strong>
            </div>
            <span className={styles.progress} aria-hidden>
              <span
                className={`${styles.progressFill} ${projectFillClass(styles, data)}`}
                style={{ width: `${Math.min(data.progressPercent, 100)}%` }}
              />
            </span>
          </section>

          {data.isOwner ? (
            <>
              <ProjectEditForm key={`${data.id}-${data.categoryId}`} data={data} onSaved={() => project.reload()} />
              <ContributeForm key={`contrib-${data.id}`} data={data} onSaved={() => project.reload()} />
            </>
          ) : (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Descrição detalhada</h2>
              {data.detailedDescription ? <p>{data.detailedDescription}</p> : <p className={styles.muted}>Sem descrição detalhada.</p>}
            </section>
          )}

          <p className={styles.muted}>
            <Link to="/projetos">← Ver todos os projetos</Link>
          </p>
        </>
      ) : null}
    </div>
  )
}

function ProjectEditForm({ data, onSaved }: { data: LifeProject; onSaved: () => void }) {
  const family = useLoad(() => familyApi.group(), [])
  const save = useAction()
  const [name, setName] = useState(data.name)
  const [detailedDescription, setDetailedDescription] = useState(data.detailedDescription ?? '')
  const [scope, setScope] = useState<LifeProjectScope>(data.scope)
  const hasFamilyGroup = Boolean(family.data?.groupId)
  const months = monthsInclusive(data.contributionStartYm, ymFromIso(data.dueDate))
  const parcel = months.length > 0 ? data.goalAmount / months.length : null
  const isDirty = useMemo(
    () =>
      name.trim() !== data.name ||
      (detailedDescription.trim() || '') !== (data.detailedDescription ?? '').trim() ||
      scope !== data.scope,
    [name, detailedDescription, scope, data],
  )

  useRegisterDirty(`project-edit:${data.id}`, isDirty)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const projectScope = scope === 'Group' && hasFamilyGroup ? 'Group' : 'Personal'
    if (
      await save.run(() =>
        projectsApi.update(data.id, {
          name: name.trim(),
          goalAmount: data.goalAmount,
          dueDate: data.dueDate,
          contributionStartYm: data.contributionStartYm,
          scope: projectScope,
          categoryId: data.categoryId ?? undefined,
          detailedDescription: detailedDescription.trim() || undefined,
        }),
      )
    ) {
      showSaveToast('Projeto salvo.')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Editar projeto</h2>
      <p className={styles.muted}>
        Meta, prazo, início e conta ficam fixos depois da criação. O previsto no orçamento vem do rateio automático.
      </p>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
          <Field label="Nome" name="projectName" required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className={styles.formWide}>
          <TextArea
            label="Descrição detalhada"
            name="projectDescription"
            rows={5}
            value={detailedDescription}
            onChange={(event) => setDetailedDescription(event.target.value)}
            maxLength={4000}
          />
        </div>
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
        <Field label="Categoria" name="projectCategoryLocked" value={data.categoryName ?? '—'} disabled readOnly />
        <MoneyField label="Meta (R$)" name="projectGoal" value={formatMoneyInput(data.goalAmount)} disabled onChange={() => undefined} />
        <Field label="Prazo" name="projectDue" type="month" value={ymFromIso(data.dueDate)} disabled readOnly />
        <Field
          label="Início do aporte"
          name="projectStart"
          type="month"
          value={data.contributionStartYm}
          disabled
          readOnly
        />
        {parcel !== null ? (
          <p className={`${styles.muted} ${styles.formWide}`}>
            Parcela no orçamento: {formatMoney(parcel)}/mês · {months.length}{' '}
            {months.length === 1 ? 'mês' : 'meses'} (de {formatCompetence(months[0])} até{' '}
            {formatCompetence(months[months.length - 1])})
          </p>
        ) : null}
        <div className={styles.formWide}>
          <ErrorText message={save.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={save.busy || !isDirty}>
            Salvar projeto
          </Button>
        </div>
      </form>
    </section>
  )
}

function ContributeForm({ data, onSaved }: { data: LifeProject; onSaved: () => void }) {
  const lookups = useLookups()
  const contribute = useAction()
  const lifeAccounts = lookups.cashFlowAccounts.filter((account) => account.section === 'LifeProject')
  const bankAccounts = lookups.accounts.filter((account) => !account.isArchived)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayInput)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState(data.categoryId ?? '')
  const initialDate = useState(todayInput)[0]
  const isDirty = useMemo(
    () => amount.trim() !== '' || date !== initialDate || accountId !== '',
    [amount, date, initialDate, accountId],
  )
  useRegisterDirty(`project-contribute:${data.id}`, isDirty)

  useEffect(() => {
    setCategoryId(data.categoryId ?? '')
  }, [data.categoryId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (!Number.isFinite(value) || value <= 0) {
      contribute.setError('Informe um valor maior que zero.')
      return
    }
    if (!accountId) {
      contribute.setError('Escolha a conta bancária de origem.')
      return
    }
    if (!categoryId) {
      contribute.setError('Escolha a categoria.')
      return
    }
    if (
      await contribute.run(() =>
        projectsApi.contribute(data.id, {
          amount: value,
          occurredAt: dateToApi(date),
          accountId,
          categoryId,
        }),
      )
    ) {
      setAmount('')
      showSaveToast('Aporte registrado com sucesso.')
      onSaved()
      lookups.reloadAccounts()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Aportar</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <MoneyField label="Valor (R$)" name="contribAmount" required value={amount} onChange={setAmount} />
        <Field
          label="Data"
          name="contribDate"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Select
          label="Conta bancária"
          name="contribBankAccount"
          required
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">Selecione</option>
          {bankAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.bankName ? ` · ${account.bankName}` : ''}
            </option>
          ))}
        </Select>
        <CategorySelect
          label="Categoria"
          name="contribCategory"
          required
          disabled
          value={categoryId}
          onChange={setCategoryId}
          options={lifeAccounts}
          tree={lookups.categories}
        />
        <div className={styles.formWide}>
          <ErrorText message={contribute.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={contribute.busy}>
            Registrar aporte
          </Button>
        </div>
      </form>
    </section>
  )
}
