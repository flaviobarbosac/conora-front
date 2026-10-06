import type { IconName } from './icons/catalog'

export const NAV_ITEMS: ReadonlyArray<{
  to: string
  label: string
  short: string
  icon: IconName
}> = [
  { to: '/', label: 'Início', short: 'Início', icon: 'home' },
  { to: '/lancamentos', label: 'Lançamentos', short: 'Lançar', icon: 'list' },
  { to: '/orcamento', label: 'Orçamento', short: 'Orçam.', icon: 'budget' },
  { to: '/contas', label: 'Contas e cartões', short: 'Contas', icon: 'card' },
  { to: '/projetos', label: 'Projetos de vida', short: 'Projetos', icon: 'goal' },
  { to: '/relatorios', label: 'Relatórios', short: 'Mais', icon: 'search' },
]
