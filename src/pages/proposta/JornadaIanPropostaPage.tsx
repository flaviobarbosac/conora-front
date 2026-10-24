import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Feedback'
import { Field } from '../../components/ui/Field'
import { IntegerField } from '../../components/ui/IntegerField'
import { MoneyField } from '../../components/ui/MoneyField'
import { IAN_AGES, type IanAge } from '../../lib/speakPt'
import page from '../page.module.css'
import styles from './JornadaIanPropostaPage.module.css'

type StepId = 'budget' | 'debt' | 'patrimony' | 'projects'

type Step = {
  id: StepId
  title: string
  hint: string
  cta: string
}

const STEPS: Step[] = [
  {
    id: 'budget',
    title: 'Orçamento',
    hint: 'Renda, descontos e despesas. Conta como feito com 50% das categorias analíticas preenchidas.',
    cta: 'Cadastrar orçamento',
  },
  {
    id: 'debt',
    title: 'Dívida mensal',
    hint: 'Parcelas do mês na categoria Dívidas, fora do Essencial.',
    cta: 'Cadastrar dívida mensal',
  },
  {
    id: 'patrimony',
    title: 'Patrimônio · passivo total',
    hint: 'Ativo e o passivo total (ex.: 20 parcelas × valor).',
    cta: 'Cadastrar passivo',
  },
  {
    id: 'projects',
    title: 'Projetos de vida',
    hint: 'Metas de curto, médio e longo prazo.',
    cta: 'Cadastrar projeto',
  },
]

const AGE_LABEL: Record<number, string> = {
  0: 'Bebê',
  5: 'Criança',
  8: 'Criança',
  10: 'Pré-adolescente',
  12: 'Pré-adolescente',
  15: 'Adolescente',
  18: 'Jovem',
  22: 'Jovem adulto',
  30: 'Adulto',
}

function portraitUrl(age: IanAge): string {
  return `${import.meta.env.BASE_URL}assets/ian-garoto-${String(age).padStart(2, '0')}.png`
}

function ageFromScore(score: number): IanAge {
  const idx = Math.min(IAN_AGES.length - 1, Math.floor((score / 100) * (IAN_AGES.length - 1)))
  return IAN_AGES[idx]!
}

export function JornadaIanPropostaPage() {
  const [done, setDone] = useState<Record<StepId, boolean>>({
    budget: false,
    debt: false,
    patrimony: false,
    projects: false,
  })
  const [budgetPct, setBudgetPct] = useState(0)
  const [monthsInBudget, setMonthsInBudget] = useState(0)
  const [open, setOpen] = useState<StepId | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const doneCount = Object.values(done).filter(Boolean).length
  const score = useMemo(() => {
    const stepShare = doneCount / 4
    const monthShare = Math.min(monthsInBudget, 3) / 3
    const budgetGate = budgetPct >= 50 ? 1 : budgetPct / 50
    return Math.round((stepShare * 0.4 + monthShare * 0.45 + budgetGate * 0.15) * 100)
  }, [doneCount, monthsInBudget, budgetPct])

  const age = ageFromScore(score)

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  function saveStep(id: StepId) {
    if (id === 'budget') {
      const next = Math.max(budgetPct, 50)
      setBudgetPct(next)
      setDone((current) => ({ ...current, budget: true }))
      setMonthsInBudget((m) => (m < 1 ? 1 : m))
      flash(`Orçamento ok (${next}%). Marco: ${Math.max(monthsInBudget, 1)}/3 meses.`)
    } else {
      setDone((current) => ({ ...current, [id]: true }))
      flash('Cadastro feito nesta tela.')
    }
    setOpen(null)
  }

  return (
    <div className={`${page.page} ${styles.wrap}`}>
      <PageHeader
        kicker="Proposta · design Conora"
        title="Jornada + maturidade do Ian"
      />
      <p className={page.muted}>
        Uma tela só: os quatro passos da jornada, os marcos que evoluem o Ian, e cadastro no clique.
        O onboard obrigatório fica em outra tela. Isto não trava o app.
      </p>

      <section className={styles.hero} aria-label="Ian e maturidade">
        <img
          className={styles.portrait}
          src={portraitUrl(age)}
          alt={`Ian na fase ${AGE_LABEL[age] ?? age}`}
          width={96}
          height={96}
        />
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Maturidade · {AGE_LABEL[age] ?? `${age} anos`}</p>
          <h2 className={page.sectionTitle}>Ian · {age === 0 ? 'começando' : `${age} anos`}</h2>
          <p className={page.muted}>
            Três meses no orçamento avançam o marco. Orçamento conta com 50% das categorias analíticas.
          </p>
          <div className={styles.progressBlock}>
            <div className={page.journeyProgressLabel}>
              <span>Progresso da maturidade</span>
              <span>{score}%</span>
            </div>
            <div
              className={page.journeyTrack}
              role="progressbar"
              aria-valuenow={score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Maturidade do Ian"
            >
              <span style={{ width: `${score}%` }} />
            </div>
            <div className={styles.ageRow} aria-hidden>
              <span>Bebê</span>
              <span>Criança</span>
              <span>Jovem</span>
              <span>Adulto</span>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.rules}>
        <div className={styles.rule}>
          <strong>Marco · 3 meses</strong>
          <span className={page.muted}>Não vira adulto no primeiro mês. Constância no orçamento.</span>
        </div>
        <div className={styles.rule}>
          <strong>Orçamento · 50%</strong>
          <span className={page.muted}>Metade das categorias analíticas ativas preenchidas.</span>
        </div>
      </div>

      <section className={styles.journeySection} aria-label="Jornada">
        <div className={page.journeyProgress}>
          <div className={page.journeyProgressLabel}>
            <span>
              {doneCount} de {STEPS.length} passos
            </span>
            <span>{monthsInBudget}/3 meses no orçamento</span>
          </div>
          <div
            className={page.journeyTrack}
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
          >
            <span style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
          </div>
        </div>

        <ol className={page.journeyList}>
          {STEPS.map((step, index) => {
            const isDone = done[step.id]
            const tone = isDone ? page.journeyDone : open === step.id ? page.journeyNext : page.journeyItem
            return (
              <li key={step.id} className={tone}>
                <button
                  type="button"
                  className={page.journeyOpen}
                  onClick={() => setOpen(step.id)}
                >
                  <span className={page.journeyIndex} aria-hidden>
                    {isDone ? '✓' : index + 1}
                  </span>
                  <span className={page.journeyBody}>
                    <strong>{step.title}</strong>
                    <span className={page.muted}>{step.hint}</span>
                  </span>
                  <Badge tone={isDone ? 'ok' : 'info'}>{isDone ? 'Feito' : 'Cadastrar'}</Badge>
                </button>
                <p className={styles.stepCta}>{isDone ? 'Revisar cadastro →' : `${step.cta} →`}</p>
              </li>
            )
          })}
        </ol>
      </section>

      <div className={page.formActions}>
        <Button
          variant="secondary"
          onClick={() => {
            setBudgetPct(50)
            setDone((c) => ({ ...c, budget: true }))
            setMonthsInBudget((m) => Math.max(1, m))
            flash('Orçamento marcado com 50%.')
          }}
        >
          Demo · orçamento 50%
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (!done.budget) {
              flash('Complete o orçamento (50%) antes.')
              return
            }
            setMonthsInBudget((m) => Math.min(3, m + 1))
            flash(`Meses no orçamento: ${Math.min(3, monthsInBudget + 1)}/3`)
          }}
        >
          Demo · +1 mês
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setDone({ budget: false, debt: false, patrimony: false, projects: false })
            setBudgetPct(0)
            setMonthsInBudget(0)
            setOpen(null)
            flash('Demo reiniciada.')
          }}
        >
          Reiniciar
        </Button>
      </div>

      {open ? (
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <div className={styles.sheetCard}>
            <h2 id="sheet-title" className={page.sectionTitle}>
              {STEPS.find((s) => s.id === open)?.title}
            </h2>
            <p className={page.muted}>Cadastro nesta tela, com os mesmos padrões do app. Não trava o restante.</p>
            <SheetFields step={open} />
            <div className={page.formActions}>
              <Button variant="secondary" onClick={() => setOpen(null)}>
                Cancelar
              </Button>
              <Button onClick={() => saveStep(open)}>Salvar neste passo</Button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      ) : null}
    </div>
  )
}

function SheetFields({ step }: { step: StepId }) {
  if (step === 'budget') {
    return (
      <div className={page.form}>
        <IntegerField label="Categorias preenchidas (%)" name="pct" value="50" onChange={() => undefined} maxLength={3} />
        <Field label="Competência" name="ym" type="month" defaultValue="2026-10" />
      </div>
    )
  }
  if (step === 'debt') {
    return (
      <div className={page.form}>
        <Field label="Descrição" name="debtName" defaultValue="Empréstimo consignado" />
        <MoneyField label="Valor mensal (R$)" name="debtAmount" value="1.000,00" onChange={() => undefined} />
      </div>
    )
  }
  if (step === 'patrimony') {
    return (
      <div className={page.form}>
        <Field label="Nome do passivo" name="liability" defaultValue="Empréstimo consignado" />
        <MoneyField label="Valor total (R$)" name="total" value="20.000,00" onChange={() => undefined} />
        <IntegerField label="Parcelas restantes" name="parcels" value="20" onChange={() => undefined} maxLength={3} />
      </div>
    )
  }
  return (
    <div className={page.form}>
      <Field label="Nome" name="project" defaultValue="Carro" />
      <MoneyField label="Meta (R$)" name="goal" value="150.000,00" onChange={() => undefined} />
      <Field label="Prazo" name="due" type="month" defaultValue="2028-12" />
    </div>
  )
}
