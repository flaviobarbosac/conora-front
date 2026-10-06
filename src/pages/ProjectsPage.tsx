import { useState, type FormEvent } from 'react'
import { projectsApi, type Account, type LifeProject } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { dateToApi, formatDate, formatMoney, formatPercent, parseMoney, todayInput } from '../lib/format'
import styles from './page.module.css'

export function ProjectsPage() {
  const projects = useLoad(() => projectsApi.list(), [])
  const lookups = useLookups()
  const remove = useAction()

  async function removeProject(project: LifeProject) {
    if (window.confirm(`Excluir o projeto "${project.name}"?`) && (await remove.run(() => projectsApi.remove(project.id)))) {
      projects.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader kicker="Metas" title="Projetos de vida" />
      <ErrorText message={projects.error ?? remove.error} />
      {projects.loading && !projects.data ? <Loading /> : null}
      {projects.data && projects.data.length === 0 ? <Empty>Nenhum projeto ainda. Crie o primeiro abaixo.</Empty> : null}
      {projects.data?.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          accounts={lookups.accounts}
          onChanged={() => {
            projects.reload()
            lookups.reloadAccounts()
          }}
          onRemove={() => void removeProject(project)}
        />
      ))}
      <ProjectForm onSaved={projects.reload} />
    </div>
  )
}

type CardProps = {
  project: LifeProject
  accounts: Account[]
  onChanged: () => void
  onRemove: () => void
}

function ProjectCard({ project, accounts, onChanged, onRemove }: CardProps) {
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
          <strong>{project.name}</strong>
          <span className={styles.rowSub}>
            {formatMoney(project.accumulatedAmount)} de {formatMoney(project.goalAmount)}
            {project.dueDate ? ` · até ${formatDate(project.dueDate)}` : ''}
          </span>
        </span>
        <span className={styles.rowEnd}>
          <strong>{formatPercent(project.progressPercent)}</strong>
          <Button variant="secondary" className={styles.compact} onClick={() => setOpen((value) => !value)}>
            Aportar
          </Button>
          <Button variant="ghost" onClick={onRemove}>
            Excluir
          </Button>
        </span>
      </div>
      <span className={styles.progress} aria-hidden>
        <span className={styles.progressFill} style={{ width: `${Math.min(project.progressPercent, 100)}%` }} />
      </span>
      {open ? (
        <form className={styles.form} onSubmit={(event) => void contribute(event)}>
          <Field label="Valor (R$)" name={`contribAmount-${project.id}`} inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
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

function ProjectForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [dueDate, setDueDate] = useState('')
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const goalAmount = parseMoney(goal)
    if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
      action.setError('Informe uma meta maior que zero.')
      return
    }
    if (await action.run(() => projectsApi.create(name.trim(), goalAmount, dueDate ? dateToApi(dueDate) : undefined))) {
      setName('')
      setGoal('')
      setDueDate('')
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
        <Field label="Meta (R$)" name="projectGoal" inputMode="decimal" required value={goal} onChange={(event) => setGoal(event.target.value)} />
        <Field label="Prazo (opcional)" name="projectDue" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
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
