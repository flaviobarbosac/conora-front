import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi, type IanAskResponse, type IanReportQuery } from '../api/finance'
import { IanAnalyzeDialog } from '../components/IanAnalyzeDialog'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText } from '../components/ui/Feedback'
import { TextArea } from '../components/ui/TextArea'
import { useAction } from '../hooks/useAction'
import { currentCompetence } from '../lib/format'
import { ianReportHref } from '../lib/ianReport'
import styles from './page.module.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  choices?: string[] | null
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function AiPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const action = useAction()
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, action.busy])

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
          choices: res.choices,
        },
      ])

      if (res.canOpenReport && res.query) {
        navigate(ianReportHref(res.query as IanReportQuery))
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
    <div className={styles.page}>
      <PageHeader secondary title="Ian" />
      <section className={styles.section}>
        <div className={styles.formActions}>
          <Button type="button" variant="secondary" onClick={() => setAnalyzeOpen(true)}>
            Analisar contas
          </Button>
        </div>
        <p className={styles.muted}>
          Use <strong>Analisar contas</strong> para escolher o plano e o período. Ou pergunte rápido abaixo.
        </p>
        <div ref={listRef} className={styles.ianChatList} aria-live="polite">
          {messages.length === 0 ? (
            <p className={styles.muted}>Faça uma pergunta sobre os seus dados.</p>
          ) : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className={message.role === 'user' ? styles.ianChatUser : styles.ianChatAssistant}
            >
              <strong>{message.role === 'user' ? 'Você' : 'Ian'}</strong>
              <p className={styles.pre}>{message.text}</p>
              {message.choices && message.choices.length > 0 ? (
                <ul className={styles.ianChoices}>
                  {message.choices.map((choice) => (
                    <li key={choice}>{choice}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <div className={styles.formWide}>
            <TextArea
              label="Pergunta para o Ian"
              name="question"
              required
              maxLength={1000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
          <div className={styles.formWide}>
            <ErrorText message={action.error} />
          </div>
          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => setMessages([])} disabled={messages.length === 0}>
              Limpar
            </Button>
            <Button type="submit" disabled={action.busy}>
              {action.busy ? 'Pensando…' : 'Perguntar'}
            </Button>
          </div>
        </form>
      </section>
      <IanAnalyzeDialog open={analyzeOpen} onClose={() => setAnalyzeOpen(false)} />
    </div>
  )
}
