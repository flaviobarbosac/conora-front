export type ReleaseNote = {
  version: string
  date: string
  items: readonly string[]
}

/** Newest first. Add the next published version at the top. */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '26.108',
    date: '18/11/2026',
    items: [
      'Aprimoração de layout em telas do app.',
    ],
  },
  {
    version: '26.107',
    date: '18/11/2026',
    items: [
      'No menu, abra Raio-X. Em Projetos de vida, abaixo dos prazos, aparece a Reserva de emergência com o saldo e quantos meses de essenciais ela cobre.',
      'No celular, o Conora pode avisar por notificação quando o mês fecha com pendências ou quando algo precisa da sua atenção.',
      'No menu, abra o mês. Antes de fechar, a leitura do mês vem em texto simples, no mesmo tom da conversa.',
      'Em Lançamentos, ao quitar dívidas, um valor pode ser dividido em sequência entre mais de uma dívida.',
      'No Raio-X, os filtros do mês e do escopo ficam mais claros para você achar o que procura.',
    ],
  },
  {
    version: '26.106',
    date: '18/11/2026',
    items: [
      'No começo, no passo Vídeo rápido, o vídeo passa no próprio Conora e começa sozinho. Para ver de novo, abra o menu do perfil e toque em Onboarding.',
    ],
  },
  {
    version: '26.105',
    date: '18/11/2026',
    items: [
      'Abra o menu, toque em Cadastros e depois em Retrospectiva, o último item, abaixo de Membros. Ali está o resumo do ano.',
      'Em Configurações, abra Compartilhar mês. O campo do mês está menor e continua mostrando o mês e o ano.',
      'Em Configurações, abra Ritmo. Os campos de meses da reserva, dia de fechamento e alerta de atenção ficaram menores.',
      'Em Configurações, abra WhatsApp. A lista de rascunhos para confirmar não aparece mais.',
    ],
  },
  {
    version: '26.103',
    date: '17/11/2026',
    items: [
      'Compartilhar um mês para o acompanhamento da análise financeira do consultor.',
      'Em Configurações, abra Compartilhar mês. Escolha o mês, toque em Adicionar mês e depois em Compartilhar meses. O mês fica na lista. Para tirar, confirme na lixeira.',
      'Quem acompanha escolhe esse mês e vê o Raio-X, o orçamento e os lançamentos daquele período.',
    ],
  },
  {
    version: '26.100',
    date: '16/11/2026',
    items: [
      'Você escolhe um mês e o consultor trabalha só nele. O que ele lança continua na sua conta, com o nome de quem fez.',
      'Dá para ver os meses compartilhados e entrar naquele mês. A degustação pode ser estendida, e o acesso liberado por um prazo ou sem data para acabar.',
      'A foto do boleto ou do cupom vira lançamento quando aparecem o CNPJ, quem recebeu, a data e o valor. Se faltar algo, você completa na hora ou manda uma foto mais nítida.',
      'O WhatsApp abre com a mensagem pronta. Você envia e o número fica ligado a esta conta. O código vale uma vez.',
      'São 7 dias com o Conora inteiro. Duo e Família entram quando você assina.',
      'Individual por 29,90 ao mês ou 299 ao ano. Duo por 39,90 ou 399. Família por 49,90 ou 499. No anual, dois meses saem de graça.',
      'O que muda em cada versão fica neste histórico: no menu do perfil, em Configurações e no número da versão.',
    ],
  },
]

export function latestRelease(): ReleaseNote {
  return RELEASE_NOTES[0]
}
