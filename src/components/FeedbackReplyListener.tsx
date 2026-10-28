import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useMatch } from 'react-router-dom'
import { feedbackApi, type FeedbackItem } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { Button } from './ui/Button'
import styles from './ConfirmDialog.module.css'

type ReplyView = {
  id: string
  modulo: string
  resposta: string
}

export function FeedbackReplyListener() {
  const { session, authReady } = useAuth()
  const location = useLocation()
  const routeMatch = useMatch('/feedbacks/:id')
  const [reply, setReply] = useState<ReplyView | null>(null)
  const markedIds = useRef(new Set<string>())
  const checking = useRef(false)

  const showReply = useCallback((item: FeedbackItem) => {
    if (!item.resposta || item.respostaLidaEm) return
    setReply({
      id: item.id,
      modulo: item.modulo?.trim() || 'módulo',
      resposta: item.resposta,
    })
  }, [])

  const checkPending = useCallback(async () => {
    if (!session || checking.current) return
    checking.current = true
    try {
      const items = await feedbackApi.listMine()
      const pending = items.find((f) => !!f.resposta && !f.respostaLidaEm)
      if (pending) showReply(pending)
    } catch {
      /* ignore — reply will show on next focus */
    } finally {
      checking.current = false
    }
  }, [session, showReply])

  useEffect(() => {
    if (!authReady || !session) return
    if (location.pathname.startsWith('/console')) return
    void checkPending()
  }, [authReady, session, location.pathname, checkPending])

  useEffect(() => {
    function onFocus() {
      if (!session) return
      if (document.visibilityState === 'visible') void checkPending()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [session, checkPending])

  useEffect(() => {
    const id = routeMatch?.params.id
    if (!id || !session) return
    void feedbackApi
      .getMine(id)
      .then((dto) => {
        if (dto.resposta) showReply(dto)
      })
      .catch(() => undefined)
  }, [routeMatch?.params.id, session, showReply])

  useEffect(() => {
    if (!reply?.id || !reply.resposta) return
    if (markedIds.current.has(reply.id)) return
    markedIds.current.add(reply.id)
    void feedbackApi.markReplyRead(reply.id).catch(() => {
      markedIds.current.delete(reply.id)
    })
  }, [reply])

  if (!reply) {
    return null
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="feedback-reply-title"
      >
        <h2 id="feedback-reply-title" className={styles.title}>
          Resposta ao seu feedback
        </h2>
        <p className={styles.message}>
          Há uma resposta sobre <strong>{reply.modulo}</strong>.
        </p>
        <p className={styles.message}>{reply.resposta}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setReply(null)}>
            Fechar
          </Button>
          <Link to={`/feedbacks/${reply.id}`} onClick={() => setReply(null)}>
            <Button type="button">Ver detalhes</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
