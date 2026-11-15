import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { currentCompetence } from '../lib/format'
import { consumeIncomingShare } from '../share/receiveShare'
import { peekPendingShare, setPendingShare, takePendingShare, type PendingShare } from '../share/pendingShare'
import styles from './pageStyles'

function isStatementShare(share: PendingShare) {
  const name = share.fileName.toLowerCase()
  const mime = share.mimeType.toLowerCase()
  return (
    mime.includes('pdf') ||
    mime.includes('ofx') ||
    mime.includes('csv') ||
    name.endsWith('.pdf') ||
    name.endsWith('.ofx') ||
    name.endsWith('.qfx') ||
    name.endsWith('.csv')
  )
}

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

  const statement = share ? isStatementShare(share) : false

  function confirm() {
    if (share) {
      setPendingShare(share)
    }
    const next = statement
      ? `/lancamentos/extrato?mes=${encodeURIComponent(currentCompetence())}`
      : '/lancamentos?novo=1&recibo=1&canal=share'
    navigate(session ? next : `/login?returnTo=${encodeURIComponent(next)}`, { replace: true })
  }

  function dismiss() {
    takePendingShare()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <section className={styles.section} aria-labelledby="share-title">
        <h1 id="share-title" className={styles.sectionTitle}>
          {statement ? 'Quer importar este extrato no Conora?' : 'Quer lançar no Conora?'}
        </h1>
        {loading ? <p className={styles.muted}>Recebendo o arquivo…</p> : null}
        {!loading && !share ? (
          <p className={styles.muted}>Nenhum arquivo chegou neste compartilhamento.</p>
        ) : null}
        {share && !statement ? (
          <img className={styles.sharePreview} src={share.dataUrl} alt={share.fileName} />
        ) : null}
        {share && statement ? <p className={styles.muted}>{share.fileName}</p> : null}
        <div className={styles.formActions}>
          <Button onClick={confirm} disabled={!share}>
            Continuar
          </Button>
          <Button variant="secondary" onClick={dismiss}>
            Agora não
          </Button>
        </div>
      </section>
    </div>
  )
}
