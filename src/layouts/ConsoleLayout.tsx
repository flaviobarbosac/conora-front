import { Outlet, useLocation } from 'react-router-dom'
import styles from './ConsoleLayout.module.css'

export function ConsoleLayout() {
  const { pathname } = useLocation()
  const mapa = pathname.includes('/console/mapa')
  const usuarios = pathname.includes('/console/usuarios')
  const wide = pathname.includes('/console/jornada-tipos') || mapa

  return (
    <div className={wide ? `${styles.shell} ${styles.shellWide}` : styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <p className={styles.kicker}>Console</p>
          {usuarios ? null : <h1 className={styles.title}>Operação do Conora</h1>}
          {usuarios ? null : (
            <p className={styles.lead}>
              {mapa
                ? 'Onde cada usuário está. O nome aparece no pin e no cartão desta tela.'
                : 'Cada área responde a uma pergunta. Nenhum nome de usuário aparece nas métricas — só no Feedback.'}
            </p>
          )}
        </div>
      </header>
      <div className={styles.body}>
        <Outlet />
      </div>
    </div>
  )
}
