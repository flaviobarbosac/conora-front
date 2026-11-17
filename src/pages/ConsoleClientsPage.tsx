import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { monthsApi, type SharedMonthClient } from '../api/finance'
import { ErrorText, Empty, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { enterSharedMonth } from '../lib/consultantSession'
import { formatCompetence } from '../lib/format'
import layout from './pageStyles'
import styles from './ConsoleClientsPage.module.css'

export function ConsoleClientsPage() {
  const navigate = useNavigate()
  const data = useLoad(() => monthsApi.sharedWithMe(), [])
  const [month, setMonth] = useState('all')
  const [entering, setEntering] = useState<string | null>(null)
  const clients = data.data ?? []

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const client of clients) {
      for (const ym of client.months) set.add(ym)
    }
    return [...set].sort()
  }, [clients])

  const visible = month === 'all' ? clients : clients.filter((client) => client.months.includes(month))

  function enter(client: SharedMonthClient, ym: string) {
    setEntering(`${client.clientUsuarioId}:${ym}`)
    enterSharedMonth(client.clientUsuarioId, ym)
    navigate('/')
  }

  return (
    <div className={layout.page}>
      <header>
        <h1 className={layout.sectionTitle}>Clientes</h1>
        <p className={layout.muted}>
          Quem compartilhou um mês aparece aqui, com o mês em destaque. Entrar abre a conta daquele
          cliente só naquele mês. Para voltar à sua conta, saia e entre de novo.
        </p>
      </header>

      <ErrorText message={data.error} />
      {data.loading && !data.data ? <Loading /> : null}

      {clients.length > 0 ? (
        <label className={styles.filter}>
          Filtrar por mês
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="all">Todos os meses compartilhados</option>
            {months.map((ym) => (
              <option key={ym} value={ym}>
                {formatCompetence(ym)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {data.data && visible.length === 0 ? (
        <Empty>Nenhum cliente compartilhou um mês com você.</Empty>
      ) : null}

      {visible.length > 0 ? (
        <ul className={layout.list} aria-label="Clientes com mês compartilhado">
          {visible.map((client) => (
            <li key={client.clientUsuarioId} className={styles.card}>
              <strong>{client.name || client.email}</strong>
              <span className={layout.rowSub}>{client.email}</span>
              <span className={layout.rowSub}>
                {client.months.map((ym) => formatCompetence(ym)).join(', ')}
              </span>
              <div className={styles.months}>
                {client.months
                  .filter((ym) => month === 'all' || ym === month)
                  .map((ym) => (
                    <button
                      key={ym}
                      type="button"
                      className={styles.month}
                      disabled={entering !== null}
                      onClick={() => enter(client, ym)}
                    >
                      Entrar em {formatCompetence(ym)}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
