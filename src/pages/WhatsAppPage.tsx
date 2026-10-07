import { useState, type FormEvent } from 'react'
import {
  whatsappApi,
  type Account,
  type Category,
  type WhatsAppDraft,
  type WhatsAppDraftPayload,
} from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { confirmDestructive } from '../lib/confirm'
import { formatDate, formatDateTime, formatMoney } from '../lib/format'
import styles from './page.module.css'

function parsePayload(draft: WhatsAppDraft): WhatsAppDraftPayload | null {
  try {
    return JSON.parse(draft.payloadJson) as WhatsAppDraftPayload
  } catch {
    return null
  }
}

export function WhatsAppPage() {
  const link = useLoad(() => whatsappApi.link(), [])
  const drafts = useLoad(() => whatsappApi.drafts('Pending'), [])
  const lookups = useLookups()
  const [phone, setPhone] = useState('')
  const linkAction = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await linkAction.run(() => whatsappApi.setLink(phone.trim()))) {
      setPhone('')
      link.reload()
    }
  }

  async function unlink() {
    if (!confirmDestructive('Desvincular este número do WhatsApp?')) {
      return
    }
    if (await linkAction.run(() => whatsappApi.unlink())) {
      link.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="WhatsApp" />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Número vinculado</h2>
        <ErrorText message={link.error ?? linkAction.error} />
        {link.loading && link.data === null ? <Loading /> : null}
        {link.data ? (
          <div className={styles.sectionHead}>
            <span className={styles.rowMain}>
              <strong>{link.data.phoneE164}</strong>
              <span className={styles.rowSub}>Vinculado em {formatDateTime(link.data.linkedAt)}</span>
            </span>
            <Button variant="secondary" disabled={linkAction.busy} onClick={() => void unlink()}>
              Desvincular
            </Button>
          </div>
        ) : (
          <p className={styles.muted}>Nenhum número vinculado.</p>
        )}
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <Field
            label={link.data ? 'Trocar número' : 'Vincular número'}
            name="phone"
            type="tel"
            placeholder="+55 11 91234-5678"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <div className={styles.formActions}>
            <Button type="submit" disabled={linkAction.busy}>
              Vincular
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Rascunhos pendentes</h2>
        <ErrorText message={drafts.error} />
        {drafts.loading && !drafts.data ? <Loading /> : null}
        {drafts.data && drafts.data.length === 0 ? <Empty>Nenhum rascunho aguardando confirmação.</Empty> : null}
        {drafts.data?.map((draft) => (
          <DraftRow
            key={draft.id}
            draft={draft}
            accounts={lookups.accounts}
            categories={lookups.categories}
            onDone={() => {
              drafts.reload()
              lookups.reloadAccounts()
            }}
          />
        ))}
      </section>
    </div>
  )
}

type RowProps = {
  draft: WhatsAppDraft
  accounts: Account[]
  categories: Category[]
  onDone: () => void
}

function DraftRow({ draft, accounts, categories, onDone }: RowProps) {
  const payload = parsePayload(draft)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const action = useAction()

  async function confirm() {
    if (await action.run(() => whatsappApi.confirm(draft.id, accountId || undefined, categoryId || undefined))) {
      onDone()
    }
  }

  async function discard() {
    if (!confirmDestructive('Descartar este rascunho do WhatsApp?')) {
      return
    }
    if (await action.run(() => whatsappApi.discard(draft.id))) {
      onDone()
    }
  }

  const kind = payload?.type === 'Income' ? 'Income' : 'Expense'

  return (
    <div className={styles.subsection}>
      <div className={styles.sectionHead}>
        <span className={styles.rowMain}>
          <strong>{payload ? payload.description : 'Mensagem não interpretada'}</strong>
          <span className={styles.rowSub}>
            {draft.phoneE164} · {payload ? formatDate(payload.occurredAt) : formatDateTime(draft.createdAt)}
          </span>
        </span>
        {payload ? <span className={styles.amount}>{formatMoney(payload.amount)}</span> : null}
      </div>
      <div className={styles.form}>
        <Select label="Conta" name={`draftAccount-${draft.id}`} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Conta padrão</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <Select label="Categoria" name={`draftCategory-${draft.id}`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Automática</option>
          {categories
            .filter((category) => category.kind === kind)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </Select>
      </div>
      <ErrorText message={action.error} />
      <div className={styles.actions}>
        <Button disabled={action.busy} onClick={() => void confirm()}>
          Confirmar
        </Button>
        <Button variant="secondary" disabled={action.busy} onClick={() => void discard()}>
          Descartar
        </Button>
      </div>
    </div>
  )
}
