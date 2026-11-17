import { useState, type FormEvent } from 'react'
import { consoleApi, type ConsoleUserAccess } from '../api/finance'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { ErrorText, Empty } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { formatDate } from '../lib/format'
import { showSaveToast } from '../lib/saveToast'
import layout from './pageStyles'

function grantLabel(user: ConsoleUserAccess): string {
  if (user.complimentaryIndefinite) return 'Acesso sem data de fim'
  if (user.complimentaryUntilUtc) return `Acesso até ${formatDate(user.complimentaryUntilUtc)}`
  return 'Sem concessão'
}

export function ConsoleAccessPage() {
  const search = useAction()
  const grant = useAction()
  const trial = useAction()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<ConsoleUserAccess[] | null>(null)
  const [selected, setSelected] = useState<ConsoleUserAccess | null>(null)
  const [indefinite, setIndefinite] = useState(true)
  const [grantUntil, setGrantUntil] = useState('')
  const [trialEnd, setTrialEnd] = useState('')

  async function onSearch(event: FormEvent) {
    event.preventDefault()
    const query = term.trim()
    if (query.length < 2) {
      search.setError('Informe ao menos 2 letras do nome ou do e-mail.')
      return
    }
    await search.run(async () => {
      const rows = await consoleApi.searchUsers(query)
      setResults(rows)
      setSelected((current) => rows.find((row) => row.id === current?.id) ?? null)
    })
  }

  function choose(user: ConsoleUserAccess) {
    setSelected(user)
    setIndefinite(user.complimentaryIndefinite || !user.complimentaryUntilUtc)
    setGrantUntil(user.complimentaryUntilUtc?.slice(0, 10) ?? '')
    setTrialEnd(user.trialEndsAtUtc?.slice(0, 10) ?? '')
  }

  async function onGrant(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    if (!indefinite && !grantUntil) {
      grant.setError('Informe a data final ou marque o acesso sem data.')
      return
    }
    await grant.run(async () => {
      const updated = await consoleApi.setGrant(selected.id, indefinite, indefinite ? null : grantUntil)
      setSelected(updated)
      setResults((rows) => rows?.map((row) => (row.id === updated.id ? updated : row)) ?? rows)
      showSaveToast(indefinite ? 'Acesso sem data concedido.' : 'Acesso concedido até a data.')
    })
  }

  async function onClearGrant() {
    if (!selected) return
    await grant.run(async () => {
      const updated = await consoleApi.clearGrant(selected.id)
      setSelected(updated)
      setResults((rows) => rows?.map((row) => (row.id === updated.id ? updated : row)) ?? rows)
      setIndefinite(true)
      setGrantUntil('')
      showSaveToast('Concessão removida.')
    })
  }

  async function onTrial(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    if (!trialEnd) {
      trial.setError('Informe a data em que a degustação termina.')
      return
    }
    await trial.run(async () => {
      const updated = await consoleApi.setTrialEnd(selected.id, trialEnd)
      setSelected(updated)
      setResults((rows) => rows?.map((row) => (row.id === updated.id ? updated : row)) ?? rows)
      showSaveToast('Degustação estendida.')
    })
  }

  return (
    <div className={layout.page}>
      <header>
        <h1 className={layout.sectionTitle}>Acesso</h1>
        <p className={layout.muted}>
          Escolha um usuário. Sem data, o acesso fica indefinido. Com data, vale até aquele dia. A
          degustação de 7 dias ganha a data de fim que você marcar.
        </p>
      </header>

      <form className={layout.form} onSubmit={(event) => void onSearch(event)}>
        <Field
          label="Nome ou e-mail"
          name="term"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          autoComplete="off"
        />
        <div className={layout.formActions}>
          <Button type="submit" disabled={search.busy}>
            Buscar
          </Button>
        </div>
      </form>
      <ErrorText message={search.error} />

      {results && results.length === 0 ? <Empty>Nenhum usuário com esse nome ou e-mail.</Empty> : null}
      {results && results.length > 0 ? (
        <ul className={layout.list} aria-label="Usuários encontrados">
          {results.map((user) => (
            <li key={user.id} className={layout.row}>
              <button
                type="button"
                className={layout.rowMain}
                aria-pressed={selected?.id === user.id}
                onClick={() => choose(user)}
              >
                <strong>{user.name || user.email}</strong>
                <span className={layout.rowSub}>{user.email}</span>
                <span className={layout.rowSub}>
                  {grantLabel(user)}
                  {user.trialEndsAtUtc ? ` · Degustação até ${formatDate(user.trialEndsAtUtc)}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <>
          <form className={layout.form} onSubmit={(event) => void onGrant(event)}>
            <h2 className={layout.sectionTitle}>Conceder acesso</h2>
            <p className={layout.muted}>{selected.name || selected.email}</p>
            <label className={layout.rowSub}>
              <input
                type="checkbox"
                checked={indefinite}
                onChange={(event) => setIndefinite(event.target.checked)}
              />{' '}
              Sem data (acesso indefinido)
            </label>
            <Field
              label="Até o dia"
              name="grantUntil"
              type="date"
              value={grantUntil}
              disabled={indefinite}
              onChange={(event) => setGrantUntil(event.target.value)}
            />
            <div className={layout.formActions}>
              <Button type="submit" disabled={grant.busy}>
                Conceder
              </Button>
              {selected.complimentaryIndefinite || selected.complimentaryUntilUtc ? (
                <Button type="button" variant="secondary" disabled={grant.busy} onClick={() => void onClearGrant()}>
                  Remover concessão
                </Button>
              ) : null}
            </div>
          </form>
          <ErrorText message={grant.error} />

          <form className={layout.form} onSubmit={(event) => void onTrial(event)}>
            <h2 className={layout.sectionTitle}>Estender a degustação</h2>
            <Field
              label="A degustação termina em"
              name="trialEnd"
              type="date"
              value={trialEnd}
              onChange={(event) => setTrialEnd(event.target.value)}
              required
            />
            <div className={layout.formActions}>
              <Button type="submit" disabled={trial.busy}>
                Salvar data
              </Button>
            </div>
          </form>
          <ErrorText message={trial.error} />
        </>
      ) : null}
    </div>
  )
}
