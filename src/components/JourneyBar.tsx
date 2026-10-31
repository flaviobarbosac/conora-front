import { Link } from 'react-router-dom'
import { gamificationApi, type JourneyStep } from '../api/finance'
import { useLoad } from '../hooks/useLoad'
import {
  getIanAge,
  getIanVoice,
  ianPortrait,
  IAN_MATURITY_CHANGED,
  IAN_VOICE_CHANGED,
  type IanVoiceId,
} from '../lib/speakPt'
import { useEffect, useState } from 'react'
import styles from './JourneyBar.module.css'

const STEP_HINT: Record<string, string> = {
  budget: 'Planejado do mês',
  debt: 'Parcelas na categoria Dívidas',
  patrimony: 'Passivo total no patrimônio',
  projects: 'Metas de vida',
}

export function JourneyBar() {
  const journey = useLoad(() => gamificationApi.journey(), [])
  const [age, setAge] = useState(getIanAge)
  const [voiceId, setVoiceId] = useState<IanVoiceId>(() => getIanVoice().id)
  const companionLabel = getIanVoice().label
  const steps = journey.data?.steps ?? []
  const doneCount = steps.filter((s) => s.completed).length

  useEffect(() => {
    function onMaturity() {
      setAge(getIanAge())
    }
    function onVoice() {
      setVoiceId(getIanVoice().id)
    }
    window.addEventListener(IAN_MATURITY_CHANGED, onMaturity)
    window.addEventListener(IAN_VOICE_CHANGED, onVoice)
    return () => {
      window.removeEventListener(IAN_MATURITY_CHANGED, onMaturity)
      window.removeEventListener(IAN_VOICE_CHANGED, onVoice)
    }
  }, [])

  if (journey.loading && !journey.data) {
    return null
  }
  if (!steps.length) {
    return null
  }

  return (
    <section className={styles.bar} aria-label="Jornada">
      <Link to="/" className={styles.ian}>
        <img
          className={styles.portrait}
          src={ianPortrait(voiceId)}
          alt={age === null ? companionLabel : `${companionLabel} · ${age} anos`}
          width={40}
          height={40}
        />
        <div className={styles.ianCopy}>
          <span className={styles.kicker}>Jornada Raio X</span>
          <strong>
            {doneCount}/{steps.length} passos
            {age !== null
              ? ` · ${companionLabel} ${age === 0 ? 'bebê' : `${age} anos`}`
              : ''}
          </strong>
        </div>
      </Link>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <StepLink key={step.key} step={step} index={index} />
        ))}
      </ol>
    </section>
  )
}

function StepLink({ step, index }: { step: JourneyStep; index: number }) {
  return (
    <li>
      <Link
        to={step.route}
        className={step.completed ? styles.stepDone : step.isNext ? styles.stepNext : styles.step}
        title={STEP_HINT[step.key] ?? step.title}
      >
        <span className={styles.dot} aria-hidden>
          {step.completed ? '✓' : index + 1}
        </span>
        <span className={styles.stepLabel}>{step.title}</span>
      </Link>
    </li>
  )
}
