import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { whatsappApi } from '../../api/finance'
import { Button } from '../../components/ui/Button'
import { ErrorText, Loading } from '../../components/ui/Feedback'
import { Field } from '../../components/ui/Field'
import { useAction } from '../../hooks/useAction'
import { useLoad } from '../../hooks/useLoad'
import { confirmDestructive } from '../../lib/confirm'
import { showSaveToast } from '../../lib/saveToast'
import styles from '../page.module.css'

const CONORA_WHATSAPP_E164 = '5527998843407'
const CONORA_WHATSAPP_LABEL = '+55 27 99884-3407'
const CHAT_URL = `https://wa.me/${CONORA_WHATSAPP_E164}`

export function WhatsAppSection({ showDraftsLink = true }: { showDraftsLink?: boolean }) {
  const link = useLoad(() => whatsappApi.link(), [])
  const action = useAction()
  const [phone, setPhone] = useState('')

  async function saveLink(event: FormEvent) {
    event.preventDefault()
    if (await action.run(() => whatsappApi.setLink(phone.trim()))) {
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
    if (await action.run(() => whatsappApi.unlink())) {
      link.reload()
    }
  }

  return (
    <section className={styles.section} id="whatsapp">
      <h2 className={styles.sectionTitle}>WhatsApp</h2>
      <p className={styles.muted}>
        Vincule o número deste celular. A conversa abre no WhatsApp do aparelho, no número{' '}
        {CONORA_WHATSAPP_LABEL}. O lançamento só entra depois que você confirma.
      </p>
      <ErrorText message={link.error ?? action.error} />
      {link.loading && !link.data ? <Loading /> : null}
      {link.data ? (
        <div className={styles.row}>
          <span className={styles.rowMain}>
            <strong>{link.data.phoneE164}</strong>
            <span className={styles.rowSub}>Mensagens deste número viram rascunho até você confirmar.</span>
          </span>
          <Button variant="ghost" disabled={action.busy} onClick={() => void unlink()}>
            Desvincular
          </Button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={(event) => void saveLink(event)}>
          <Field
            label="Telefone deste aparelho (com DDI)"
            name="whatsappPhone"
            required
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="5511999999999"
          />
          <div className={styles.formActions}>
            <Button type="submit" disabled={action.busy}>
              Vincular
            </Button>
          </div>
        </form>
      )}
      <div className={styles.accountLinks}>
        <a className={styles.accountLink} href={CHAT_URL} target="_blank" rel="noopener noreferrer">
          <strong>Abrir conversa neste aparelho</strong>
          <span>Abre o WhatsApp do Conora ({CONORA_WHATSAPP_LABEL}).</span>
        </a>
        {showDraftsLink ? (
          <Link to="/whatsapp" className={styles.accountLink}>
            <strong>Rascunhos</strong>
            <span>Confirme ou descarte o que chegou por mensagem.</span>
          </Link>
        ) : null}
      </div>
    </section>
  )
}
