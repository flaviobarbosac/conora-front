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
  | 'bell'
  | 'calendar'
  | 'search'
  | 'user'
  | 'sun'
  | 'moon'
  | 'folder'
  | 'wallet'
  | 'chevron'
  | 'settings'
  | 'help'
  | 'logout'
  | 'trash'
  | 'repeat'

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
  bell: {
    label: 'Notificações',
    base: ['M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6z', 'M10 19a2 2 0 0 0 4 0'],
    accent: ['M12 3v1'],
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
  sun: {
    label: 'Tema claro',
    base: ['M12 4v2', 'M12 18v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M4 12h2', 'M18 12h2', 'M4.93 19.07l1.41-1.41', 'M17.66 6.34l1.41-1.41'],
    accent: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  },
  moon: {
    label: 'Tema escuro',
    base: ['M12 3a7 7 0 1 0 7 7 5 5 0 0 1-7-7z'],
    accent: [],
  },
  folder: {
    label: 'Cadastros',
    base: ['M4 7h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z'],
    accent: ['M3 7V6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v1'],
  },
  wallet: {
    label: 'Patrimônio',
    base: ['M5 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z'],
    accent: ['M3 11h18', 'M16 15h.01'],
  },
  chevron: {
    label: 'Expandir',
    base: ['M9 6l6 6-6 6'],
    accent: [],
  },
  settings: {
    label: 'Configurações',
    base: [
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1.01 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    ],
    accent: [],
  },
  help: {
    label: 'Central de ajuda',
    base: ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z'],
    accent: ['M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.5 1-1.5 2.2', 'M12 17h.01'],
  },
  logout: {
    label: 'Sair',
    base: ['M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4'],
    accent: ['M15 16l4-4-4-4', 'M19 12H10'],
  },
  trash: {
    label: 'Excluir',
    base: ['M5 7h14', 'M10 11v6', 'M14 11v6', 'M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2'],
    accent: ['M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12'],
  },
  repeat: {
    label: 'Repetir ou parcelar',
    base: ['M17 2l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 22l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'],
    accent: [],
  },
}
