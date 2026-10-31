import { useState } from 'react'
import {
  ianLabelForAge,
  jornadaStepAction,
  jornadaStepKind,
  jornadaStepTitle,
  jornadaTipoPointsTotal,
  JORNADA_TIPOS_ORDERED,
  portraitAgeFor,
} from '../lib/jornadaTipos'
import { journeyKindLabel, journeyPortraitUrl } from '../lib/jornadaTimeline'
import { ianPortrait, type IanVoiceId } from '../lib/speakPt'
import styles from './ConsoleJornadaTiposPage.module.css'

function chipClass(kind: ReturnType<typeof jornadaStepKind>): string {
  if (kind === 'cadastro') return `${styles.chip} ${styles.chipCadastro}`
  if (kind === 'marco') return `${styles.chip} ${styles.chipMarco}`
  if (kind === 'apex') return `${styles.chip} ${styles.chipApex}`
  return styles.chip
}

/** Admin catalog: six pre-defined Raio-X journeys side by side. */
export function ConsoleJornadaTiposPage() {
  const [character, setCharacter] = useState<IanVoiceId>('ian')
  const companionLabel = character === 'clara' ? 'Clara' : 'Ian'
  const maxSteps = Math.max(...JORNADA_TIPOS_ORDERED.map((tipo) => tipo.steps.length))

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h2 className={styles.title}>Tipos de jornada</h2>
        <p className={styles.lead}>
          Seis jornadas pré-definidas (J0–J5). O diagnóstico sim/não escolhe um pacote; a timeline e os
          pontos (máx. 1.200) seguem a coluna. Visual alinhado à Jornada Raio X.
        </p>

        <div className={styles.characterBar} role="group" aria-label="Personagem da prévia">
          <span className={styles.characterLabel}>Personagem na tabela</span>
          <div className={styles.characterRow}>
            {(
              [
                { id: 'ian' as const, label: 'Ian' },
                { id: 'clara' as const, label: 'Clara' },
              ] as const
            ).map((option) => {
              const on = character === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  className={on ? styles.pickOn : styles.pick}
                  aria-pressed={on}
                  aria-label={option.label}
                  onClick={() => setCharacter(option.id)}
                >
                  <img
                    className={styles.pickFace}
                    src={ianPortrait(option.id)}
                    alt=""
                    width={40}
                    height={40}
                  />
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            Comparativo das jornadas · personagem {companionLabel}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.stickyCol}>
                Ordem
              </th>
              {JORNADA_TIPOS_ORDERED.map((tipo) => (
                <th key={tipo.id} scope="col" className={styles.journeyHead}>
                  <span className={styles.journeyId}>{tipo.id}</span>
                  <span className={styles.journeyName}>{tipo.name}</span>
                  <span className={styles.journeyRule}>{tipo.rule}</span>
                  <span className={styles.journeyPts}>{jornadaTipoPointsTotal(tipo)} pts</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxSteps }, (_, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row" className={styles.stickyCol}>
                  {rowIndex + 1}
                </th>
                {JORNADA_TIPOS_ORDERED.map((tipo) => {
                  const step = tipo.steps[rowIndex]
                  if (!step) {
                    return (
                      <td key={tipo.id} className={styles.emptyCell}>
                        —
                      </td>
                    )
                  }
                  const kind = jornadaStepKind(step.stepId)
                  const portraitAge = portraitAgeFor(step.ianAge)
                  const showPortrait =
                    rowIndex === 0 || tipo.steps[rowIndex - 1]!.ianAge !== step.ianAge
                  return (
                    <td key={tipo.id} className={styles.cell}>
                      <article className={styles.card}>
                        <div className={styles.rail}>
                          {showPortrait ? (
                            <img
                              className={styles.portrait}
                              src={journeyPortraitUrl(portraitAge, character)}
                              alt=""
                              width={40}
                              height={40}
                            />
                          ) : (
                            <span className={styles.dot}>{rowIndex + 1}</span>
                          )}
                        </div>
                        <div className={styles.cardBody}>
                          <div className={styles.meta}>
                            <span className={chipClass(kind)}>{journeyKindLabel(kind)}</span>
                            <span className={styles.ageLabel}>
                              {companionLabel} {step.ianAge}a · {ianLabelForAge(step.ianAge)}
                            </span>
                            <span className={styles.points}>{step.points} pts</span>
                          </div>
                          <h3 className={styles.cardTitle}>{jornadaStepTitle(step.stepId)}</h3>
                          <p className={styles.cardAction}>{jornadaStepAction(step.stepId)}</p>
                        </div>
                      </article>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className={styles.narratives} aria-label="Narrativa por jornada">
        {JORNADA_TIPOS_ORDERED.map((tipo) => (
          <article key={tipo.id} className={styles.narrativeCard}>
            <h3 className={styles.narrativeTitle}>
              {tipo.id} · {tipo.name}
            </h3>
            <p className={styles.narrativeText}>{tipo.narrative}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
