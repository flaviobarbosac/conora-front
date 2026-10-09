import { Button } from './ui/Button'
import styles from './Pager.module.css'

type Props = {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function Pager({ page, pageCount, total, pageSize, onPageChange }: Props) {
  if (total <= pageSize) {
    return null
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className={styles.pager} role="navigation" aria-label="Paginação">
      <span className={styles.meta}>
        {from}–{to} de {total}
      </span>
      <div className={styles.actions}>
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior">
          Anterior
        </Button>
        <span className={styles.pageLabel}>
          {page} / {pageCount}
        </span>
        <Button
          variant="ghost"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
