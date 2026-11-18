import { useState } from 'react'
import { Field } from './ui/Field'
import { addressReady, digitsOnly, formatCep, lookupCep, type AddressDraft } from '../lib/cep'

type Props = {
  value: AddressDraft
  onChange: (next: AddressDraft) => void
}

export function AddressFields({ value, onChange }: Props) {
  const [cepError, setCepError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function changeCep(raw: string) {
    const cep = formatCep(raw)
    onChange({ ...value, cep })
    const digits = digitsOnly(cep)
    if (digits.length !== 8) {
      setCepError(null)
      return
    }
    setLoading(true)
    setCepError(null)
    try {
      const found = await lookupCep(digits)
      if (!found) {
        setCepError('CEP não encontrado.')
        onChange({ cep, logradouro: '', numero: '', bairro: '', municipio: '', uf: '' })
        return
      }
      onChange({
        cep,
        logradouro: found.logradouro,
        numero: 'S/N',
        bairro: found.bairro,
        municipio: found.municipio,
        uf: found.uf,
      })
    } catch {
      setCepError('Não foi possível consultar o CEP.')
    } finally {
      setLoading(false)
    }
  }

  const missing =
    digitsOnly(value.cep).length === 8 && !loading && !cepError && !addressReady(value)
      ? 'Complete o que o CEP não trouxe. Todos os campos são obrigatórios.'
      : null

  return (
    <>
      <Field
        label="CEP"
        name="cep"
        required
        inputMode="numeric"
        autoComplete="postal-code"
        value={value.cep}
        onChange={(event) => void changeCep(event.target.value)}
        hint={loading ? 'Buscando endereço…' : cepError ?? 'O CEP preenche o endereço. O número começa como S/N.'}
      />
      <Field
        label="Logradouro"
        name="logradouro"
        required
        autoComplete="address-line1"
        value={value.logradouro}
        onChange={(event) => onChange({ ...value, logradouro: event.target.value })}
      />
      <Field
        label="Número"
        name="numero"
        required
        autoComplete="address-line2"
        value={value.numero}
        onChange={(event) => onChange({ ...value, numero: event.target.value })}
      />
      <Field
        label="Bairro"
        name="bairro"
        required
        value={value.bairro}
        onChange={(event) => onChange({ ...value, bairro: event.target.value })}
      />
      <Field
        label="Município"
        name="municipio"
        required
        value={value.municipio}
        onChange={(event) => onChange({ ...value, municipio: event.target.value })}
      />
      <Field
        label="UF"
        name="uf"
        required
        maxLength={2}
        value={value.uf}
        onChange={(event) => onChange({ ...value, uf: event.target.value.toUpperCase().slice(0, 2) })}
        hint={missing ?? undefined}
      />
    </>
  )
}
