import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ChartAccount } from '../api/finance'
import { filterChartAccountGroups, groupChartAccounts } from '../lib/chartAccountGroups'
import styles from './ChartAccountSelect.module.css'

type Props = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  /** Analytical accounts available for selection. */
  options: ChartAccount[]
  /** Full chart tree used to resolve synthetic (group) parent names. */
  tree: ChartAccount[]
  emptyLabel?: string
  required?: boolean
  disabled?: boolean
  id?: string
}

type FlatItem =
  | { kind: 'empty' }
  | { kind: 'account'; account: ChartAccount; groupName: string }

export function ChartAccountSelect({
  label,
  name,
  value,
  onChange,
  options,
  tree,
  emptyLabel,
  required,
  disabled,
  id,
}: Props) {
  const inputId = id ?? name
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const groups = useMemo(() => groupChartAccounts(options, tree), [options, tree])
  const filtered = useMemo(() => filterChartAccountGroups(groups, query), [groups, query])

  const selected = useMemo(() => options.find((account) => account.id === value) ?? null, [options, value])
  const selectedGroupName = useMemo(() => {
    if (!selected?.parentId) {
      return null
    }
    return tree.find((account) => account.id === selected.parentId)?.name ?? null
  }, [selected, tree])

  const flatItems = useMemo(() => {
    const items: FlatItem[] = []
    if (emptyLabel) {
      items.push({ kind: 'empty' })
    }
    for (const group of filtered) {
      for (const account of group.items) {
        items.push({ kind: 'account', account, groupName: group.groupName })
      }
    }
    return items
  }, [emptyLabel, filtered])

  useEffect(() => {
    if (!open) {
      return
    }
    setQuery('')
    setActiveIndex(0)
    const handle = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(handle)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function selectValue(next: string) {
    onChange(next)
    setOpen(false)
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(flatItems.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const item = flatItems[activeIndex]
      if (!item) {
        return
      }
      selectValue(item.kind === 'empty' ? '' : item.account.id)
    }
  }

  const displayLabel = selected?.name ?? emptyLabel ?? 'Selecione'
  const showPlaceholder = !selected

  return (
    <div className={styles.field} ref={rootRef}>
      <div className={styles.header}>
        <label htmlFor={inputId}>{label}</label>
      </div>
      <input type="hidden" name={name} value={value} required={required && !value ? true : undefined} />
      <button
        id={inputId}
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-readonly={disabled || undefined}
        aria-haspopup={disabled ? undefined : 'listbox'}
        aria-expanded={disabled ? undefined : open}
        aria-controls={disabled ? undefined : listId}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current)
          }
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={styles.value}>
          {showPlaceholder ? (
            <span className={styles.placeholder}>{displayLabel}</span>
          ) : (
            <>
              <strong>{selected ? `${selected.displayNumber ? `${selected.displayNumber} ` : ''}${selected.name}` : ''}</strong>
              {selectedGroupName ? <span>{selectedGroupName}</span> : null}
            </>
          )}
        </span>
        {disabled ? null : (
          <span className={styles.chevron} aria-hidden>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {open ? (
        <div className={styles.panel} role="presentation">
          <input
            ref={searchRef}
            className={styles.search}
            type="search"
            value={query}
            placeholder="Buscar conta ou grupo…"
            aria-label={`Buscar em ${label}`}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onSearchKeyDown}
          />
          <ul id={listId} className={styles.list} role="listbox" aria-label={label}>
            {emptyLabel ? (
              <li role="option" aria-selected={value === ''}>
                <button
                  type="button"
                  className={[
                    styles.emptyOption,
                    value === '' ? styles.optionSelected : '',
                    activeIndex === 0 ? styles.emptyOptionActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => setActiveIndex(0)}
                  onClick={() => selectValue('')}
                >
                  {emptyLabel}
                </button>
              </li>
            ) : null}

            {filtered.length === 0 ? (
              <li className={styles.noResults} role="presentation">
                Nenhuma conta encontrada.
              </li>
            ) : null}

            {filtered.map((group) => (
              <li key={group.groupId}>
                <div className={styles.groupLabel}>{group.groupName}</div>
                <ul className={styles.groupItems} role="group" aria-label={group.groupName}>
                  {group.items.map((account) => {
                    const index = flatItems.findIndex(
                      (item) => item.kind === 'account' && item.account.id === account.id,
                    )
                    const selectedOption = account.id === value
                    const active = index === activeIndex
                    return (
                      <li key={account.id} role="option" aria-selected={selectedOption}>
                        <button
                          type="button"
                          className={[
                            styles.option,
                            selectedOption ? styles.optionSelected : '',
                            active ? styles.optionActive : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectValue(account.id)}
                        >
                          {account.displayNumber ? `${account.displayNumber} ${account.name}` : account.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
