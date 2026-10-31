import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { gamificationApi } from '../api/finance'
import { useLoad } from '../hooks/useLoad'
import {
  deferredStepIds,
  isJornadaDiagnosticoComplete,
  readJornadaDiagnostico,
  type JornadaDiagnosticoAnswers,
} from '../lib/jornadaDiagnostico'
import {
  buildJornadaTipoTimeline,
  resolveJornadaTipo,
} from '../lib/jornadaTipos'
import { journeyKindLabel, journeyPortraitUrl, type JourneyStepKind } from '../lib/jornadaTimeline'
import {
  getIanVoice,
  IAN_VOICE_CHANGED,
  maturityAgeFromAchievements,
  type IanAge,
  type IanVoiceId,
} from '../lib/speakPt'
import page from '../pages/pageStyles'
import { ErrorText, Loading } from './ui/Feedback'
import styles from './JornadaTimeline.module.css'

function chipClass(kind: JourneyStepKind): string {
  if (kind === 'cadastro') return `${styles.chip} ${styles.chipCadastro}`
  if (kind === 'marco') return `${styles.chip} ${styles.chipMarco}`
  if (kind === 'apex') return `${styles.chip} ${styles.chipApex}`
  return styles.chip
}

type Props = {
  showProgressHeader?: boolean
  diagnostico?: JornadaDiagnosticoAnswers | null
}

export function JornadaTimeline({ showProgressHeader = true, diagnostico = null }: Props) {
  const journey = useLoad(() => gamificationApi.journey(), [])
  const achievements = useLoad(() => gamificationApi.achievements(), [])
  const [voiceId, setVoiceId] = useState<IanVoiceId>(() => getIanVoice().id)
  const companionLabel = getIanVoice().label

  useEffect(() => {
    function onVoice() {
      setVoiceId(getIanVoice().id)
    }
    window.addEventListener(IAN_VOICE_CHANGED, onVoice)
    return () => window.removeEventListener(IAN_VOICE_CHANGED, onVoice)
  }, [])

  const answers = useMemo(() => {
    if (diagnostico && isJornadaDiagnosticoComplete(diagnostico)) return diagnostico
    return readJornadaDiagnostico()
  }, [diagnostico])

  const tipo = useMemo(() => resolveJornadaTipo(answers), [answers])
  const timeline = useMemo(() => buildJornadaTipoTimeline(tipo), [tipo])

  const journeyByKey = new Map((journey.data?.steps ?? []).map((s) => [s.key, s]))
  const earned = new Set(
    (achievements.data?.items ?? []).filter((i) => i.earned).map((i) => i.key),
  )
  const deferred = deferredStepIds(answers)

  const maturityAge = maturityAgeFromAchievements(achievements.data?.items ?? [])

  function isDone(step: (typeof timeline)[number]): boolean {
    if (step.kind === 'start') return true
    if (step.journeyKey) {
      return journeyByKey.get(step.journeyKey)?.completed === true
    }
    if (step.achievementKeys?.length) {
      return step.achievementKeys.some((key) => earned.has(key))
    }
    return false
  }

  const doneFlags = timeline.map(isDone)
  const nextIndex = doneFlags.findIndex((done, index) => {
    if (done) return false
    const step = timeline[index]
    if (step && deferred.has(step.id)) return false
    return true
  })
  const doneCount = doneFlags.filter(Boolean).length
  const pct = Math.round((doneCount / timeline.length) * 100)
  const pointsTotal = timeline.reduce((sum, step) => sum + step.points, 0)
  const loading = (journey.loading && !journey.data) || (achievements.loading && !achievements.data)

  return (
    <div className={styles.wrap}>
      <ErrorText message={journey.error ?? achievements.error} />
      {loading ? <Loading /> : null}

      {showProgressHeader ? (
        <section className={styles.headerCard} aria-label="Progresso da jornada">
          <p className={styles.kicker}>
            {tipo.id} · {tipo.name} · Maturidade · {companionLabel}{' '}
            {maturityAge === 0 ? 'bebê' : `${maturityAge} anos`}
          </p>
          <p className={styles.headerTitle}>
            {doneCount} de {timeline.length} passos · {pointsTotal} pts · não trava lançamentos
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

      <ol className={styles.timeline} aria-label={`Linha do tempo · ${tipo.name}`}>
        {timeline.map((step, i) => {
          const done = doneFlags[i]!
          const isNext = i === nextIndex
          const isLast = i === timeline.length - 1
          const later = deferred.has(step.id) && !done
          const showAgePhoto = i === 0 || timeline[i - 1]!.displayAge !== step.displayAge
          const cardClass = [
            styles.card,
            done ? styles.cardDone : '',
            isNext ? styles.cardNext : '',
            isLast ? styles.cardLast : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <li key={`${step.id}-${i}`} className={styles.row}>
              <div className={styles.rail} aria-hidden>
                {showAgePhoto ? (
                  <img
                    className={`${styles.portrait}${isNext ? ` ${styles.portraitNext}` : ''}`}
                    src={journeyPortraitUrl(step.portraitAge as IanAge, voiceId)}
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
                    {companionLabel} {step.displayAge}a · {step.ianLabel}
                  </span>
                  {step.points > 0 ? <span className={styles.ageLabel}>{step.points} pts</span> : null}
                  {later ? <span className={chipClass('marco')}>Agora não</span> : null}
                </div>
                <h2 className={styles.cardTitle}>{step.title}</h2>
                <p className={styles.cardAction}>{later ? 'Deixado para depois' : step.action}</p>
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
