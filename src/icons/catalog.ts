export type IconName =
  | 'home'
  | 'list'
  | 'budget'
  | 'card'
  | 'goal'
  | 'add'
  | 'income'
  | 'expense'
  | 'alert'
  | 'calendar'
  | 'search'
  | 'user'

type IconDef = {
  label: string
  base: string[]
  accent: string[]
}

export const ICON_CATALOG: Record<IconName, IconDef> = {
  home: {
    label: 'Início',
    base: ['M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z'],
    accent: ['M10 20v-5h4v5'],
  },
  list: {
    label: 'Lançamentos',
    base: ['M9 6h11', 'M9 12h11', 'M9 18h11'],
    accent: ['M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
  },
  budget: {
    label: 'Orçamento',
    base: ['M12 3a9 9 0 1 0 9 9h-9z'],
    accent: ['M15 3.5A9 9 0 0 1 20.5 9H15z'],
  },
  card: {
    label: 'Contas e cartões',
    base: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
    accent: ['M3 10h18', 'M7 15h4'],
  },
  goal: {
    label: 'Projetos de vida',
    base: ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z'],
    accent: ['M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z'],
  },
  add: {
    label: 'Novo',
    base: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z'],
    accent: ['M12 8v8', 'M8 12h8'],
  },
  income: {
    label: 'Receita',
    base: ['M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4'],
    accent: ['M12 4v11', 'M7 10l5 5 5-5'],
  },
  expense: {
    label: 'Despesa',
    base: ['M4 9V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4'],
    accent: ['M12 20V9', 'M7 14l5-5 5 5'],
  },
  alert: {
    label: 'Alerta',
    base: ['M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z'],
    accent: ['M12 9.5v4', 'M12 17h.01'],
  },
  calendar: {
    label: 'Data',
    base: ['M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M8 3v4', 'M16 3v4'],
    accent: ['M4 10h16'],
  },
  search: {
    label: 'Buscar',
    base: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z'],
    accent: ['M20 20l-4-4'],
  },
  user: {
    label: 'Perfil',
    base: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    accent: ['M4 21a8 8 0 0 1 16 0'],
  },
}
