/** Yes/no profile that adapts the Raio-X journey order (never hides essential chart categories). */

export type JornadaDiagnosticoKey = 'rendaFixa' | 'divida' | 'patrimonio' | 'projetoVida'

export type JornadaDiagnosticoAnswers = Partial<Record<JornadaDiagnosticoKey, boolean>>

export type JornadaDiagnosticoQuestion = {
  key: JornadaDiagnosticoKey
  label: string
  /** Timeline step id from jornadaTimeline that this answer highlights. */
  stepId: string
}

export const JORNADA_DIAGNOSTICO_QUESTIONS: readonly JornadaDiagnosticoQuestion[] = [
  {
    key: 'rendaFixa',
    label: 'Você tem renda fixa todo mês (salário, pró-labore, aposentadoria)?',
    stepId: 'budget',
  },
  {
    key: 'divida',
    label: 'Você paga alguma parcela de dívida neste mês?',
    stepId: 'debt',
  },
  {
    key: 'patrimonio',
    label: 'Você quer cadastrar patrimônio (bens e dívidas totais)?',
    stepId: 'patrimony',
  },
  {
    key: 'projetoVida',
    label: 'Você tem um projeto de vida com meta e prazo?',
    stepId: 'projects',
  },
] as const

const STORAGE_KEY = 'conora.jornadaDiagnostico'

export function readJornadaDiagnostico(): JornadaDiagnosticoAnswers | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as JornadaDiagnosticoAnswers
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function writeJornadaDiagnostico(answers: JornadaDiagnosticoAnswers): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
}

export function isJornadaDiagnosticoComplete(answers: JornadaDiagnosticoAnswers | null): boolean {
  if (!answers) return false
  return JORNADA_DIAGNOSTICO_QUESTIONS.every((q) => typeof answers[q.key] === 'boolean')
}

/**
 * Steps marked "agora não" (answer === false). They stay on the timeline;
 * they are not deleted and chart categories stay visible everywhere else.
 */
export function deferredStepIds(answers: JornadaDiagnosticoAnswers | null): Set<string> {
  const deferred = new Set<string>()
  if (!answers) return deferred
  for (const q of JORNADA_DIAGNOSTICO_QUESTIONS) {
    if (answers[q.key] === false) {
      deferred.add(q.stepId)
    }
  }
  return deferred
}

/** Cadastro steps with "sim" come first; "agora não" follow; start/marco/apex keep relative order. */
export function orderTimelineStepIds(
  stepIds: readonly string[],
  answers: JornadaDiagnosticoAnswers | null,
): string[] {
  if (!answers || !isJornadaDiagnosticoComplete(answers)) {
    return [...stepIds]
  }
  const deferred = deferredStepIds(answers)
  const priority = new Map(
    JORNADA_DIAGNOSTICO_QUESTIONS.map((q, index) => [q.stepId, index] as const),
  )
  const start = stepIds.filter((id) => id === 'start')
  const cadastro = stepIds.filter((id) => priority.has(id))
  const rest = stepIds.filter((id) => id !== 'start' && !priority.has(id))
  const yes = cadastro
    .filter((id) => !deferred.has(id))
    .sort((a, b) => (priority.get(a) ?? 0) - (priority.get(b) ?? 0))
  const no = cadastro
    .filter((id) => deferred.has(id))
    .sort((a, b) => (priority.get(a) ?? 0) - (priority.get(b) ?? 0))
  return [...start, ...yes, ...no, ...rest]
}
