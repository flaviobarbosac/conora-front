import { useParams } from 'react-router-dom'
import { familyApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

export function OwnerTransferPage() {
  const { token = '' } = useParams()
  const action = useAction()

  async function accept() {
    if (!token) {
      action.setError('Link inválido.')
      return
    }
    if (await action.run(() => familyApi.acceptOwnerTransfer(token))) {
      showSaveToast('Autorização registrada. O orçamento muda quando o titular cancelar na loja.')
      window.location.assign('/app/membros')
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Assumir orçamento familiar" />
      <ErrorText message={action.error} />
      {action.busy ? <Loading /> : null}
      <section className={styles.section}>
        <p>
          Ao autorizar, você aceita assumir a administração. O orçamento do titular, deste mês em diante,
          passa para você quando ele cancelar a assinatura na loja. Você tem 24 horas depois disso para assinar
          e o grupo seguir com você.
        </p>
        <div className={styles.actions}>
          <Button disabled={action.busy || !token} onClick={() => void accept()}>
            Autorizar
          </Button>
        </div>
      </section>
    </div>
  )
}
