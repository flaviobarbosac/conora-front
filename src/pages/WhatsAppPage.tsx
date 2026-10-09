import { useMemo, useState, type FormEvent } from 'react'
import {
  whatsappApi,
  type ChartAccount,
  type WhatsAppDraft,
  type WhatsAppDraftPayload,
} from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { ChartAccountSelect } from '../components/ChartAccountSelect'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { formatMoney } from '../lib/format'
import styles from './page.module.css'

function parsePayload(json: string): WhatsAppDraftPayload | null {
  try {
    return JSON.parse(json) as WhatsAppDraftPayload
  } catch {
    return null
  }
}

export function WhatsAppPage() {
  const link = useLoad(() => whatsappApi.link(), [])
  const drafts = useLoad(() => whatsappApi.drafts('Pending'), [])
  const lookups = useLookups()
  const linkAction = useAction()
  const draftAction = useAction()
  const [phone, setPhone] = useState('')

  async function saveLink(event: FormEvent) {
    event.preventDefault()
    if (await linkAction.run(() => whatsappApi.setLink(phone.trim()))) {
      showSaveToast('Número vinculado.')
      setPhone('')
      link.reload()
    }
  }

  async function unlink() {
    if (
      !(await confirmDestructive('Desvincular este número do WhatsApp?', {
        title: 'Desvincular',
        confirmLabel: 'Desvincular',
      }))
    ) {
      return
    }
    if (await linkAction.run(() => whatsappApi.unlink())) {
      link.reload()
    }
  }

  async function confirmDraft(draft: WhatsAppDraft, accountId: string, chartAccountId: string) {
    if (
      await draftAction.run(() =>
        whatsappApi.confirm(draft.id, accountId || undefined, chartAccountId || undefined),
      )
    ) {
      showSaveToast('Lançamento gravado.')
      drafts.reload()
    }
  }

  async function discardDraft(draft: WhatsAppDraft) {
    if (
      !(await confirmDestructive('Descartar este rascunho?', {
        title: 'Descartar',
        confirmLabel: 'Descartar',
      }))
    ) {
      return
    }
    if (await draftAction.run(() => whatsappApi.discard(draft.id))) {
      drafts.reload()
    }
  }

  const pending = drafts.data ?? []

  return (
    <div className={styles.page}>
      <PageHeader secondary title="WhatsApp" />
      <ErrorText message={link.error ?? drafts.error ?? linkAction.error ?? draftAction.error} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Número vinculado</h2>
        {link.loading && !link.data ? <Loading /> : null}
        {link.data ? (
          <div className={styles.row}>
            <span className={styles.rowMain}>
              <strong>{link.data.phoneE164}</strong>
              <span className={styles.rowSub}>Mensagens viram rascunho até você confirmar.</span>
            </span>
            <Button variant="ghost" disabled={linkAction.busy} onClick={() => void unlink()}>
              Desvincular
            </Button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={(event) => void saveLink(event)}>
            <Field
              label="Telefone (com DDI)"
              name="whatsappPhone"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="5511999999999"
            />
            <div className={styles.formActions}>
              <Button type="submit" disabled={linkAction.busy}>
                Vincular
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Rascunhos pendentes</h2>
        {drafts.loading && !drafts.data ? <Loading /> : null}
        {pending.length === 0 ? <Empty>Nenhum rascunho aguardando confirmação.</Empty> : null}
        <ul className={styles.list}>
          {pending.map((draft) => (
            <DraftRow
              key={draft.id}
              draft={draft}
              accounts={lookups.accounts}
              expenseAccounts={lookups.expenseAccounts}
              incomeAccounts={lookups.incomeAccounts}
              tree={lookups.chartAccounts}
              busy={draftAction.busy}
              onConfirm={confirmDraft}
              onDiscard={discardDraft}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}

function DraftRow({
  draft,
  accounts,
  expenseAccounts,
  incomeAccounts,
  tree,
  busy,
  onConfirm,
  onDiscard,
}: {
  draft: WhatsAppDraft
  accounts: { id: string; name: string }[]
  expenseAccounts: ChartAccount[]
  incomeAccounts: ChartAccount[]
  tree: ChartAccount[]
  busy: boolean
  onConfirm: (draft: WhatsAppDraft, accountId: string, chartAccountId: string) => Promise<void>
  onDiscard: (draft: WhatsAppDraft) => Promise<void>
}) {
  const payload = useMemo(() => parsePayload(draft.payloadJson), [draft.payloadJson])
  const [accountId, setAccountId] = useState('')
  const [chartAccountId, setChartAccountId] = useState('')
  const chartOptions = payload?.type === 'Income' ? incomeAccounts : expenseAccounts

  if (!payload) {
    return (
      <li className={styles.row}>
        <span className={styles.rowMain}>
          <strong>Rascunho inválido</strong>
        </span>
        <Button variant="ghost" disabled={busy} onClick={() => void onDiscard(draft)}>
          Descartar
        </Button>
      </li>
    )
  }

  const kind = payload.type === 'Income' ? 'Receita' : 'Despesa'

  return (
    <li className={styles.section}>
      <div className={styles.row}>
        <span className={styles.rowMain}>
          <strong>
            {kind} · {formatMoney(payload.amount)}
          </strong>
          <span className={styles.rowSub}>{payload.description}</span>
        </span>
      </div>
      <div className={styles.form}>
        <Select
          label="Conta"
          name={`wa-account-${draft.id}`}
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">Opcional</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <ChartAccountSelect
          label="Conta do plano"
          name={`wa-chart-${draft.id}`}
          value={chartAccountId}
          onChange={setChartAccountId}
          options={chartOptions}
          tree={tree}
          emptyLabel="Opcional"
        />
        <div className={styles.formActions}>
          <Button disabled={busy} onClick={() => void onConfirm(draft, accountId, chartAccountId)}>
            Confirmar e gravar
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void onDiscard(draft)}>
            Descartar
          </Button>
        </div>
      </div>
    </li>
  )
}
