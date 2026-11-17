export type ConsoleSectionId =
  | 'metodo'
  | 'engajamento'
  | 'tendencias'
  | 'saude'
  | 'feedback'
  | 'abandonamento'
  | 'jornada-tipos'
  | 'acesso'
  | 'clientes'

export type ConsoleNavItem = {
  id: ConsoleSectionId
  to: string
  label: string
  purpose: string
}

/** Console areas grouped by operator goal — not by chart type. */
export const CONSOLE_NAV: ReadonlyArray<ConsoleNavItem> = [
  {
    id: 'metodo',
    to: '/console/metodo',
    label: 'Método',
    purpose: 'Quem está no caminho do orçamento e do teto.',
  },
  {
    id: 'engajamento',
    to: '/console/engajamento',
    label: 'Engajamento',
    purpose: 'Quem usa o app e o que toca.',
  },
  {
    id: 'tendencias',
    to: '/console/tendencias',
    label: 'Tendências',
    purpose: 'Evolução mês a mês.',
  },
  {
    id: 'saude',
    to: '/console/saude',
    label: 'Saúde',
    purpose: 'Falhas da API.',
  },
  {
    id: 'feedback',
    to: '/console/feedback',
    label: 'Feedback',
    purpose: 'Ouvir e responder usuários.',
  },
  {
    id: 'abandonamento',
    to: '/console/abandonamento',
    label: 'Abandono',
    purpose: 'Quem entra no grátis, onde para e se registra.',
  },
  {
    id: 'jornada-tipos',
    to: '/console/jornada-tipos',
    label: 'Tipos de jornada',
    purpose: 'Seis jornadas pré-definidas (J0–J5) lado a lado.',
  },
  {
    id: 'acesso',
    to: '/console/acesso',
    label: 'Acesso',
    purpose: 'Conceder prazo ou estender a degustação de um usuário.',
  },
  {
    id: 'clientes',
    to: '/console/clientes',
    label: 'Clientes',
    purpose: 'Meses que os clientes compartilharam e a entrada na conta deles.',
  },
]
