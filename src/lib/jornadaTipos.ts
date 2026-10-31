import type { JornadaDiagnosticoAnswers } from './jornadaDiagnostico'
import { isJornadaDiagnosticoComplete } from './jornadaDiagnostico'
import { JORNADA_TIMELINE, type JourneyStepKind, type JourneyTimelineStep } from './jornadaTimeline'

/** Same ages as Ian portrait assets (keep local to avoid speakPt → api client in unit tests). */
const PORTRAIT_AGES = [0, 5, 8, 10, 12, 15, 18, 22, 30] as const
export type PortraitAge = (typeof PORTRAIT_AGES)[number]

/** Pre-defined Raio-X journeys selected by diagnosis answers (admin catalog). */

export type JornadaTipoId = 'J0' | 'J1' | 'J2' | 'J3' | 'J4' | 'J5'

export type JornadaTipoStep = {
  stepId: string
  ianAge: number
  points: number
}

export type JornadaTipo = {
  id: JornadaTipoId
  name: string
  /** Human rule: when this package is chosen. */
  rule: string
  narrative: string
  steps: readonly JornadaTipoStep[]
}

const byId = new Map(JORNADA_TIMELINE.map((s) => [s.id, s]))

export function jornadaStepTitle(stepId: string): string {
  return byId.get(stepId)?.title ?? stepId
}

export function jornadaStepKind(stepId: string): JourneyStepKind {
  return byId.get(stepId)?.kind ?? 'marco'
}

export function jornadaStepAction(stepId: string): string {
  return byId.get(stepId)?.action ?? ''
}

export function ianLabelForAge(age: number): string {
  if (age <= 0) return 'Bebê'
  if (age <= 8) return 'Criança'
  if (age <= 12) return 'Pré-adolescente'
  if (age <= 15) return 'Adolescente'
  if (age <= 18) return 'Jovem'
  if (age < 30) return 'Jovem adulto'
  return 'Adulto'
}

/** Snap planned age to an existing Ian portrait asset. */
export function portraitAgeFor(age: number): PortraitAge {
  let best: PortraitAge = PORTRAIT_AGES[0]
  let bestDist = Math.abs(best - age)
  for (const candidate of PORTRAIT_AGES) {
    const dist = Math.abs(candidate - age)
    if (dist < bestDist) {
      best = candidate
      bestDist = dist
    }
  }
  return best
}

export function jornadaTipoPointsTotal(tipo: JornadaTipo): number {
  return tipo.steps.reduce((sum, step) => sum + step.points, 0)
}

/**
 * Classification priority: J3 → J4 → J2 → J1 → J5 → J0
 * Incomplete diagnosis falls back to J0 (Padrão Conora).
 */
export function resolveJornadaTipoId(answers: JornadaDiagnosticoAnswers | null): JornadaTipoId {
  if (!isJornadaDiagnosticoComplete(answers) || !answers) {
    return 'J0'
  }
  const renda = answers.rendaFixa === true
  const divida = answers.divida === true
  const patrimonio = answers.patrimonio === true
  const projeto = answers.projetoVida === true

  if (!renda) return 'J3'
  if (divida && !patrimonio) return 'J4'
  if (renda && divida && patrimonio && projeto) return 'J2'
  if (!patrimonio) return 'J1'
  if (projeto && patrimonio) return 'J5'
  return 'J0'
}

export function getJornadaTipo(id: JornadaTipoId): JornadaTipo {
  return JORNADA_TIPOS.find((tipo) => tipo.id === id) ?? JORNADA_TIPOS.find((tipo) => tipo.id === 'J0')!
}

export function resolveJornadaTipo(answers: JornadaDiagnosticoAnswers | null): JornadaTipo {
  return getJornadaTipo(resolveJornadaTipoId(answers))
}

/** Timeline step shaped for home/Raio-X UI, with package ages and points. */
export type JornadaTipoTimelineStep = JourneyTimelineStep & {
  /** Planned age in the package (may not match a portrait file). */
  displayAge: number
  points: number
  portraitAge: PortraitAge
}

export function buildJornadaTipoTimeline(tipo: JornadaTipo): JornadaTipoTimelineStep[] {
  return tipo.steps.map((step) => {
    const base = byId.get(step.stepId)
    const portraitAge = portraitAgeFor(step.ianAge)
    return {
      id: step.stepId,
      kind: base?.kind ?? 'marco',
      title: base?.title ?? step.stepId,
      ianAge: portraitAge,
      displayAge: step.ianAge,
      ianLabel: ianLabelForAge(step.ianAge),
      body: base?.body ?? '',
      action: base?.action ?? '',
      journeyKey: base?.journeyKey,
      route: base?.route,
      achievementKeys: base?.achievementKeys,
      points: step.points,
      portraitAge,
    }
  })
}

export const JORNADA_TIPOS: readonly JornadaTipo[] = [
  {
    id: 'J0',
    name: 'Padrão Conora',
    rule: 'Qualquer combinação restante',
    narrative:
      'Caminho default do produto. Cadastros + marcos + reserva até o ápice — maturidade financeira.',
    steps: [
      { stepId: 'start', ianAge: 0, points: 0 },
      { stepId: 'budget', ianAge: 5, points: 120 },
      { stepId: 'debt', ianAge: 5, points: 100 },
      { stepId: 'patrimony', ianAge: 8, points: 100 },
      { stepId: 'projects', ianAge: 8, points: 100 },
      { stepId: 'first-month', ianAge: 10, points: 120 },
      { stepId: 'three-months', ianAge: 12, points: 120 },
      { stepId: 'on-time', ianAge: 15, points: 120 },
      { stepId: 'reserve-start', ianAge: 18, points: 100 },
      { stepId: 'reserve-complete', ianAge: 22, points: 120 },
      { stepId: 'apex', ianAge: 30, points: 200 },
    ],
  },
  {
    id: 'J1',
    name: 'Construtor de patrimônio',
    rule: 'patrimonio = não (e não caiu em J3/J4)',
    narrative:
      'De “não tenho patrimônio” a construir ativo e reserva. Maturidade = patrimônio + reserva completa + projeto possível.',
    steps: [
      { stepId: 'start', ianAge: 0, points: 0 },
      { stepId: 'budget', ianAge: 5, points: 140 },
      { stepId: 'debt', ianAge: 7, points: 80 },
      { stepId: 'first-month', ianAge: 10, points: 100 },
      { stepId: 'three-months', ianAge: 12, points: 100 },
      { stepId: 'on-time', ianAge: 15, points: 100 },
      { stepId: 'reserve-start', ianAge: 18, points: 140 },
      { stepId: 'patrimony', ianAge: 20, points: 180 },
      { stepId: 'projects', ianAge: 22, points: 80 },
      { stepId: 'reserve-complete', ianAge: 26, points: 140 },
      { stepId: 'apex', ianAge: 30, points: 140 },
    ],
  },
  {
    id: 'J2',
    name: 'Equilíbrio completo',
    rule: 'sim nas quatro perguntas',
    narrative:
      'Já tem os quatro eixos. Trilha clássica e balanceada até o adulto (Ian 30).',
    steps: [
      { stepId: 'start', ianAge: 0, points: 0 },
      { stepId: 'budget', ianAge: 5, points: 100 },
      { stepId: 'debt', ianAge: 5, points: 100 },
      { stepId: 'patrimony', ianAge: 8, points: 100 },
      { stepId: 'projects', ianAge: 8, points: 100 },
      { stepId: 'first-month', ianAge: 10, points: 120 },
      { stepId: 'three-months', ianAge: 12, points: 120 },
      { stepId: 'on-time', ianAge: 15, points: 120 },
      { stepId: 'reserve-start', ianAge: 18, points: 100 },
      { stepId: 'reserve-complete', ianAge: 22, points: 140 },
      { stepId: 'apex', ianAge: 30, points: 200 },
    ],
  },
  {
    id: 'J3',
    name: 'Controle de despesas',
    rule: 'rendaFixa = não (prioridade alta)',
    narrative:
      'Sem renda fixa: dominar a saída. Maturidade = mês sob controle + reserva + clareza de patrimônio/projeto.',
    steps: [
      { stepId: 'start', ianAge: 0, points: 0 },
      { stepId: 'budget', ianAge: 5, points: 180 },
      { stepId: 'first-month', ianAge: 10, points: 140 },
      { stepId: 'debt', ianAge: 12, points: 80 },
      { stepId: 'three-months', ianAge: 14, points: 140 },
      { stepId: 'on-time', ianAge: 16, points: 120 },
      { stepId: 'patrimony', ianAge: 18, points: 100 },
      { stepId: 'reserve-start', ianAge: 20, points: 100 },
      { stepId: 'projects', ianAge: 22, points: 80 },
      { stepId: 'reserve-complete', ianAge: 26, points: 120 },
      { stepId: 'apex', ianAge: 30, points: 140 },
    ],
  },
  {
    id: 'J4',
    name: 'Alívio de dívida',
    rule: 'divida = sim e patrimonio = não (se também sem renda fixa → J3)',
    narrative:
      'Tirar o peito da dívida sem perder o mês. Maturidade = dívida tratada + orçamento em dia + reserva + patrimônio começa.',
    steps: [
      { stepId: 'start', ianAge: 0, points: 0 },
      { stepId: 'debt', ianAge: 5, points: 180 },
      { stepId: 'budget', ianAge: 8, points: 160 },
      { stepId: 'first-month', ianAge: 10, points: 120 },
      { stepId: 'on-time', ianAge: 13, points: 140 },
      { stepId: 'three-months', ianAge: 15, points: 100 },
      { stepId: 'reserve-start', ianAge: 18, points: 100 },
      { stepId: 'projects', ianAge: 20, points: 80 },
      { stepId: 'patrimony', ianAge: 22, points: 120 },
      { stepId: 'reserve-complete', ianAge: 26, points: 100 },
      { stepId: 'apex', ianAge: 30, points: 100 },
    ],
  },
  {
    id: 'J5',
    name: 'Meta / projeto de vida',
    rule: 'projetoVida = sim e patrimonio = sim e não é J2',
    narrative:
      'Já tem chão (patrimônio); empurra o projeto sem pular orçamento e constância. Maturidade = progresso no projeto + reserva + uso pleno.',
    steps: [
      { stepId: 'start', ianAge: 0, points: 0 },
      { stepId: 'budget', ianAge: 5, points: 120 },
      { stepId: 'projects', ianAge: 8, points: 180 },
      { stepId: 'debt', ianAge: 10, points: 80 },
      { stepId: 'patrimony', ianAge: 12, points: 100 },
      { stepId: 'first-month', ianAge: 14, points: 100 },
      { stepId: 'three-months', ianAge: 16, points: 100 },
      { stepId: 'on-time', ianAge: 18, points: 100 },
      { stepId: 'reserve-start', ianAge: 20, points: 100 },
      { stepId: 'reserve-complete', ianAge: 24, points: 120 },
      { stepId: 'apex', ianAge: 30, points: 200 },
    ],
  },
] as const

/** Display order in admin: J0 … J5 */
export const JORNADA_TIPOS_ORDERED: readonly JornadaTipo[] = [...JORNADA_TIPOS].sort((a, b) =>
  a.id.localeCompare(b.id),
)
