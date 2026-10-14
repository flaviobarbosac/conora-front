import { useNavigate } from 'react-router-dom'
import { familyApi, gamificationApi, type JourneyStep } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import type { IconName } from '../icons/catalog'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

const STEP_HINT: Record<string, { hint: string; icon: IconName }> = {
  diagnosis: { hint: 'Registre de onde vem a renda.', icon: 'income' },
  budget: { hint: 'Defina o planejado do mês.', icon: 'folder' },
  card: { hint: 'Cadastre o cartão para acompanhar a fatura.', icon: 'card' },
  close: { hint: 'Feche o mês quando os lançamentos estiverem certos.', icon: 'calendar' },
  reserve: { hint: 'Separe a reserva de emergência.', icon: 'wallet' },
  projects: { hint: 'Marque um projeto de vida e a meta.', icon: 'goal' },
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const journey = useLoad(() => gamificationApi.journey(), [])
  const complete = useAction()
  const steps = journey.data?.steps ?? []
  const doneCount = steps.filter((step) => step.completed).length
  const next = steps.find((step) => step.isNext) ?? null

  async function unlock(route: string) {
    if (!(await complete.run(() => familyApi.completeOnboarding()))) {
      return
    }
    window.dispatchEvent(new Event('conora:profile-changed'))
    navigate(route, { replace: true })
  }

  function goHome() {
    void unlock('/').then(() => {
      if (!complete.error) showSaveToast('Jornada iniciada.')
    })
  }

  return (
    <div className={`${styles.page} ${styles.onboarding}`}>
      <PageHeader title="Jornada Raio X" kicker="Primeiros passos" />
      <p className={styles.muted}>
        Seis etapas do método. Comece pela próxima, ou entre no início e volte quando quiser.
      </p>
      <ErrorText message={journey.error ?? complete.error} />
      {journey.loading && !journey.data ? <Loading /> : null}

      {journey.data ? (
        <>
          <div className={styles.journeyProgress}>
            <div className={styles.journeyProgressLabel}>
              <span>
                {doneCount} de {steps.length} concluídas
              </span>
              {next ? <span>Próximo: {next.title}</span> : <span>Jornada em dia</span>}
            </div>
            <div
              className={styles.journeyTrack}
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-label="Etapas concluídas"
            >
              <span style={{ width: steps.length ? `${(doneCount / steps.length) * 100}%` : '0%' }} />
            </div>
          </div>

          <ol className={styles.journeyList}>
            {steps.map((step, index) => (
              <StepRow
                key={step.key}
                step={step}
                index={index}
                busy={complete.busy}
                onOpen={() => void unlock(step.route)}
              />
            ))}
          </ol>
        </>
      ) : null}

      <div className={styles.actions}>
        <Button variant="ghost" disabled={complete.busy || !journey.data} onClick={goHome}>
          Ir para o início
        </Button>
      </div>
    </div>
  )
}

function StepRow({
  step,
  index,
  busy,
  onOpen,
}: {
  step: JourneyStep
  index: number
  busy: boolean
  onOpen: () => void
}) {
  const copy = STEP_HINT[step.key]
  const tone = step.completed ? styles.journeyDone : step.isNext ? styles.journeyNext : styles.journeyItem
  const action = step.completed ? 'Rever' : step.isNext ? 'Começar' : 'Abrir'

  return (
    <li className={tone}>
      <button type="button" className={styles.journeyOpen} disabled={busy} onClick={onOpen}>
        <span className={styles.journeyIndex} aria-hidden="true">
          {step.completed ? '✓' : index + 1}
        </span>
        {copy ? <Icon name={copy.icon} size={20} /> : null}
        <span className={styles.journeyBody}>
          <strong>{step.title}</strong>
          <span className={styles.muted}>{copy?.hint}</span>
        </span>
        <span className={styles.journeyLink}>{action}</span>
      </button>
    </li>
  )
}
