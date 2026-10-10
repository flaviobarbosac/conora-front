import { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi, categoriesApi, type Category, type CategorySection } from '../api/finance'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import {
  analyzePresetRange,
  defaultAnalyzeRange,
  ianReportHref,
  loadIanAnalyzeSelection,
  saveIanAnalyzeSelection,
  type IanAnalyzeSelection,
} from '../lib/ianReport'
import { Button } from './ui/Button'
import { ErrorText, Loading } from './ui/Feedback'
import styles from './IanAnalyzeDialog.module.css'

const SECTION_LABEL: Partial<Record<CategorySection, string>> = {
  Income: 'Receitas',
  Discount: 'Descontos',
  Essential: 'Essenciais',
  Social: 'Sociais',
  Expense: 'Despesas',
  LifeProject: 'Projetos de vida',
  Asset: 'Ativos',
  Liability: 'Passivos',
}

type Props = {
  open: boolean
  onClose: () => void
  initial?: IanAnalyzeSelection | null
}

export function IanAnalyzeDialog({ open, onClose, initial }: Props) {
  const navigate = useNavigate()
  const titleId = useId()
  const action = useAction()
  const categories = useLoad(() => categoriesApi.list(undefined, false, true), [])
  const defaults = defaultAnalyzeRange()
  const seed = initial ?? loadIanAnalyzeSelection()

  const [selected, setSelected] = useState<Set<string>>(() => new Set(seed?.categoryIds ?? []))
  const [fromYm, setFromYm] = useState(seed?.fromYm ?? defaults.fromYm)
  const [toYm, setToYm] = useState(seed?.toYm ?? defaults.toYm)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!open) return
    const next = initial ?? loadIanAnalyzeSelection()
    const range = defaultAnalyzeRange()
    setSelected(new Set(next?.categoryIds ?? []))
    setFromYm(next?.fromYm ?? range.fromYm)
    setToYm(next?.toYm ?? range.toYm)
    setFilter('')
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const grouped = useMemo(() => {
    const items = categories.data ?? []
    const needle = filter.trim().toLowerCase()
    const filtered = needle
      ? items.filter((c) => c.name.toLowerCase().includes(needle) || (c.displayNumber ?? '').includes(needle))
      : items
    const map = new Map<CategorySection, Category[]>()
    for (const cat of filtered) {
      const list = map.get(cat.section) ?? []
      list.push(cat)
      map.set(cat.section, list)
    }
    return map
  }, [categories.data, filter])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 12) next.add(id)
      return next
    })
  }

  function applyPreset(preset: 'month' | 'year' | 'last6') {
    const range = analyzePresetRange(preset)
    setFromYm(range.fromYm)
    setToYm(range.toYm)
  }

  async function submit() {
    if (selected.size === 0 || action.busy) return
    const payload = {
      categoryIds: [...selected],
      fromYm,
      toYm,
    }
    await action.run(async () => {
      const res = await aiApi.ianAnalyze(payload)
      saveIanAnalyzeSelection(payload)
      if (res.canOpenReport && res.query) {
        onClose()
        navigate(ianReportHref(res.query))
      } else {
        throw new Error(res.answer || 'Não foi possível montar a análise.')
      }
    })
  }

  if (!open) return null

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Analisar contas
          </h2>
          <button type="button" className={styles.close} aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>

        <p className={styles.hint}>Escolha até 12 contas do plano e o período. O Ian monta o gráfico.</p>

        <div className={styles.period}>
          <div className={styles.presets} role="group" aria-label="Atalhos de período">
            <Button type="button" variant="secondary" onClick={() => applyPreset('month')}>
              Este mês
            </Button>
            <Button type="button" variant="secondary" onClick={() => applyPreset('last6')}>
              6 meses
            </Button>
            <Button type="button" variant="secondary" onClick={() => applyPreset('year')}>
              Este ano
            </Button>
          </div>
          <div className={styles.ymRow}>
            <label>
              De
              <input type="month" value={fromYm} onChange={(e) => setFromYm(e.target.value)} />
            </label>
            <label>
              Até
              <input type="month" value={toYm} onChange={(e) => setToYm(e.target.value)} />
            </label>
          </div>
        </div>

        <label className={styles.searchLabel}>
          Buscar conta
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Nome ou número"
          />
        </label>

        <div className={styles.list} aria-label="Contas do plano">
          {categories.loading && !categories.data ? <Loading /> : null}
          <ErrorText message={categories.error} />
          {[...grouped.entries()].map(([section, items]) => (
            <section key={section} className={styles.section}>
              <h3 className={styles.sectionTitle}>{SECTION_LABEL[section] ?? section}</h3>
              <ul className={styles.accountList}>
                {items.map((cat) => (
                  <li key={cat.id}>
                    <label className={styles.accountRow}>
                      <input
                        type="checkbox"
                        checked={selected.has(cat.id)}
                        onChange={() => toggle(cat.id)}
                        disabled={!selected.has(cat.id) && selected.size >= 12}
                      />
                      <span>
                        {cat.displayNumber ? `${cat.displayNumber} · ` : ''}
                        {cat.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <ErrorText message={action.error} />

        <footer className={styles.footer}>
          <span className={styles.count}>{selected.size} selecionada(s)</span>
          <div className={styles.actions}>
            <Button type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={selected.size === 0 || action.busy}>
              {action.busy ? 'Montando…' : 'Gerar relatório'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
