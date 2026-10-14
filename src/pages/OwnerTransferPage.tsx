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
      showSaveToast('Você assumiu o orçamento familiar.')
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
          Ao aceitar, você passa a ser o responsável pelo orçamento do grupo e recebe as linhas de planejamento
          atuais. Só você poderá editar o orçamento familiar daí em diante.
        </p>
        <div className={styles.actions}>
          <Button disabled={action.busy || !token} onClick={() => void accept()}>
            Aceitar transferência
          </Button>
        </div>
      </section>
    </div>
  )
}
