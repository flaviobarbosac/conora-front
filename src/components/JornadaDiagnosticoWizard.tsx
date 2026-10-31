import { useId, useState } from 'react'
import { Button } from './ui/Button'
import {
  isJornadaDiagnosticoComplete,
  JORNADA_DIAGNOSTICO_QUESTIONS,
  type JornadaDiagnosticoAnswers,
  type JornadaDiagnosticoKey,
  writeJornadaDiagnostico,
} from '../lib/jornadaDiagnostico'
import styles from './JornadaDiagnosticoWizard.module.css'

type Props = {
  initial?: JornadaDiagnosticoAnswers | null
  title?: string
  kicker?: string
  hint?: string
  submitLabel?: string
  onBack?: () => void
  onComplete: (answers: JornadaDiagnosticoAnswers) => void
}

/** All four yes/no questions on one screen; each uses a radio group (sim/não). */
export function JornadaDiagnosticoWizard({
  initial,
  title = 'Personalize sua jornada',
  kicker = 'Diagnóstico',
  hint = 'Responder “não” só marca a etapa como agora não. As categorias do plano continuam no Orçamento e no Raio-X.',
  submitLabel = 'Continuar',
  onBack,
  onComplete,
}: Props) {
  const formId = useId()
  const [answers, setAnswers] = useState<JornadaDiagnosticoAnswers>(() => ({ ...(initial ?? {}) }))
  const ready = isJornadaDiagnosticoComplete(answers)

  function setAnswer(key: JornadaDiagnosticoKey, value: boolean) {
    setAnswers((current) => ({ ...current, [key]: value }))
  }

  function submit() {
    if (!isJornadaDiagnosticoComplete(answers)) return
    writeJornadaDiagnostico(answers)
    onComplete(answers)
  }

  return (
    <section className={styles.wizardCard} aria-label="Diagnóstico da jornada">
      <header className={styles.wizardIntro}>
        <p className={styles.wizardKicker}>{kicker}</p>
        <h2 className={styles.wizardTitle}>{title}</h2>
        <p className={styles.wizardHint}>{hint}</p>
      </header>

      <div className={styles.wizardQuestions}>
        {JORNADA_DIAGNOSTICO_QUESTIONS.map((question, index) => {
          const groupName = `${formId}-${question.key}`
          const selected = answers[question.key]
          const answered = typeof selected === 'boolean'
          return (
            <fieldset
              key={question.key}
              className={answered ? `${styles.wizardFieldset} ${styles.wizardFieldsetDone}` : styles.wizardFieldset}
            >
              <legend className={styles.wizardLegend}>{question.label}</legend>
              <div className={styles.wizardAnswerBox} data-pastel={String(index + 1)}>
                <div className={styles.wizardQuestion}>
                  <span className={styles.wizardIndex} aria-hidden>
                    {index + 1}
                  </span>
                  <span className={styles.wizardQuestionText}>{question.label}</span>
                </div>
                <div className={styles.wizardRadios} role="radiogroup" aria-label={question.label}>
                  <label className={selected === true ? `${styles.wizardRadio} ${styles.wizardRadioOn}` : styles.wizardRadio}>
                    <input
                      type="radio"
                      name={groupName}
                      value="sim"
                      checked={selected === true}
                      onChange={() => setAnswer(question.key, true)}
                    />
                    <span>Sim</span>
                  </label>
                  <label className={selected === false ? `${styles.wizardRadio} ${styles.wizardRadioOn}` : styles.wizardRadio}>
                    <input
                      type="radio"
                      name={groupName}
                      value="nao"
                      checked={selected === false}
                      onChange={() => setAnswer(question.key, false)}
                    />
                    <span>Não</span>
                  </label>
                </div>
              </div>
            </fieldset>
          )
        })}
      </div>

      <div className={styles.wizardFooter}>
        {onBack ? (
          <Button type="button" variant="secondary" onClick={onBack}>
            Voltar
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={!ready}
          aria-disabled={!ready}
          title={ready ? undefined : 'Responda as quatro perguntas para continuar'}
          onClick={() => {
            if (!ready) return
            submit()
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </section>
  )
}

export function JornadaDiagnosticoSummary({
  answers,
  onEdit,
}: {
  answers: JornadaDiagnosticoAnswers
  onEdit: () => void
}) {
  return (
    <section className={styles.wizardSummary} aria-label="Resumo do diagnóstico">
      <div>
        <strong>Seu perfil na jornada</strong>
        <ul className={styles.wizardSummaryList}>
          {JORNADA_DIAGNOSTICO_QUESTIONS.map((q) => (
            <li key={q.key}>
              {shortLabel(q.key)}: <span>{answers[q.key] ? 'sim' : 'agora não'}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button type="button" variant="secondary" onClick={onEdit}>
        Refazer
      </Button>
    </section>
  )
}

function shortLabel(key: JornadaDiagnosticoKey): string {
  switch (key) {
    case 'rendaFixa':
      return 'Renda fixa'
    case 'divida':
      return 'Parcela de dívida'
    case 'patrimonio':
      return 'Patrimônio'
    case 'projetoVida':
      return 'Projeto de vida'
  }
}
