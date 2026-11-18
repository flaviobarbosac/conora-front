import { consoleApi, type JourneyAbandonmentRow } from '../api/finance'
import { ErrorText, Loading, Empty } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { formatDateTime } from '../lib/format'
import layout from './pageStyles'
import styles from './ConsoleAbandonmentPage.module.css'

const SCREENS: ReadonlyArray<readonly [string, string]> = [
  ['/lancamentos', 'Lançamentos'],
  ['/raio-x', 'Raio-X'],
  ['/orcamento', 'Orçamento'],
  ['/onboarding', 'Onboarding'],
  ['/contas', 'Contas'],
  ['/cartoes', 'Cartões'],
  ['/projetos', 'Projetos'],
  ['/diagnostico', 'Diagnóstico'],
  ['/categorias', 'Categorias'],
  ['/plano', 'Planos'],
  ['/perfil', 'Perfil'],
  ['/membros', 'Grupo'],
  ['/mes', 'Mês'],
  ['/console', 'Console'],
  ['/importar', 'Importar'],
  ['/relatorios', 'Relatórios'],
  ['/configuracoes', 'Configurações'],
  ['/', 'Início'],
]

function screenName(path: string | null): string {
  if (!path) return 'Sem tela'
  const clean = path.replace(/^\/app(?=\/|$)/, '') || '/'
  const hit = SCREENS.find(([prefix]) =>
    prefix === '/' ? clean === '/' : clean === prefix || clean.startsWith(`${prefix}/`),
  )
  return hit?.[1] ?? clean
}

function Person({ row }: { row: JourneyAbandonmentRow }) {
  const when = [
    row.email,
    row.lastSeenAt ? `último ${formatDateTime(row.lastSeenAt)}` : null,
    row.onboardingCompleted ? null : 'onboarding incompleto',
  ].filter(Boolean)

  return (
    <li className={styles.person}>
      <strong>{row.name || row.email}</strong>
      <p className={styles.stop}>Parou em {screenName(row.lastPath)}</p>
      <p className={styles.meta}>Entrou por {screenName(row.firstPath)}</p>
      <p className={styles.meta}>{when.join(' · ')}</p>
    </li>
  )
}

function Group({ title, rows }: { title: string; rows: JourneyAbandonmentRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className={styles.group}>
      <h2>
        {title} · {rows.length}
      </h2>
      <ul className={styles.people}>
        {rows.map((row) => (
          <Person key={row.usuarioId} row={row} />
        ))}
      </ul>
    </section>
  )
}

/** Console view: who browsed in 30 days, where they stopped, and whether they posted an entry. */
export function ConsoleAbandonmentPage() {
  const data = useLoad(() => consoleApi.abandonment(), [])
  const rows = data.data ?? []
  const stopped = rows.filter((row) => !row.hasEntry)
  const launched = rows.filter((row) => row.hasEntry)

  return (
    <div className={`${layout.page} ${styles.page}`}>
      <header className={layout.header}>
        <div>
          <h1>Abandono</h1>
          <p className={layout.muted}>Quem navegou nos últimos 30 dias e ainda não lançou.</p>
        </div>
      </header>

      <ErrorText message={data.error} />
      {data.loading && !data.data ? <Loading /> : null}
      {data.data && rows.length === 0 ? <Empty>Nenhum rastro de jornada ainda.</Empty> : null}

      {rows.length > 0 ? (
        <>
          <div className={styles.totals}>
            <div className={styles.total}>
              <span>Pessoas</span>
              <strong>{rows.length}</strong>
            </div>
            <div className={styles.total}>
              <span>Sem lançamento</span>
              <strong>{stopped.length}</strong>
            </div>
            <div className={styles.total}>
              <span>Já lançou</span>
              <strong>{launched.length}</strong>
            </div>
          </div>
          <div className={styles.groups}>
            <Group title="Sem lançamento" rows={stopped} />
            <Group title="Já lançou" rows={launched} />
          </div>
        </>
      ) : null}
    </div>
  )
}
