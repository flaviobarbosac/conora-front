import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { familyApi, projectsApi, type LifeProject, type LifeProjectScope } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { PaidModuleBadge } from '../components/PaidModuleBadge'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { Select } from '../components/ui/Select'
import { TextArea } from '../components/ui/TextArea'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { hasFullAccess } from '../lib/freeTier'
import { showSaveToast } from '../lib/saveToast'
import {
  formatCompetence,
  formatDate,
  formatMoney,
  formatMoneyInput,
  formatPercent,
  monthsInclusive,
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
  const { plan } = usePlanAccess()
  const canWrite = hasFullAccess(plan)
  const project = useLoad(() => projectsApi.get(id), [id])
  const remove = useAction()
  const data = project.data
  const horizonLabel = LIFE_HORIZONS.find((item) => item.key === data?.horizon)?.label

  async function removeProject() {
    if (!data || !canWrite) {
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
            {!canWrite ? <PaidModuleBadge /> : null}
            <Button variant="secondary" onClick={() => navigate('/projetos')}>
              Voltar ao dashboard
            </Button>
            {canWrite && data?.isOwner ? <DeleteIconButton onClick={() => void removeProject()} /> : null}
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
                  {`Valor original ${formatMoney(data.goalAmount)} · Valor atualizado ${formatMoney(Math.max(0, data.goalAmount - data.accumulatedAmount))}`}
                  {` · prazo ${formatDate(data.dueDate)}`}
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

          {data.isOwner && canWrite ? (
            <ProjectEditForm key={`${data.id}-${data.categoryId}`} data={data} onSaved={() => project.reload()} />
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
          categoryId: data.categoryId ?? '',
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
          label="Início do rateio"
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
