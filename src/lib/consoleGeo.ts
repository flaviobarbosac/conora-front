import type { ConsoleGeoUser } from '../api/finance'

const UF_NOMES: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
}

const NOME_PARA_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_NOMES).map(([sigla, nome]) => [semAcento(nome).toLowerCase(), sigla]),
)

export const CENTRO_BRASIL = { lat: -14.235, lng: -51.925 }

export const CENTRO_UF: Record<string, { lat: number; lng: number }> = {
  AC: { lat: -9.02, lng: -70.81 },
  AL: { lat: -9.57, lng: -36.78 },
  AP: { lat: 1.41, lng: -51.77 },
  AM: { lat: -3.47, lng: -65.1 },
  BA: { lat: -12.96, lng: -41.71 },
  CE: { lat: -5.2, lng: -39.53 },
  DF: { lat: -15.78, lng: -47.93 },
  ES: { lat: -19.58, lng: -40.65 },
  GO: { lat: -15.93, lng: -49.86 },
  MA: { lat: -5.42, lng: -45.44 },
  MT: { lat: -12.64, lng: -55.42 },
  MS: { lat: -20.51, lng: -54.54 },
  MG: { lat: -18.1, lng: -44.38 },
  PA: { lat: -3.79, lng: -52.48 },
  PB: { lat: -7.24, lng: -36.78 },
  PR: { lat: -24.89, lng: -51.55 },
  PE: { lat: -8.38, lng: -37.86 },
  PI: { lat: -7.72, lng: -42.73 },
  RJ: { lat: -22.25, lng: -42.66 },
  RN: { lat: -5.81, lng: -36.59 },
  RS: { lat: -30.17, lng: -53.5 },
  RO: { lat: -10.83, lng: -63.34 },
  RR: { lat: 1.99, lng: -61.33 },
  SC: { lat: -27.45, lng: -50.95 },
  SP: { lat: -22.19, lng: -48.79 },
  SE: { lat: -10.57, lng: -37.45 },
  TO: { lat: -10.17, lng: -48.33 },
}

export const CAMPOS_PIN = [
  ['nome', 'Nome'],
  ['nomeFantasia', 'Nome fantasia'],
  ['email', 'E-mail'],
  ['telefone', 'Telefone'],
  ['municipio', 'Município'],
  ['uf', 'UF'],
  ['bairro', 'Bairro'],
  ['logradouro', 'Logradouro'],
  ['numero', 'Número'],
  ['cep', 'CEP'],
  ['categoria', 'Categoria'],
  ['plano', 'Plano'],
] as const

export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '')
}

export function normalizarUf(uf: string | null | undefined): string {
  const texto = uf?.trim() ?? ''
  if (!texto) return ''
  const upper = texto.toUpperCase()
  if (upper.length === 2 && UF_NOMES[upper]) return upper
  return NOME_PARA_UF[semAcento(texto).toLowerCase()] ?? ''
}

export function coordenadaValida(latitude: number | null | undefined, longitude: number | null | undefined): boolean {
  if (latitude == null || longitude == null) return false
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false
  return !(latitude === 0 && longitude === 0)
}

export const CORES_PLANO = [
  ['Gratuito', '#D32F2F'],
  ['Individual', '#1B8A3E'],
  ['Duo', '#1565C0'],
  ['Família', '#7B1FA2'],
] as const

export function corDoPlano(plano: string | null | undefined): string {
  const nome = semAcento(plano ?? '').toLowerCase()
  if (nome.startsWith('individual')) return CORES_PLANO[1][1]
  if (nome.startsWith('duo')) return CORES_PLANO[2][1]
  if (nome.startsWith('familia')) return CORES_PLANO[3][1]
  return CORES_PLANO[0][1]
}

export function valorCampo(usuario: ConsoleGeoUser, campo: string): string {
  const valor = usuario[campo as keyof ConsoleGeoUser]
  if (valor == null) return ''
  return String(valor).trim()
}

export function textoDoPin(
  usuario: ConsoleGeoUser,
  textoFixo: string | null | undefined,
  campos: readonly string[],
  campoUnico?: string,
): string {
  const fixo = textoFixo?.trim()
  if (fixo) return fixo
  const nome = campos.includes('nome') ? (valorCampo(usuario, 'nome') || usuario.nome) : ''
  const municipio = campos.includes('municipio') ? valorCampo(usuario, 'municipio') : ''
  const uf = campos.includes('uf') ? valorCampo(usuario, 'uf') : ''
  const local = [municipio, uf].filter(Boolean).join('/')
  const texto = [nome, local].filter(Boolean).join(' · ')
  if (texto) return texto
  return valorCampo(usuario, campoUnico ?? 'nome') || usuario.nome
}

export function enderecoGeocode(usuario: ConsoleGeoUser): string {
  const cidade = usuario.municipio && usuario.uf ? `${usuario.municipio} - ${usuario.uf}` : ''
  return [usuario.logradouro, usuario.numero, usuario.bairro, cidade, usuario.cep, 'Brasil']
    .map((parte) => parte?.trim())
    .filter(Boolean)
    .join(', ')
}

export function podeGeocodificar(usuario: ConsoleGeoUser): boolean {
  const falta = usuario.latitude == null || usuario.longitude == null
  const temLocal = Boolean((usuario.municipio && usuario.uf) || usuario.cep)
  return falta && temLocal
}

export function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function htmlDoCartao(usuario: ConsoleGeoUser, campos: readonly string[]): string {
  const linhas = campos
    .filter((campo) => campo !== 'nome' && campo !== 'categoria')
    .map((campo) => {
      const valor = valorCampo(usuario, campo)
      if (!valor) return ''
      const rotulo = CAMPOS_PIN.find((item) => item[0] === campo)?.[1] ?? campo
      return `<div><strong>${escaparHtml(rotulo)}:</strong> ${escaparHtml(valor)}</div>`
    })
    .filter(Boolean)
  const profissao = valorCampo(usuario, 'categoria')
  const meio = profissao ? `<div>${escaparHtml(profissao)}</div>` : ''
  return `<div><strong>${escaparHtml(usuario.nome)}</strong></div>${meio}${linhas.join('')}`
}

export function chaveLocal(valor: string | null | undefined): string {
  return (valor ?? '').trim().toUpperCase()
}
