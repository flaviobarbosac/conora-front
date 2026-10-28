import { consoleApi } from '../api/finance'
import { ErrorText, Loading, Empty } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { formatDateTime } from '../lib/format'
import layout from './page.module.css'
import styles from './ConsolePage.module.css'

/** Console view: login, entry screen, whether they launched, and the path trail. */
export function ConsoleAbandonmentPage() {
  const data = useLoad(() => consoleApi.abandonment(), [])
  const rows = data.data ?? []

  return (
    <div className={layout.page}>
      <header className={styles.intro}>
        <h1 className={styles.introTitle}>Abandono</h1>
        <p className={styles.introText}>
          Quem entrou nos últimos 30 dias, a primeira tela, se fez lançamento e o caminho percorrido. Use para
          retenção de quem só faz login.
        </p>
      </header>

      <ErrorText message={data.error} />
      {data.loading && !data.data ? <Loading /> : null}
      {data.data && rows.length === 0 ? <Empty>Nenhum rastro de jornada ainda.</Empty> : null}

      {rows.length > 0 ? (
        <ul className={layout.list} aria-label="Jornadas de abandono">
          {rows.map((row) => (
            <li key={row.usuarioId} className={layout.row}>
              <span className={layout.rowMain}>
                <strong>{row.name || row.email}</strong>
                <span className={layout.rowSub}>
                  {row.email}
                  {row.firstLoginAt ? ` · Login ${formatDateTime(row.firstLoginAt)}` : ''}
                  {row.lastSeenAt ? ` · Último ${formatDateTime(row.lastSeenAt)}` : ''}
                </span>
                <span className={layout.rowSub}>
                  Entrada: {row.firstPath ?? '—'} · Parou em: {row.lastPath ?? '—'}
                  {row.onboardingCompleted ? ' · Onboarding ok' : ' · Onboarding incompleto'}
                  {row.hasEntry ? ' · Já lançou' : ' · Sem lançamento'}
                </span>
                {row.pathTrail.length > 0 ? (
                  <span className={layout.muted}>{row.pathTrail.join(' → ')}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
