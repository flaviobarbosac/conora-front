import type { IanAge, IanVoiceId } from './speakPt'

export type JourneyStepKind = 'start' | 'cadastro' | 'marco' | 'apex'

export type JourneyTimelineStep = {
  id: string
  kind: JourneyStepKind
  title: string
  ianAge: IanAge
  ianLabel: string
  body: string
  action: string
  journeyKey?: string
  route?: string
  achievementKeys?: readonly string[]
}

/** Raio-X journey timeline — single source for home and related UI. */
export const JORNADA_TIMELINE: JourneyTimelineStep[] = [
  {
    id: 'start',
    kind: 'start',
    title: 'Você nasceu aqui',
    ianAge: 0,
    ianLabel: 'Bebê',
    body: 'Estado inicial após o onboard. Ian começa bebê. A linha do tempo mostra o caminho até o adulto.',
    action: 'Início da jornada',
  },
  {
    id: 'budget',
    kind: 'cadastro',
    title: 'Orçamento',
    ianAge: 5,
    ianLabel: 'Criança',
    body: 'Renda, descontos e despesas. Primeira aula do Raio-X. Parcela mensal de dívida também entra aqui.',
    action: 'Cadastrar orçamento',
    journeyKey: 'budget',
    route: '/orcamento',
  },
  {
    id: 'debt',
    kind: 'cadastro',
    title: 'Dívidas (parcela mensal)',
    ianAge: 5,
    ianLabel: 'Criança',
    body: 'Parcelas do mês na categoria Dívidas. Separado do valor total da dívida.',
    action: 'Cadastrar dívidas',
    journeyKey: 'debt',
    route: '/orcamento',
  },
  {
    id: 'patrimony',
    kind: 'cadastro',
    title: 'Patrimônio',
    ianAge: 8,
    ianLabel: 'Criança',
    body: 'Ativo e passivo total (ex.: 20× R$ 1.000 → R$ 20 mil no passivo).',
    action: 'Cadastrar patrimônio',
    journeyKey: 'patrimony',
    route: '/patrimonio',
  },
  {
    id: 'projects',
    kind: 'cadastro',
    title: 'Projetos de vida',
    ianAge: 8,
    ianLabel: 'Criança',
    body: 'Fecha o bloco do Raio-X. Completar os 4 cadastros não vira adulto sozinho.',
    action: 'Cadastrar projetos',
    journeyKey: 'projects',
    route: '/projetos',
  },
  {
    id: 'first-month',
    kind: 'marco',
    title: 'Fechar o 1º mês',
    ianAge: 10,
    ianLabel: 'Pré-adolescente',
    body: 'Marco de constância. Não se pula etapa no dia 1.',
    action: 'Marco do sistema',
    achievementKeys: ['first-month-closed'],
  },
  {
    id: 'three-months',
    kind: 'marco',
    title: 'Três meses no orçamento',
    ianAge: 12,
    ianLabel: 'Pré-adolescente',
    body: 'Maturidade exige constância. Não adulto no 1º/2º mês.',
    action: 'Marco do sistema',
    achievementKeys: ['three-months-in-budget'],
  },
  {
    id: 'on-time',
    kind: 'marco',
    title: 'Pagamentos e orçamento em dia',
    ianAge: 15,
    ianLabel: 'Adolescente',
    body: 'Retrato e voz acompanham a idade.',
    action: 'Marco do sistema',
    achievementKeys: ['payment-on-time', 'budget-on-time'],
  },
  {
    id: 'reserve-start',
    kind: 'marco',
    title: 'Reserva iniciada',
    ianAge: 18,
    ianLabel: 'Jovem',
    body: 'Avanço na maturidade sem travar o aplicativo.',
    action: 'Marco do sistema',
    achievementKeys: ['reserve-started', 'has-reserve'],
  },
  {
    id: 'reserve-complete',
    kind: 'marco',
    title: 'Reserva completa',
    ianAge: 22,
    ianLabel: 'Jovem adulto',
    body: 'Cumprir o 22 pode levar direto ao 30 (ápice).',
    action: 'Marco do sistema',
    achievementKeys: ['reserve-complete'],
  },
  {
    id: 'apex',
    kind: 'apex',
    title: 'Progresso em projeto · Ápice',
    ianAge: 30,
    ianLabel: 'Adulto',
    body: 'Ian adulto. Cadastros + marcos. Uso pleno. Congela no ápice.',
    action: 'Uso pleno',
    achievementKeys: ['project-progress'],
    route: '/projetos',
  },
]

export function journeyKindLabel(kind: JourneyStepKind): string {
  if (kind === 'start') return 'Início'
  if (kind === 'cadastro') return 'Cadastro'
  if (kind === 'marco') return 'Marco'
  return 'Ápice'
}

export function journeyPortraitUrl(age: IanAge, voiceId: IanVoiceId = 'ian'): string {
  const base = voiceId === 'clara' ? 'ian-menina' : 'ian-garoto'
  return `${import.meta.env.BASE_URL}assets/${base}-${String(age).padStart(2, '0')}.png`
}
