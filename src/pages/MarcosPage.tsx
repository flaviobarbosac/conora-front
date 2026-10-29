import { Link } from 'react-router-dom'
import { gamificationApi, type Achievement } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { hasFullAccess } from '../lib/freeTier'
import { formatDateTime } from '../lib/format'
import pageStyles from './pageStyles'
import marcosStyles from './marcos/marcos.module.css'

const styles = { ...pageStyles, ...marcosStyles }

/** Route + label for the next action that advances a pending marco. */
function marcoCta(key: string): { to: string; label: string } {
  switch (key) {
    case 'budget-half-filled':
      return { to: '/orcamento', label: 'Abrir orçamento' }
    case 'first-month-closed':
      return { to: '/raio-x', label: 'Ver Raio-X' }
    case 'three-months-in-budget':
      return { to: '/orcamento', label: 'Abrir orçamento' }
    case 'payment-on-time':
      return { to: '/lancamentos', label: 'Ver lançamentos' }
    case 'reserve-started':
    case 'reserve-complete':
      return { to: '/raio-x', label: 'Ver Raio-X' }
    case 'project-progress':
      return { to: '/projetos', label: 'Ver projetos' }
    default:
      return { to: '/orcamento', label: 'Continuar jornada' }
  }
}

function marcoMeta(item: Achievement): string {
  if (item.points != null && item.age != null) {
    return `${item.points} pontos · idade ${item.age}.`
  }
  return item.description
}

function MarcoCard({
  item,
  showCta,
}: {
  item: Achievement
  showCta: boolean
}) {
  const cta = marcoCta(item.key)
  return (
    <li
      className={`${styles.marcoCard} ${item.earned ? styles.marcoCardEarned : styles.marcoCardPending}`}
    >
      <div className={styles.marcoCardHead}>
        <strong className={styles.marcoCardTitle}>{item.title}</strong>
        {item.earned ? (
          <Badge tone="ok">Conquistado</Badge>
        ) : (
          <span className={styles.marcoStatusPending}>Pendente</span>
        )}
      </div>
      <p className={styles.marcoCardMeta}>{marcoMeta(item)}</p>
      {item.earned && item.earnedAt ? (
        <p className={styles.marcoCardMeta}>Em {formatDateTime(item.earnedAt)}</p>
      ) : null}
      {showCta && !item.earned ? (
        <Link to={cta.to} className={styles.marcoCta}>
          {cta.label}
        </Link>
      ) : null}
    </li>
  )
}

function MarcoSection({
  title,
  items,
  showCta,
}: {
  title: string
  items: Achievement[]
  showCta: boolean
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <section className={styles.marcoSection} aria-label={title}>
      <h2 className={styles.marcoSectionTitle}>{title}</h2>
      <ul className={styles.marcoGrid}>
        {items.map((item) => (
          <MarcoCard key={item.key} item={item} showCta={showCta} />
        ))}
      </ul>
    </section>
  )
}

export function MarcosPage() {
  const { plan } = usePlanAccess()
  const canWrite = hasFullAccess(plan)
  const data = useLoad(() => gamificationApi.achievements(), [])
  const items = data.data?.items ?? []
  const quiet = data.data?.quietMode

  const earned = items.filter((item) => item.earned)
  const pending = items.filter((item) => !item.earned)
  const next = pending[0] ?? null
  const futuros = pending.slice(1)
  const earnedCount = earned.length
  const total = items.length
  const pointsEarned = earned.reduce((sum, item) => sum + (item.points ?? 0), 0)
  const pointsTotal = items.reduce((sum, item) => sum + (item.points ?? 0), 0)
  const progressPct = total > 0 ? Math.round((earnedCount / total) * 100) : 0
  const nextCta = next ? marcoCta(next.key) : null

  return (
    <div className={styles.page}>
      <PageHeader kicker="Cadastros" title="Marcos" />
      {!canWrite ? (
        <p className={styles.muted}>
          Você pode ver os marcos. A jornada completa fica nos{' '}
          <Link to="/plano">planos pagos</Link>.
        </p>
      ) : null}
      <ErrorText message={data.error} />
      {data.loading && !data.data ? <Loading /> : null}

      {data.data && items.length === 0 ? (
        <Empty>Sua jornada ainda não tem marcos para acompanhar.</Empty>
      ) : null}

      {quiet ? (
        <p className={styles.muted}>Modo silencioso ativo: os marcos ficam sem celebração.</p>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className={styles.marcoProgress} role="status" aria-live="polite">
            <div className={styles.marcoProgressHead}>
              <strong>
                {earnedCount}/{total} conquistados
              </strong>
              <span className={styles.marcoCardMeta}>
                {pointsEarned}/{pointsTotal} pontos
              </span>
            </div>
            <span className={styles.progress} aria-hidden>
              <span className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </span>
            {next ? (
              <p className={styles.marcoProgressNext}>
                Próximo: <strong>{next.title}</strong>
                {nextCta ? (
                  <>
                    {' · '}
                    <Link to={nextCta.to}>{nextCta.label}</Link>
                  </>
                ) : null}
              </p>
            ) : (
              <p className={styles.marcoProgressNext}>Todos os marcos conquistados.</p>
            )}
          </div>

          <div aria-label="Marcos do método">
            <MarcoSection title="Próximo" items={next ? [next] : []} showCta />
            <MarcoSection title="Futuros" items={futuros} showCta={false} />
            <MarcoSection title="Conquistados" items={earned} showCta={false} />
          </div>
        </>
      ) : null}
    </div>
  )
}
