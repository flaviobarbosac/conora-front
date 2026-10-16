import type { IconName } from './icons/catalog'

export type NavItem = {
  to: string
  label: string
  short: string
  icon: IconName
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Início', short: 'Início', icon: 'home' },
  { to: '/raio-x', label: 'Raio-X', short: 'Raio-X', icon: 'budget' },
  { to: '/orcamento', label: 'Orçamento', short: 'Orçam.', icon: 'folder' },
  { to: '/relatorios', label: 'Relatórios', short: 'Mais', icon: 'search' },
]

export const CADASTROS_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/contas', label: 'Contas', short: 'Contas', icon: 'card' },
  { to: '/categorias', label: 'Categorias', short: 'Categorias', icon: 'folder' },
  { to: '/marcos', label: 'Marcos', short: 'Marcos', icon: 'bell' },
  { to: '/projetos', label: 'Projetos de vida', short: 'Projetos', icon: 'goal' },
  { to: '/patrimonio', label: 'Patrimônio', short: 'Patrim.', icon: 'wallet' },
  { to: '/membros', label: 'Membros', short: 'Membros', icon: 'user' },
]
