import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { whatsappApi } from '../../api/finance'
import { Button } from '../../components/ui/Button'
import { ErrorText, Loading } from '../../components/ui/Feedback'
import { useAction } from '../../hooks/useAction'
import { useLoad } from '../../hooks/useLoad'
import { confirmDestructive } from '../../lib/confirm'
import { conoraWhatsAppHref } from '../../lib/whatsappLink'
import { isNativeApp } from '../../lib/platform'
import styles from '../page.module.css'

async function openConoraWhatsApp() {
  const issued = await whatsappApi.pairingCode()
  const href = conoraWhatsAppHref(issued.text, isNativeApp())
  if (isNativeApp()) {
    window.location.assign(href)
    return
  }
  window.open(href, '_blank', 'noopener,noreferrer')
}

export function WhatsAppSection({
  showDraftsLink = true,
  framed = true,
}: {
  showDraftsLink?: boolean
  framed?: boolean
}) {
  const link = useLoad(() => whatsappApi.link(), [])
  const action = useAction()

  async function openWhatsApp() {
    await action.run(() => openConoraWhatsApp())
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

  const body: ReactNode = (
    <>
      <ErrorText message={link.error ?? action.error} />
      {link.loading && !link.data ? <Loading /> : null}
      {link.data ? (
        <div className={styles.row}>
          <span className={styles.rowMain}>
            <strong>{link.data.phoneE164}</strong>
            <span className={styles.rowSub}>
              Este WhatsApp já está ligado. As mensagens chegam como rascunho para você confirmar.
            </span>
          </span>
          <Button variant="ghost" disabled={action.busy} onClick={() => void unlink()}>
            Desvincular
          </Button>
        </div>
      ) : (
        <p className={styles.muted}>
          Toque em Abrir WhatsApp. A mensagem já abre pronta, com um código desta conta. Envie. A gente
          grava o número e o código não serve de novo.
        </p>
      )}
      <div className={styles.actions}>
        <Button type="button" disabled={action.busy} onClick={() => void openWhatsApp()}>
          Abrir WhatsApp
        </Button>
      </div>
      {showDraftsLink ? (
        <Link to="/whatsapp" className={styles.accountLink}>
          <strong>Rascunhos</strong>
          <span>Confirme ou descarte o que chegou por mensagem.</span>
        </Link>
      ) : null}
    </>
  )

  if (!framed) return body

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>WhatsApp</h2>
      {body}
    </section>
  )
}
