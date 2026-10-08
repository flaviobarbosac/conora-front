import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { projectsApi, type LifeProjectScope } from '../api/finance'
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
import { confirmDestructive } from '../lib/confirm'
import {
  dateToApi,
  formatCompetence,
  formatDate,
  formatMoney,
  formatPercent,
  parseMoney,
  todayInput,
} from '../lib/format'
import { LIFE_HORIZONS } from '../lib/lifeHorizon'
import styles from './page.module.css'

export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const project = useLoad(() => projectsApi.get(id), [id])
  const lookups = useLookups()
  const remove = useAction()
  const save = useAction()
  const contribute = useAction()
  const data = project.data
  const horizonLabel = LIFE_HORIZONS.find((item) => item.key === data?.horizon)?.label

  const [description, setDescription] = useState<string | null>(null)
  const descriptionValue = description ?? data?.detailedDescription ?? ''

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayInput)
  const [accountId, setAccountId] = useState('')

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

  async function saveDescription(event: FormEvent) {
    event.preventDefault()
    if (!data?.chartAccountId) {
      return
    }
    if (
      await save.run(() =>
        projectsApi.update(data.id, {
          name: data.name,
          goalAmount: data.goalAmount,
          dueDate: data.dueDate,
          contributionStartYm: data.contributionStartYm,
          scope: data.scope as LifeProjectScope,
          chartAccountId: data.chartAccountId!,
          detailedDescription: descriptionValue.trim() || undefined,
        }),
      )
    ) {
      setDescription(null)
      project.reload()
    }
  }

  async function submitContribution(event: FormEvent) {
    event.preventDefault()
    if (!data) {
      return
    }
    const value = parseMoney(amount)
    if (!Number.isFinite(value) || value <= 0) {
      contribute.setError('Informe um valor maior que zero.')
      return
    }
    if (await contribute.run(() => projectsApi.contribute(data.id, value, dateToApi(date), accountId || undefined))) {
      setAmount('')
      project.reload()
      lookups.reloadAccounts()
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
      <ErrorText message={project.error ?? remove.error ?? save.error ?? contribute.error} />
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
                  {horizonLabel ? <Badge>{horizonLabel}</Badge> : null}
                </strong>
                <span className={styles.rowSub}>
                  {formatMoney(data.accumulatedAmount)} de {formatMoney(data.goalAmount)}
                  {` · prazo ${formatDate(data.dueDate)}`}
                  {` · aporte desde ${formatCompetence(data.contributionStartYm)}`}
                  {data.chartAccountName ? ` · ${data.chartAccountName}` : ''}
                </span>
              </span>
              <strong>{formatPercent(data.progressPercent)}</strong>
            </div>
            <span className={styles.progress} aria-hidden>
              <span className={styles.progressFill} style={{ width: `${Math.min(data.progressPercent, 100)}%` }} />
            </span>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Descrição detalhada</h2>
            {data.isOwner ? (
              <form className={styles.form} onSubmit={(event) => void saveDescription(event)}>
                <div className={styles.formWide}>
                  <TextArea
                    label="Descrição detalhada"
                    name="projectDescription"
                    rows={6}
                    value={descriptionValue}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={4000}
                  />
                </div>
                <div className={styles.formActions}>
                  <Button type="submit" disabled={save.busy}>
                    Salvar descrição
                  </Button>
                </div>
              </form>
            ) : data.detailedDescription ? (
              <p>{data.detailedDescription}</p>
            ) : (
              <p className={styles.muted}>Sem descrição detalhada.</p>
            )}
          </section>

          {data.isOwner ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Aportar</h2>
              <form className={styles.form} onSubmit={(event) => void submitContribution(event)}>
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
                  label="Conta de origem"
                  name="contribAccount"
                  required
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {lookups.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
                <div className={styles.formActions}>
                  <Button type="submit" disabled={contribute.busy}>
                    Registrar aporte
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          <p className={styles.muted}>
            <Link to="/projetos">← Ver todos os projetos</Link>
          </p>
        </>
      ) : null}
    </div>
  )
}
