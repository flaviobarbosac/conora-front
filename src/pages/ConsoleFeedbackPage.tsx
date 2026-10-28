import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  feedbackApi,
  type ConsoleFeedbackItem,
  type FeedbackStatus,
} from '../api/finance'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { TextArea } from '../components/ui/TextArea'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { FEEDBACK_RATING_LABELS, feedbackRatingColor } from '../lib/feedbackRatingColors'
import { formatDate } from '../lib/format'
import { showSaveToast } from '../lib/saveToast'
import styles from './ConsoleFeedbackPage.module.css'

const REPLY_TEMPLATES = [
  { id: 'thanks', ratings: [4, 5], label: 'Agradecimento' },
  { id: 'neutral', ratings: [3], label: 'Neutro' },
  { id: 'sorry', ratings: [1, 2], label: 'Desculpas' },
  { id: 'investigating', ratings: [1, 2, 3, 4, 5], label: 'Investigando' },
  { id: 'details', ratings: [1, 2, 3, 4, 5], label: 'Pedir detalhes' },
] as const

function templateText(id: string, name: string, module: string): string {
  switch (id) {
    case 'thanks':
      return `Olá ${name}, obrigado pelo retorno sobre o módulo ${module}! Ficamos felizes que a experiência foi positiva. Seguimos melhorando o Conora com a sua ajuda.`
    case 'neutral':
      return `Olá ${name}, obrigado por avaliar o módulo ${module}. Seu comentário nos ajuda a entender o que ainda pode melhorar. Vamos considerar cada ponto.`
    case 'sorry':
      return `Olá ${name}, sentimos que o módulo ${module} não atendeu o que você esperava. Vamos analisar o que você descreveu e trabalhar na correção. Obrigado por apontar o problema.`
    case 'investigating':
      return `Olá ${name}, recebemos seu feedback sobre ${module} e já estamos investigando. Assim que tivermos novidade, falamos com você.`
    case 'details':
      return `Olá ${name}, obrigado pelo retorno sobre ${module}. Para avançarmos, você pode detalhar um pouco mais o que aconteceu? Isso nos ajuda a priorizar o ajuste.`
    default:
      return ''
  }
}

function toLocalDateInput(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function defaultMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toLocalDateInput(from), to: toLocalDateInput(to) }
}

function statusLabel(status: FeedbackStatus) {
  if (status === 'Novo') return 'Novo'
  if (status === 'Respondido') return 'Respondido'
  return 'Lido'
}

function statusClass(status: FeedbackStatus) {
  if (status === 'Novo') return styles.statusNovo
  if (status === 'Respondido') return styles.statusRespondido
  return styles.statusLido
}

function truncate(text: string, max = 90) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

export function ConsoleFeedbackPage() {
  const range = useMemo(() => defaultMonthRange(), [])
  const [usuarioId, setUsuarioId] = useState('')
  const [status, setStatus] = useState<FeedbackStatus | ''>('')
  const [nota, setNota] = useState<number | ''>('')
  const [fromDate, setFromDate] = useState(range.from)
  const [toDate, setToDate] = useState(range.to)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState('')
  const [replyText, setReplyText] = useState('')
  const replyAction = useAction()

  const usuarios = useLoad(() => feedbackApi.listConsoleUsuarios(), [])
  const list = useLoad(
    () =>
      feedbackApi.listConsole({
        usuarioId: usuarioId || undefined,
        status: status || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        nota: nota === '' ? undefined : nota,
      }),
    [usuarioId, status, fromDate, toDate, nota],
  )
  const allOpen = useLoad(
    () => feedbackApi.listConsole({ status: 'Novo', take: 200 }),
    [],
  )
  const detail = useLoad(
    () => (selectedId ? feedbackApi.getConsole(selectedId) : Promise.resolve(null)),
    [selectedId],
  )

  useEffect(() => {
    setTemplateId('')
    setReplyText(detail.data?.resposta ?? '')
  }, [detail.data?.id, detail.data?.resposta])

  useEffect(() => {
    if (detail.data) {
      list.reload()
      allOpen.reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data?.status])

  const items = list.data ?? []
  const selected = detail.data
  const novoCount = allOpen.data?.length ?? 0
  const respondedInView = items.filter((i) => i.status === 'Respondido').length

  const visibleTemplates = REPLY_TEMPLATES.filter((template) =>
    selected ? template.ratings.includes(selected.nota as 1 | 2 | 3 | 4 | 5) : true,
  )

  function applyTemplate(id: string) {
    setTemplateId(id)
    if (!id || !selected) return
    setReplyText(templateText(id, selected.usuarioNome, selected.modulo))
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) return
    const texto = replyText.trim()
    if (!texto) return
    if (await replyAction.run(() => feedbackApi.replyConsole(selectedId, texto))) {
      showSaveToast('Resposta enviada. O usuário verá ao abrir o app.')
      detail.reload()
      list.reload()
      allOpen.reload()
    }
  }

  return (
    <div className={styles.stage}>
      <div>
        <h2 className={styles.sectionTitle}>Feedback</h2>
        <p className={styles.intro}>
          Caixa de entrada. Abrir um item marca como lido. A resposta aparece para a pessoa na
          próxima vez que ela abrir o Conora.
        </p>
      </div>

      <div className={styles.summary} aria-live="polite">
        <span className={novoCount > 0 ? styles.pillWarn : styles.pill}>
          {novoCount} novo{novoCount === 1 ? '' : 's'}
        </span>
        <span className={styles.pill}>{items.length} nesta lista</span>
        <span className={styles.pillOk}>{respondedInView} respondido{respondedInView === 1 ? '' : 's'} na visão</span>
      </div>

      <div className={styles.filters}>
        <label className={styles.filterField}>
          Status
          <select
            value={status}
            onChange={(e) => {
              setSelectedId(null)
              setStatus((e.target.value || '') as FeedbackStatus | '')
            }}
          >
            <option value="">Todos</option>
            <option value="Novo">Novos</option>
            <option value="Lido">Lidos</option>
            <option value="Respondido">Respondidos</option>
          </select>
        </label>
        <label className={styles.filterField}>
          Pessoa
          <select
            value={usuarioId}
            onChange={(e) => {
              setSelectedId(null)
              setUsuarioId(e.target.value)
            }}
          >
            <option value="">Todas</option>
            {(usuarios.data ?? []).map((u) => (
              <option key={u.usuarioId} value={u.usuarioId}>
                {u.usuarioNome}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Nota
          <select
            value={nota === '' ? '' : String(nota)}
            onChange={(e) => {
              setSelectedId(null)
              setNota(e.target.value === '' ? '' : Number(e.target.value))
            }}
          >
            <option value="">Todas</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} — {FEEDBACK_RATING_LABELS[n]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          De
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className={styles.filterField}>
          Até
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
      </div>

      <ErrorText message={list.error} />

      <div className={styles.workspace}>
        <section className={styles.listPanel} aria-label="Lista de feedbacks">
          {list.loading && !list.data ? (
            <div className={styles.emptyList}>
              <Loading />
            </div>
          ) : null}
          {!list.loading && items.length === 0 ? (
            <p className={styles.emptyList}>Nenhum feedback para estes filtros.</p>
          ) : null}
          {items.length > 0 ? (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.id}>
                  <FeedbackRow
                    item={item}
                    active={selectedId === item.id}
                    onSelect={() => setSelectedId(item.id)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={styles.detailPanel} aria-label="Detalhe do feedback">
          {!selectedId ? (
            <p className={styles.detailEmpty}>Selecione um feedback à esquerda para ler e responder.</p>
          ) : null}
          {selectedId ? (
            <>
              <ErrorText message={detail.error} />
              {detail.loading && !selected ? <Loading /> : null}
              {selected ? (
                <>
                  <div className={styles.detailHead}>
                    <div className={styles.rowMeta}>
                      <span className={statusClass(selected.status)}>{statusLabel(selected.status)}</span>
                      <span>{formatDate(selected.createdAt)}</span>
                    </div>
                    <h3>
                      {selected.usuarioNome} · {selected.modulo}
                    </h3>
                    {selected.rota ? <p className={styles.metaLine}>{selected.rota}</p> : null}
                    <p className={styles.rating} style={{ color: feedbackRatingColor(selected.nota) }}>
                      {selected.nota} ★ · {FEEDBACK_RATING_LABELS[selected.nota]}
                    </p>
                  </div>
                  <p className={styles.comment}>{selected.comentario}</p>
                  {selected.lidoPorUsuarioNome ? (
                    <p className={styles.metaLine}>
                      Lido por {selected.lidoPorUsuarioNome}
                      {selected.lidoEm ? ` em ${formatDate(selected.lidoEm)}` : ''}
                    </p>
                  ) : null}
                  {selected.respondidoPorUsuarioNome ? (
                    <p className={styles.metaLine}>
                      Respondido por {selected.respondidoPorUsuarioNome}
                      {selected.respondidoEm ? ` em ${formatDate(selected.respondidoEm)}` : ''}
                    </p>
                  ) : null}

                  <form className={styles.replyForm} onSubmit={(e) => void sendReply(e)}>
                    <span className={styles.metaLine}>Resposta rápida</span>
                    <div className={styles.templates} role="group" aria-label="Modelos de resposta">
                      <button
                        type="button"
                        className={!templateId ? styles.templateBtnActive : styles.templateBtn}
                        onClick={() => applyTemplate('')}
                      >
                        Do zero
                      </button>
                      {visibleTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={templateId === t.id ? styles.templateBtnActive : styles.templateBtn}
                          onClick={() => applyTemplate(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <TextArea
                      label="Mensagem ao usuário"
                      name="resposta"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={6}
                      maxLength={2000}
                      required
                    />
                    <ErrorText message={replyAction.error} />
                    <div className={styles.actions}>
                      <Button type="button" variant="secondary" onClick={() => setSelectedId(null)}>
                        Fechar
                      </Button>
                      <Button type="submit" disabled={replyAction.busy || !replyText.trim()}>
                        {replyAction.busy ? 'Enviando…' : 'Enviar resposta'}
                      </Button>
                    </div>
                  </form>
                </>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function FeedbackRow({
  item,
  active,
  onSelect,
}: {
  item: ConsoleFeedbackItem
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={active ? styles.rowActive : styles.row}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className={styles.rowTitle}>
        {item.usuarioNome} · {item.modulo}
      </span>
      <span className={styles.rowMeta}>
        <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
        <span>{formatDate(item.createdAt)}</span>
        <span style={{ color: feedbackRatingColor(item.nota), fontWeight: 600 }}>{item.nota} ★</span>
      </span>
      <span className={styles.rowPreview}>{truncate(item.comentario)}</span>
    </button>
  )
}
