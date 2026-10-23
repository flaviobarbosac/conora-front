import { useState, type FormEvent } from 'react'
import { accountsApi, type AccountKind } from '../../api/finance'
import { Button } from '../ui/Button'
import { ErrorText } from '../ui/Feedback'
import { Field } from '../ui/Field'
import { IntegerField } from '../ui/IntegerField'
import { Select } from '../ui/Select'
import { useAction } from '../../hooks/useAction'
import { useLoad } from '../../hooks/useLoad'
import { useRegisterDirty } from '../../hooks/useUnsavedChanges'
import { showSaveToast } from '../../lib/saveToast'
import styles from '../../pages/page.module.css'

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
  /** Compact title for onboard embed. */
  title?: string
  submitLabel?: string
}

export function AccountForm({ onSaved, title = 'Nova conta', submitLabel = 'Criar conta' }: Props) {
  const banks = useLoad(() => accountsApi.banks(), [])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('Checking')
  const [bankCode, setBankCode] = useState('021')
  const [agency, setAgency] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [checkDigit, setCheckDigit] = useState('')
  const action = useAction()
  const needsBank = kind !== 'Cash'
  useRegisterDirty(
    'account-form',
    name.trim() !== '' ||
      kind !== 'Checking' ||
      bankCode !== '021' ||
      agency.trim() !== '' ||
      accountNumber.trim() !== '' ||
      checkDigit.trim() !== '',
  )

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (
      await action.run(() =>
        accountsApi.create({
          name: name.trim(),
          kind,
          bankCode: needsBank ? bankCode || undefined : undefined,
          agency: needsBank ? agency.trim() || undefined : undefined,
          accountNumber: needsBank ? accountNumber.trim() || undefined : undefined,
          checkDigit: needsBank ? checkDigit.trim() || undefined : undefined,
        }),
      )
    ) {
      showSaveToast('Conta criada.')
      setName('')
      setKind('Checking')
      setBankCode('021')
      setAgency('')
      setAccountNumber('')
      setCheckDigit('')
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
              value={agency}
              onChange={(event) => setAgency(event.target.value.replace(/[^\d-]/g, ''))}
            />
            <Field
              label="Número da conta"
              name="accountNumber"
              required
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
          <Button type="submit" disabled={action.busy || (needsBank && banks.loading)}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </section>
  )
}
