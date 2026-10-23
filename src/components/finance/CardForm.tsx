import { useState, type FormEvent } from 'react'
import { cardsApi, type Account } from '../../api/finance'
import { Button } from '../ui/Button'
import { ErrorText } from '../ui/Feedback'
import { Field } from '../ui/Field'
import { IntegerField } from '../ui/IntegerField'
import { MoneyField } from '../ui/MoneyField'
import { Select } from '../ui/Select'
import { useAction } from '../../hooks/useAction'
import { useRegisterDirty } from '../../hooks/useUnsavedChanges'
import { parseMoney } from '../../lib/format'
import { showSaveToast } from '../../lib/saveToast'
import styles from '../../pages/page.module.css'

type Props = {
  accounts: Account[]
  onSaved: () => void
  title?: string
  submitLabel?: string
}

export function CardForm({
  accounts,
  onSaved,
  title = 'Novo cartão',
  submitLabel = 'Criar cartão',
}: Props) {
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('')
  const [closing, setClosing] = useState('')
  const [due, setDue] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const action = useAction()
  useRegisterDirty(
    'card-form',
    name.trim() !== '' ||
      limit.trim() !== '' ||
      closing.trim() !== '' ||
      due.trim() !== '' ||
      paymentAccountId !== '',
  )

  async function submit(event: FormEvent) {
    event.preventDefault()
    const limitTotal = parseMoney(limit)
    if (!Number.isFinite(limitTotal) || limitTotal < 0) {
      action.setError('Limite inválido.')
      return
    }
    const saved = await action.run(() =>
      cardsApi.create(name.trim(), limitTotal, Number(closing), Number(due), paymentAccountId || undefined),
    )
    if (saved) {
      showSaveToast('Cartão criado.')
      setName('')
      setLimit('')
      setClosing('')
      setDue('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Field label="Nome" name="cardName" required value={name} onChange={(event) => setName(event.target.value)} />
        <MoneyField label="Limite (R$)" name="cardLimit" required value={limit} onChange={setLimit} />
        <IntegerField label="Dia de fechamento" name="closingDay" required maxLength={2} value={closing} onChange={setClosing} />
        <IntegerField label="Dia de vencimento" name="dueDay" required maxLength={2} value={due} onChange={setDue} />
        <Select label="Conta de pagamento" name="paymentAccount" value={paymentAccountId} onChange={(event) => setPaymentAccountId(event.target.value)}>
          <option value="">Escolher ao pagar</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </section>
  )
}
