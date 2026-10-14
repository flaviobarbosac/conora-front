import { Link, useNavigate } from 'react-router-dom'
import { familyApi, gamificationApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

export function OnboardingPage() {
  const navigate = useNavigate()
  const journey = useLoad(() => gamificationApi.journey(), [])
  const complete = useAction()

  async function finish() {
    if (await complete.run(() => familyApi.completeOnboarding())) {
      showSaveToast('Jornada iniciada.')
      window.dispatchEvent(new Event('conora:profile-changed'))
      navigate('/', { replace: true })
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Jornada Raio X"
        kicker="Primeiros passos"
        actions={
          <Button variant="secondary" disabled={complete.busy} onClick={() => void finish()}>
            Pular por agora
          </Button>
        }
      />
      <p className={styles.muted}>
        O Conora acompanha o método, não o engajamento no app. Abra cada etapa quando fizer sentido.
      </p>
      <ErrorText message={journey.error ?? complete.error} />
      {journey.loading && !journey.data ? <Loading /> : null}

      {journey.data ? (
        <ol className={styles.journeyList}>
          {journey.data.steps.map((step, index) => (
            <li key={step.key} className={step.completed ? styles.journeyDone : styles.journeyItem}>
              <span className={styles.journeyIndex}>{index + 1}</span>
              <div className={styles.journeyBody}>
                <strong>{step.title}</strong>
                <span className={styles.muted}>{step.completed ? 'Concluída' : step.isNext ? 'Próximo passo' : 'Em aberto'}</span>
              </div>
              <Link to={step.route} className={styles.journeyLink}>
                Abrir
              </Link>
            </li>
          ))}
        </ol>
      ) : null}

      <div className={styles.actions}>
        <Button disabled={complete.busy} onClick={() => void finish()}>
          Continuar para o início
        </Button>
      </div>
    </div>
  )
}
