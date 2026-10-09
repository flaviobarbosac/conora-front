import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { consumeIncomingShare } from '../share/receiveShare'
import { peekPendingShare, setPendingShare, takePendingShare, type PendingShare } from '../share/pendingShare'
import styles from './page.module.css'

export function ShareTargetPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [share, setShare] = useState<PendingShare | null>(peekPendingShare)
  const [loading, setLoading] = useState(!share)

  useEffect(() => {
    if (share) {
      return
    }
    let active = true
    void consumeIncomingShare().then((incoming) => {
      if (!active) {
        return
      }
      setShare(incoming)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [share])

  function confirm() {
    if (share) {
      setPendingShare(share)
    }
    navigate(session ? '/lancamentos?novo=1&recibo=1' : '/login', { replace: true })
  }

  function dismiss() {
    takePendingShare()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <section className={styles.section} aria-labelledby="share-title">
        <h1 id="share-title" className={styles.sectionTitle}>
          Quer lançar no Conora?
        </h1>
        {loading ? <p className={styles.muted}>Recebendo a imagem…</p> : null}
        {!loading && !share ? (
          <p className={styles.muted}>Nenhum recibo chegou neste compartilhamento.</p>
        ) : null}
        {share ? (
          <img className={styles.sharePreview} src={share.dataUrl} alt={share.fileName} />
        ) : null}
        <div className={styles.formActions}>
          <Button onClick={confirm} disabled={!share}>
            Confirmar lançamento
          </Button>
          <Button variant="secondary" onClick={dismiss}>
            Agora não
          </Button>
        </div>
      </section>
    </div>
  )
}
