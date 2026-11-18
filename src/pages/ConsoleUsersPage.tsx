import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { consoleApi, type ConsoleUserAccess, type PlanKind } from '../api/finance'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { ErrorText, Empty, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { formatCompetence, formatDate } from '../lib/format'
import { planKindLabel } from '../lib/planAccess'
import { confirmDestructive } from '../lib/confirm'
import { enterSharedMonth } from '../lib/consultantSession'
import { showSaveToast } from '../lib/saveToast'
import layout from './pageStyles'
import styles from './ConsoleUsersPage.module.css'

const ASSIGNABLE_PLANS: ReadonlyArray<PlanKind> = [
  'IndividualMonthly',
  'IndividualYearly',
  'FamilyMonthly',
  'FamilyYearly',
  'FamilyPlusMonthly',
  'FamilyPlusYearly',
]

type Panel = 'extend' | 'plan' | 'months' | null

const PAGE_SIZE = 20

type ColumnFilters = {
  name: string
  email: string
  created: string
  tasting: string
  plan: string
  shared: string
}

const EMPTY_FILTERS: ColumnFilters = {
  name: '',
  email: '',
  created: '',
  tasting: '',
  plan: '',
  shared: '',
}

function sharedMonthText(user: ConsoleUserAccess): string {
  return (user.sharedMonths ?? []).map((ym) => formatCompetence(ym)).join(', ')
}

/** Registered accounts, newest first. Trial extension and plan grants are free operator actions. */
export function ConsoleUsersPage() {
  const data = useLoad(() => consoleApi.listUsers(), [])
  const save = useAction()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [until, setUntil] = useState('')
  const [planKind, setPlanKind] = useState<PlanKind>('IndividualMonthly')
  const [filters, setFilters] = useState<ColumnFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const rows = data.data ?? []
  const filtered = useMemo(() => {
    const name = filters.name.trim().toLowerCase()
    const email = filters.email.trim().toLowerCase()
    const created = filters.created.trim().toLowerCase()
    const tasting = filters.tasting.trim().toLowerCase()
    const plan = filters.plan.trim().toLowerCase()
    const shared = filters.shared.trim().toLowerCase()
    return rows.filter((user) => {
      const monthText = sharedMonthText(user).toLowerCase()
      return (
        (name.length === 0 || (user.name || '').toLowerCase().includes(name)) &&
        (email.length === 0 || user.email.toLowerCase().includes(email)) &&
        (created.length === 0 || formatDate(user.createdAt).toLowerCase().includes(created)) &&
        (tasting.length === 0 || formatDate(user.tastingEndsAt).toLowerCase().includes(tasting)) &&
        (plan.length === 0 || (user.plan || 'Gratuito').toLowerCase().includes(plan)) &&
        (shared.length === 0 || monthText.includes(shared))
      )
    })
  }, [rows, filters])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selected = rows.find((row) => row.id === selectedId) ?? null

  function setFilter(key: keyof ColumnFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  useEffect(() => {
    if (!menuId) return
    function close() {
      setMenuId(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuId(null)
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuId])

  function selectRow(user: ConsoleUserAccess) {
    if (user.id !== selectedId) setPanel(null)
    setSelectedId(user.id)
    setMenuId(null)
  }

  function openExtend(user: ConsoleUserAccess) {
    setSelectedId(user.id)
    setMenuId(null)
    setUntil('')
    setPanel('extend')
    save.setError(null)
  }

  function enterMonth(user: ConsoleUserAccess, ym: string) {
    enterSharedMonth(user.id, ym)
    const base = import.meta.env.BASE_URL || '/'
    window.location.assign(base.endsWith('/') ? base : `${base}/`)
  }

  function openPlan(user: ConsoleUserAccess) {
    setSelectedId(user.id)
    setMenuId(null)
    setPlanKind('IndividualMonthly')
    setPanel('plan')
    save.setError(null)
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const date = until.trim()
    const indefinite = date.length === 0
    const who = selected.name || selected.email
    const what = indefinite
      ? `Estender a degustação de ${who} sem data de fim? Sem cobrança.`
      : `Estender a degustação de ${who} até ${formatDate(date)}? Sem cobrança.`
    const confirmed = await confirmDestructive(what, {
      title: 'Estender degustação',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      danger: false,
    })
    if (!confirmed) return
    await save.run(async () => {
      await consoleApi.setGrant(selected.id, indefinite, indefinite ? null : date)
      setPanel(null)
      setUntil('')
      showSaveToast(indefinite ? 'Degustação sem data de fim.' : 'Degustação estendida até a data.')
      data.reload()
    })
  }

  async function onSavePlan(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const who = selected.name || selected.email
    const confirmed = await confirmDestructive(
      `Atribuir ${planKindLabel(planKind)} para ${who}? Sem cobrança na loja.`,
      { title: 'Alterar plano', confirmLabel: 'Confirmar', cancelLabel: 'Cancelar', danger: false },
    )
    if (!confirmed) return
    await save.run(async () => {
      await consoleApi.assignPlan(selected.id, planKind)
      setPanel(null)
      showSaveToast('Plano atribuído. Sem cobrança na loja.')
      data.reload()
    })
  }

  return (
    <div className={layout.page}>
      <header className={layout.header}>
        <div>
          <h1>Usuários</h1>
        </div>
      </header>

      {panel === 'months' && selected && (selected.sharedMonths ?? []).length > 0 ? (
        <form className={layout.form} onSubmit={(event) => event.preventDefault()}>
          <h2 className={layout.sectionTitle}>Mês compartilhado</h2>
          <p className={layout.muted}>
            {selected.name || selected.email}. Escolha o mês para ver o raio-X, o orçamento e os lançamentos.
          </p>
          <Select
            label="Mês"
            name="sharedMonth"
            value=""
            onChange={(event) => {
              const ym = event.target.value
              if (!ym) return
              enterMonth(selected, ym)
            }}
          >
            <option value="">Selecione o mês</option>
            {(selected.sharedMonths ?? []).map((ym) => (
              <option key={ym} value={ym}>
                {formatCompetence(ym)}
              </option>
            ))}
          </Select>
        </form>
      ) : null}
      {panel === 'extend' && selected ? (
        <form className={layout.form} onSubmit={(event) => void onSave(event)}>
          <h2 className={layout.sectionTitle}>Estender degustação</h2>
          <p className={layout.muted}>
            {selected.name || selected.email}. Sem cobrança. Em branco, fica sem data de fim.
          </p>
          <Field
            label="A degustação termina em"
            name="trialUntil"
            type="date"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
          />
          <div className={layout.formActions}>
            <Button type="submit" disabled={save.busy}>
              Salvar
            </Button>
            <Button type="button" variant="secondary" disabled={save.busy} onClick={() => setPanel(null)}>
              Fechar
            </Button>
          </div>
        </form>
      ) : null}
      {panel === 'plan' && selected ? (
        <form className={layout.form} onSubmit={(event) => void onSavePlan(event)}>
          <h2 className={layout.sectionTitle}>Alterar plano</h2>
          <p className={layout.muted}>
            {selected.name || selected.email}. Sem cobrança na loja. Vale um período a partir de agora.
          </p>
          <Select
            label="Plano"
            name="planKind"
            value={planKind}
            onChange={(event) => setPlanKind(event.target.value as PlanKind)}
          >
            {ASSIGNABLE_PLANS.map((kind) => (
              <option key={kind} value={kind}>
                {planKindLabel(kind)}
              </option>
            ))}
          </Select>
          <div className={layout.formActions}>
            <Button type="submit" disabled={save.busy}>
              Confirmar
            </Button>
            <Button type="button" variant="secondary" disabled={save.busy} onClick={() => setPanel(null)}>
              Fechar
            </Button>
          </div>
        </form>
      ) : null}
      <ErrorText message={save.error || data.error} />
      {data.loading && !data.data ? <Loading /> : null}
      {data.data && rows.length === 0 ? <Empty>Nenhum usuário cadastrado.</Empty> : null}
      {rows.length > 0 ? (
        <div className={styles.wrap}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.colName} />
              <col className={styles.colEmail} />
              <col className={styles.colWhen} />
              <col className={styles.colWhen} />
              <col className={styles.colPlan} />
              <col className={styles.colShared} />
              <col className={styles.colActions} />
            </colgroup>
            <thead>
              <tr className={styles.filterRow}>
                <th>
                  <input
                    aria-label="Filtrar nome"
                    placeholder="Nome"
                    value={filters.name}
                    onChange={(event) => setFilter('name', event.target.value)}
                  />
                </th>
                <th>
                  <input
                    aria-label="Filtrar e-mail"
                    placeholder="E-mail"
                    value={filters.email}
                    onChange={(event) => setFilter('email', event.target.value)}
                  />
                </th>
                <th>
                  <input
                    aria-label="Filtrar cadastro"
                    placeholder="Cadastro"
                    value={filters.created}
                    onChange={(event) => setFilter('created', event.target.value)}
                  />
                </th>
                <th>
                  <input
                    aria-label="Filtrar degustação"
                    placeholder="Degustação"
                    value={filters.tasting}
                    onChange={(event) => setFilter('tasting', event.target.value)}
                  />
                </th>
                <th>
                  <input
                    aria-label="Filtrar plano"
                    placeholder="Plano"
                    value={filters.plan}
                    onChange={(event) => setFilter('plan', event.target.value)}
                  />
                </th>
                <th>
                  <input
                    aria-label="Filtrar mês compartilhado"
                    placeholder="Mês"
                    value={filters.shared}
                    onChange={(event) => setFilter('shared', event.target.value)}
                  />
                </th>
                <th />
              </tr>
              <tr className={styles.titles}>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Cadastro</th>
                <th>Degustação</th>
                <th>Plano</th>
                <th>Tem mês compartilhado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const isSelected = user.id === selectedId
                return (
                  <tr
                    key={user.id}
                    className={isSelected ? styles.selected : styles.row}
                    aria-selected={isSelected}
                    onClick={() => selectRow(user)}
                  >
                    <td data-label="Nome">{user.name || user.email}</td>
                    <td className={styles.email} data-label="E-mail">
                      {user.email}
                    </td>
                    <td data-label="Cadastro">{formatDate(user.createdAt)}</td>
                    <td data-label="Degustação">{formatDate(user.tastingEndsAt)}</td>
                    <td data-label="Plano">{user.plan || 'Gratuito'}</td>
                    <td data-label="Tem mês compartilhado">
                      {(user.sharedMonths ?? []).map((ym) => formatCompetence(ym)).join(', ')}
                    </td>
                    <td className={styles.actions} data-label="Ações">
                      <button
                        type="button"
                        className={styles.kebab}
                        aria-label={`Ações de ${user.name || user.email}`}
                        aria-haspopup="menu"
                        aria-expanded={menuId === user.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedId(user.id)
                          setMenuId((current) => (current === user.id ? null : user.id))
                        }}
                      >
                        <span />
                        <span />
                        <span />
                      </button>
                      {menuId === user.id ? (
                        <div className={styles.menu} role="menu" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            role="menuitem"
                            className={styles.menuItem}
                            onClick={() => openExtend(user)}
                          >
                            Estender degustação
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className={styles.menuItem}
                            onClick={() => openPlan(user)}
                          >
                            Alterar plano
                          </button>
                          {(user.sharedMonths ?? []).length > 0 && panel !== 'plan' ? (
                            <button
                              type="button"
                              role="menuitem"
                              className={styles.menuItem}
                              onClick={() => {
                                setSelectedId(user.id)
                                setMenuId(null)
                                setPanel('months')
                              }}
                            >
                              Listar meses compartilhados
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? <Empty>Nenhum usuário com esses filtros.</Empty> : null}
          <div className={styles.pager}>
            <Button type="button" variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Anterior
            </Button>
            <span>
              Página {currentPage} de {pageCount}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
