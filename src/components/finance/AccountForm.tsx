import { useState, type FormEvent } from 'react'
import { accountsApi, type Account, type AccountKind } from '../../api/finance'
import { Button } from '../ui/Button'
import { ErrorText } from '../ui/Feedback'
import { Field } from '../ui/Field'
import { IntegerField } from '../ui/IntegerField'
import { Select } from '../ui/Select'
import { useAction } from '../../hooks/useAction'
import { useLoad } from '../../hooks/useLoad'
import { useRegisterDirty } from '../../hooks/useUnsavedChanges'
import { showSaveToast } from '../../lib/saveToast'
import styles from '../../pages/pageStyles'

const KIND_LABEL: Record<AccountKind, string> = {
  Checking: 'Conta corrente',
  Savings: 'Conta poupança',
  Investment: 'Conta investimento',
  Cash: 'Dinheiro',
  Other: 'Outra',
}

const ACCOUNT_KIND_OPTIONS: AccountKind[] = ['Checking', 'Savings', 'Investment']

type Props = {
  onSaved: () => void
  onCancel?: () => void
  /** When set, form updates this account instead of creating. */
  initial?: Account
  /** Compact title for onboard embed. */
  title?: string
  submitLabel?: string
}

function kindForForm(kind: AccountKind): AccountKind {
  return ACCOUNT_KIND_OPTIONS.includes(kind) ? kind : 'Checking'
}

export function AccountForm({
  onSaved,
  onCancel,
  initial,
  title = initial ? 'Editar conta' : 'Nova conta',
  submitLabel = initial ? 'Salvar' : 'Criar conta',
}: Props) {
  const banks = useLoad(() => accountsApi.banks(), [])
  const [name, setName] = useState(() => initial?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(() => kindForForm(initial?.kind ?? 'Checking'))
  const [bankCode, setBankCode] = useState(() => initial?.bankCode ?? '')
  const [agency, setAgency] = useState(() => initial?.agency ?? '')
  const [accountNumber, setAccountNumber] = useState(() => initial?.accountNumber ?? '')
  const [checkDigit, setCheckDigit] = useState(() => initial?.checkDigit ?? '')
  const action = useAction()
  const needsBank = kind !== 'Cash'
  const baselineName = initial?.name ?? ''
  const baselineKind = kindForForm(initial?.kind ?? 'Checking')
  const baselineBank = initial?.bankCode ?? ''
  const baselineAgency = initial?.agency ?? ''
  const baselineNumber = initial?.accountNumber ?? ''
  const baselineDigit = initial?.checkDigit ?? ''
  useRegisterDirty(
    initial ? `account-form-${initial.id}` : 'account-form',
    name.trim() !== baselineName ||
      kind !== baselineKind ||
      bankCode !== baselineBank ||
      agency.trim() !== baselineAgency ||
      accountNumber.trim() !== baselineNumber ||
      checkDigit.trim() !== baselineDigit,
  )

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (needsBank && !bankCode) {
      action.setError('Selecione o banco.')
      return
    }
    const payload = {
      name: name.trim(),
      kind,
      bankCode: needsBank ? bankCode || undefined : undefined,
      agency: needsBank ? agency.trim() || undefined : undefined,
      accountNumber: needsBank ? accountNumber.trim() || undefined : undefined,
      checkDigit: needsBank ? checkDigit.trim() || undefined : undefined,
    }
    const ok = await action.run(() =>
      initial ? accountsApi.update(initial.id, payload) : accountsApi.create(payload),
    )
    if (ok) {
      showSaveToast(initial ? 'Conta atualizada.' : 'Conta criada.')
      if (!initial) {
        setName('')
        setKind('Checking')
        setBankCode('')
        setAgency('')
        setAccountNumber('')
        setCheckDigit('')
      }
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
          <Field
            label="Descrição"
            name="accountName"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="Nome para identificar a conta no app."
          />
        </div>
        <Select label="Tipo de conta" name="accountKind" value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
          {ACCOUNT_KIND_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {KIND_LABEL[option]}
            </option>
          ))}
        </Select>
        {needsBank ? (
          <>
            <Select
              label="Banco"
              name="bankCode"
              required
              value={bankCode}
              onChange={(event) => setBankCode(event.target.value)}
            >
              <option value="">Selecione</option>
              {(banks.data ?? []).map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.code} — {bank.name}
                </option>
              ))}
            </Select>
            <Field
              label="Agência"
              name="agency"
              required
              inputMode="numeric"
              autoComplete="off"
              value={agency}
              onChange={(event) => setAgency(event.target.value.replace(/[^\d-]/g, ''))}
            />
            <Field
              label="Número da conta"
              name="accountNumber"
              required
              inputMode="numeric"
              autoComplete="off"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/[^\d]/g, ''))}
            />
            <IntegerField
              label="Dígito verificador"
              name="checkDigit"
              required
              maxLength={2}
              value={checkDigit}
              onChange={setCheckDigit}
            />
          </>
        ) : null}
        <div className={styles.formWide}>
          <ErrorText message={action.error ?? banks.error} />
        </div>
        <div className={styles.formActions}>
          <Button
            type="submit"
            disabled={action.busy || (needsBank && (banks.loading || !bankCode))}
          >
            {submitLabel}
          </Button>
          {onCancel ? (
            <Button type="button" variant="secondary" disabled={action.busy} onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
