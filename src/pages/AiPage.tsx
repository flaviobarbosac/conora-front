import { useState, type FormEvent } from 'react'
import { aiApi, type AiAnswer } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText } from '../components/ui/Feedback'
import { TextArea } from '../components/ui/TextArea'
import { useAction } from '../hooks/useAction'
import { currentCompetence } from '../lib/format'
import styles from './page.module.css'

export function AiPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AiAnswer | null>(null)
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    await action.run(async () => setAnswer(await aiApi.ask(question.trim(), currentCompetence())))
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Perguntar à IA" />
      <section className={styles.section}>
        <p className={styles.muted}>O Gemini responde com base nos números do mês atual. O app continua funcionando se ele estiver indisponível.</p>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <div className={styles.formWide}>
            <TextArea
              label="Sua pergunta"
              name="question"
              required
              maxLength={1000}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </div>
          <div className={styles.formWide}>
            <ErrorText message={action.error} />
          </div>
          <div className={styles.formActions}>
            <Button type="submit" disabled={action.busy}>
              {action.busy ? 'Pensando…' : 'Perguntar'}
            </Button>
          </div>
        </form>
      </section>
      {answer ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Resposta</h2>
          {answer.available ? (
            <p className={styles.pre}>{answer.answer}</p>
          ) : (
            <p className={styles.muted}>{answer.answer || 'A IA não está disponível no momento. Tente novamente mais tarde.'}</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
