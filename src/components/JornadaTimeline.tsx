import { Link } from 'react-router-dom'
import { gamificationApi } from '../api/finance'
import { useLoad } from '../hooks/useLoad'
import {
  JORNADA_TIMELINE,
  journeyKindLabel,
  journeyPortraitUrl,
  type JourneyStepKind,
  type JourneyTimelineStep,
} from '../lib/jornadaTimeline'
import { maturityAgeFromAchievements } from '../lib/speakPt'
import page from '../pages/page.module.css'
import { Button } from './ui/Button'
import { ErrorText, Loading } from './ui/Feedback'
import styles from './JornadaTimeline.module.css'

function chipClass(kind: JourneyStepKind): string {
  if (kind === 'cadastro') return `${styles.chip} ${styles.chipCadastro}`
  if (kind === 'marco') return `${styles.chip} ${styles.chipMarco}`
  if (kind === 'apex') return `${styles.chip} ${styles.chipApex}`
  return styles.chip
}

type Props = {
  /** Home: close control. Full /jornada page: omit. */
  onClose?: () => void
  showProgressHeader?: boolean
}

export function JornadaTimeline({ onClose, showProgressHeader = true }: Props) {
  const journey = useLoad(() => gamificationApi.journey(), [])
  const achievements = useLoad(() => gamificationApi.achievements(), [])

  const journeyByKey = new Map((journey.data?.steps ?? []).map((s) => [s.key, s]))
  const earned = new Set(
    (achievements.data?.items ?? []).filter((i) => i.earned).map((i) => i.key),
  )

  const maturityAge = maturityAgeFromAchievements(achievements.data?.items ?? [])

  function isDone(step: JourneyTimelineStep): boolean {
    if (step.kind === 'start') return true
    if (step.journeyKey) {
      return journeyByKey.get(step.journeyKey)?.completed === true
    }
    if (step.achievementKeys?.length) {
      return step.achievementKeys.some((key) => earned.has(key))
    }
    return false
  }

  const doneFlags = JORNADA_TIMELINE.map(isDone)
  const nextIndex = doneFlags.findIndex((done) => !done)
  const doneCount = doneFlags.filter(Boolean).length
  const pct = Math.round((doneCount / JORNADA_TIMELINE.length) * 100)
  const loading = (journey.loading && !journey.data) || (achievements.loading && !achievements.data)

  return (
    <div className={styles.wrap}>
      {onClose ? (
        <div className={styles.homeToolbar}>
          <p className={styles.kicker}>Jornada Raio X</p>
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      ) : null}

      <ErrorText message={journey.error ?? achievements.error} />
      {loading ? <Loading /> : null}

      {showProgressHeader ? (
        <section className={styles.headerCard} aria-label="Progresso da jornada">
          <p className={styles.kicker}>
            Maturidade · Ian {maturityAge === 0 ? 'bebê' : `${maturityAge} anos`}
          </p>
          <p className={styles.headerTitle}>
            {doneCount} de {JORNADA_TIMELINE.length} passos · não trava lançamentos
          </p>
          <div className={page.journeyProgress}>
            <div className={page.journeyProgressLabel}>
              <span>Progresso da jornada</span>
              <span>{pct}%</span>
            </div>
            <div
              className={page.journeyTrack}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso da jornada Raio X"
            >
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        </section>
      ) : null}

      <ol className={styles.timeline} aria-label="Linha do tempo da jornada">
        {JORNADA_TIMELINE.map((step, i) => {
          const done = doneFlags[i]!
          const isNext = i === nextIndex
          const isLast = i === JORNADA_TIMELINE.length - 1
          const showAgePhoto = i === 0 || JORNADA_TIMELINE[i - 1]!.ianAge !== step.ianAge
          const cardClass = [
            styles.card,
            done ? styles.cardDone : '',
            isNext ? styles.cardNext : '',
            isLast ? styles.cardLast : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <li key={step.id} className={styles.row}>
              <div className={styles.rail} aria-hidden>
                {showAgePhoto ? (
                  <img
                    className={`${styles.portrait}${isNext ? ` ${styles.portraitNext}` : ''}`}
                    src={journeyPortraitUrl(step.ianAge)}
                    alt=""
                    width={40}
                    height={40}
                  />
                ) : (
                  <span
                    className={`${styles.dot}${done ? ` ${styles.dotDone}` : ''}${
                      isNext ? ` ${styles.dotNext}` : ''
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                )}
                {!isLast ? (
                  <span className={`${styles.line}${done ? ` ${styles.lineDone}` : ''}`} />
                ) : null}
              </div>

              <article className={cardClass}>
                <div className={styles.meta}>
                  <span className={chipClass(step.kind)}>{journeyKindLabel(step.kind)}</span>
                  <span className={styles.ageLabel}>
                    Ian {step.ianAge}a · {step.ianLabel}
                  </span>
                </div>
                <h2 className={styles.cardTitle}>{step.title}</h2>
                <p className={styles.cardAction}>{step.action}</p>
                {isNext ? <p className={styles.cardBody}>{step.body}</p> : null}
                {isNext && step.route && step.kind === 'cadastro' ? (
                  <Link className={styles.cta} to={step.route}>
                    {step.action}
                  </Link>
                ) : null}
                {isNext && step.kind === 'apex' && step.route ? (
                  <Link className={styles.cta} to={step.route}>
                    Ver projetos
                  </Link>
                ) : null}
              </article>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
