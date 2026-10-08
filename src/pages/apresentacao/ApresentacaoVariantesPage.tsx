import { NavLink, Navigate, useParams } from 'react-router-dom'
import { VarianteBento } from './VarianteBento'
import { VarianteJornada } from './VarianteJornada'
import { VarianteTour } from './VarianteTour'
import { VarianteVitrine } from './VarianteVitrine'
import styles from './variantes.module.css'

const VARIANTS = [
  { id: '1', label: 'Vitrine', Component: VarianteVitrine },
  { id: '2', label: 'Bento', Component: VarianteBento },
  { id: '3', label: 'Jornada', Component: VarianteJornada },
  { id: '4', label: 'Tour', Component: VarianteTour },
] as const

/** Design review page: renders one of the presentation variants plus a floating switcher. */
export function ApresentacaoVariantesPage() {
  const { variante } = useParams()
  const current = VARIANTS.find((item) => item.id === variante)

  if (!current) {
    return <Navigate to="/apresentacao/1" replace />
  }

  const { Component } = current

  return (
    <>
      <Component />
      <nav className={styles.switcher} aria-label="Variantes da apresentação">
        {VARIANTS.map((item) => (
          <NavLink
            key={item.id}
            to={`/apresentacao/${item.id}`}
            className={({ isActive }) => (isActive ? styles.active : undefined)}
          >
            {item.id} · {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
