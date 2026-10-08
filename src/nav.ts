import type { IconName } from './icons/catalog'

export type NavItem = {
  to: string
  label: string
  short: string
  icon: IconName
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Início', short: 'Início', icon: 'home' },
  { to: '/lancamentos', label: 'Lançamentos', short: 'Lançar', icon: 'list' },
  { to: '/orcamento', label: 'Orçamento', short: 'Orçam.', icon: 'budget' },
  { to: '/relatorios', label: 'Relatórios', short: 'Mais', icon: 'search' },
]

export const CADASTROS_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/contas', label: 'Contas', short: 'Contas', icon: 'card' },
  { to: '/cartoes', label: 'Cartões', short: 'Cartões', icon: 'card' },
  { to: '/plano-de-contas', label: 'Plano de contas', short: 'Plano', icon: 'folder' },
  { to: '/projetos', label: 'Projetos de vida', short: 'Projetos', icon: 'goal' },
  { to: '/patrimonio', label: 'Patrimônio', short: 'Patrim.', icon: 'wallet' },
  { to: '/membros', label: 'Membros', short: 'Membros', icon: 'user' },
]
