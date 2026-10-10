import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import styles from './CategorySelect.module.css'

export type SearchableOption = {
  value: string
  label: string
  hint?: string
}

type Props = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  emptyLabel?: string
  searchPlaceholder?: string
  disabled?: boolean
  id?: string
}

type FlatItem = { kind: 'empty' } | { kind: 'option'; option: SearchableOption }

export function SearchableSelect({
  label,
  name,
  value,
  onChange,
  options,
  emptyLabel,
  searchPlaceholder = 'Digite para filtrar…',
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return options
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        (option.hint?.toLowerCase().includes(needle) ?? false),
    )
  }, [options, query])

  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value])

  const flatItems = useMemo(() => {
    const items: FlatItem[] = []
    if (emptyLabel) {
      items.push({ kind: 'empty' })
    }
    for (const option of filtered) {
      items.push({ kind: 'option', option })
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
      selectValue(item.kind === 'empty' ? '' : item.option.value)
    }
  }

  const displayLabel = selected?.label ?? emptyLabel ?? 'Selecione'
  const showPlaceholder = !selected

  return (
    <div className={styles.field} ref={rootRef}>
      <div className={styles.header}>
        <label htmlFor={inputId}>{label}</label>
      </div>
      <input type="hidden" name={name} value={value} />
      <button
        id={inputId}
        type="button"
        className={styles.trigger}
        disabled={disabled}
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
              <strong>{selected?.label}</strong>
              {selected?.hint ? <span>{selected.hint}</span> : null}
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
            placeholder={searchPlaceholder}
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
                Nenhuma opção encontrada.
              </li>
            ) : null}

            <li>
              <ul className={styles.groupItems} role="group" aria-label={label}>
                {filtered.map((option) => {
                  const index = flatItems.findIndex(
                    (item) => item.kind === 'option' && item.option.value === option.value,
                  )
                  const selectedOption = option.value === value
                  const active = index === activeIndex
                  return (
                    <li key={option.value} role="option" aria-selected={selectedOption}>
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
                        onClick={() => selectValue(option.value)}
                      >
                        {option.label}
                        {option.hint ? <span className={styles.optionHint}>{option.hint}</span> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}
