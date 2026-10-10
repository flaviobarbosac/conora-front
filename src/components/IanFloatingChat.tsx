import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi, type IanAskResponse, type IanReportQuery } from '../api/finance'
import { useAction } from '../hooks/useAction'
import { currentCompetence } from '../lib/format'
import { ianReportHref } from '../lib/ianReport'
import { IanAnalyzeDialog } from './IanAnalyzeDialog'
import { Button } from './ui/Button'
import { ErrorText } from './ui/Feedback'
import { Icon } from './ui/Icon'
import styles from './IanFloatingChat.module.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  query?: IanReportQuery | null
  choices?: string[] | null
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function IanFloatingChat() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const action = useAction()
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!listRef.current || !open) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, action.busy, open])

  async function ask(text: string) {
    if (!text || action.busy) return

    setMessages((prev) => [...prev, { id: newId(), role: 'user', text }])
    setDraft('')

    await action.run(async () => {
      const res: IanAskResponse = await aiApi.ianAsk(text, currentCompetence())
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: res.answer,
          query: res.canOpenReport ? res.query : null,
          choices: res.choices,
        },
      ])

      if (res.canOpenReport && res.query) {
        navigate(ianReportHref(res.query))
      }
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    await ask(draft.trim())
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    void ask(draft.trim())
  }

  return (
    <>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Ian" aria-modal="false">
          <div className={styles.head}>
            <div className={styles.headTitle}>
              <img className={styles.headFace} src={`${import.meta.env.BASE_URL}assets/ian-garoto.jpg`} alt="" />
              <strong>Ian</strong>
            </div>
            <div className={styles.headActions}>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Limpar conversa"
                disabled={messages.length === 0}
                onClick={() => setMessages([])}
              >
                <Icon name="trash" size={20} />
              </button>
              <button type="button" className={styles.iconBtn} aria-label="Fechar Ian" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </div>
          <div className={styles.body}>
            <div className={styles.modeRow}>
              <Button type="button" variant="secondary" onClick={() => setAnalyzeOpen(true)}>
                Analisar contas
              </Button>
            </div>
            <p className={styles.hint}>
              Prefira <strong>Analisar contas</strong> para escolher o plano e o período. Ou pergunte rápido abaixo.
            </p>
            <div ref={listRef} className={styles.list} aria-live="polite">
              {messages.length === 0 ? <p className={styles.hint}>Ex.: Como está meu mês?</p> : null}
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}
                >
                  <strong>{message.role === 'user' ? 'Você' : 'Ian'}</strong>
                  <p className={styles.bubbleText}>{message.text}</p>
                  {message.choices && message.choices.length > 0 ? (
                    <ul className={styles.choices}>
                      {message.choices.map((choice) => (
                        <li key={choice}>{choice}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
            <form className={styles.form} onSubmit={(event) => void submit(event)}>
              <label className={styles.hint} htmlFor="ian-float-question">
                Pergunta rápida
              </label>
              <textarea
                id="ian-float-question"
                className={styles.input}
                name="question"
                required
                maxLength={1000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Como está meu mês?"
              />
              <ErrorText message={action.error} />
              <div className={styles.actions}>
                <Button type="submit" disabled={action.busy}>
                  {action.busy ? 'Pensando…' : 'Perguntar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.fab}
        aria-label={open ? 'Fechar Ian' : 'Abrir Ian'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <img className={styles.fabFace} src={`${import.meta.env.BASE_URL}assets/ian-garoto.jpg`} alt="" />
        <span className={styles.fabLabel}>Ian</span>
      </button>

      <IanAnalyzeDialog open={analyzeOpen} onClose={() => setAnalyzeOpen(false)} />
    </>
  )
}
