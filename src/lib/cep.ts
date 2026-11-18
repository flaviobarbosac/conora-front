export type CepAddress = {
  logradouro: string
  bairro: string
  municipio: string
  uf: string
}

export type AddressDraft = {
  cep: string
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
}

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

export function formatCep(value: string): string {
  const digits = digitsOnly(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function addressReady(input: {
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  municipio?: string | null
  uf?: string | null
}): boolean {
  return (
    digitsOnly(input.cep).length === 8 &&
    Boolean(input.logradouro?.trim()) &&
    Boolean(input.numero?.trim()) &&
    Boolean(input.bairro?.trim()) &&
    Boolean(input.municipio?.trim()) &&
    /^[A-Za-z]{2}$/.test(input.uf?.trim() ?? '')
  )
}

export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = digitsOnly(cep)
  if (digits.length !== 8) return null
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!response.ok) throw new Error('Não foi possível consultar o CEP.')
  const body = (await response.json()) as {
    erro?: boolean | string
    logradouro?: string
    bairro?: string
    localidade?: string
    uf?: string
  }
  if (body.erro || !body.uf) return null
  return {
    logradouro: body.logradouro?.trim() ?? '',
    bairro: body.bairro?.trim() ?? '',
    municipio: body.localidade?.trim() ?? '',
    uf: body.uf.trim().toUpperCase(),
  }
}
