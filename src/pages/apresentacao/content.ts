import type { IconName } from '../../icons/catalog'

export type Feature = {
  key: string
  icon: IconName
  title: string
  text: string
}

/** Product modules shown on the presentation screens (copy in pt-BR, mirrors the app navigation). */
export const FEATURES: ReadonlyArray<Feature> = [
  {
    key: 'lancamentos',
    icon: 'list',
    title: 'Lançamentos',
    text: 'Receitas e despesas por conta e cartão, classificadas nas categorias da família.',
  },
  {
    key: 'orcamento',
    icon: 'folder',
    title: 'Orçamento',
    text: 'Planeje cada conta do mês e compare previsto com realizado, linha a linha.',
  },
  {
    key: 'raio-x',
    icon: 'budget',
    title: 'Raio-X',
    text: 'O balancete em árvore: receita, descontos, essenciais, projetos e social — com drill-down até o lançamento.',
  },
  {
    key: 'patrimonio',
    icon: 'wallet',
    title: 'Patrimônio',
    text: 'Ativos, passivos e patrimônio líquido numa visão separada do fluxo mensal.',
  },
  {
    key: 'projetos',
    icon: 'goal',
    title: 'Projetos de vida',
    text: 'Defina o valor e a data do sonho; o Conora sugere a parcela mensal até lá.',
  },
  {
    key: 'membros',
    icon: 'user',
    title: 'Família',
    text: 'Convide quem divide a casa: cada membro lança, todos enxergam o mesmo orçamento.',
  },
  {
    key: 'importar',
    icon: 'income',
    title: 'Importar extrato',
    text: 'Traga o extrato do banco com pré-visualização e detecção de duplicatas.',
  },
  {
    key: 'whatsapp',
    icon: 'bell',
    title: 'WhatsApp',
    text: 'Mande o gasto por mensagem; ele chega como rascunho para você só confirmar.',
  },
  {
    key: 'ia',
    icon: 'search',
    title: 'Pergunte à IA',
    text: 'Pergunte em linguagem natural e receba respostas com base nos números do mês.',
  },
  {
    key: 'mes',
    icon: 'calendar',
    title: 'Fechamento do mês',
    text: 'Feche a competência para congelar os números — e reabra com motivo registrado.',
  },
]

export function feature(key: string): Feature {
  const found = FEATURES.find((item) => item.key === key)
  if (!found) {
    throw new Error(`Unknown feature: ${key}`)
  }
  return found
}

export const STEPS = [
  { title: 'Monte a base', text: 'Cadastre contas, cartões e categorias — ou comece pelo modelo pronto.' },
  { title: 'Registre o dia a dia', text: 'Lance no app, importe o extrato ou mande pelo WhatsApp.' },
  { title: 'Enxergue e decida', text: 'Orçamento, Raio-X e patrimônio mostram onde ajustar a rota.' },
] as const
