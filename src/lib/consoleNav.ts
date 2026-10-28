export type ConsoleSectionId = 'metodo' | 'engajamento' | 'tendencias' | 'saude' | 'feedback' | 'abandonamento'

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
]
