export type ReleaseNote = {
  version: string
  date: string
  items: readonly string[]
}

/** Newest first. Add the next published version at the top. */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
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
