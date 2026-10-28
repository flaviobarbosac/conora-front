import { NavLink, Outlet } from 'react-router-dom'
import { CONSOLE_NAV } from '../lib/consoleNav'
import styles from './ConsoleLayout.module.css'

export function ConsoleLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <p className={styles.kicker}>Console</p>
          <h1 className={styles.title}>Operação do Conora</h1>
          <p className={styles.lead}>
            Cada área responde a uma pergunta. Nenhum nome de usuário aparece nas métricas — só no
            Feedback.
          </p>
        </div>
        <nav className={styles.nav} aria-label="Áreas do console">
          {CONSOLE_NAV.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive }) => (isActive ? styles.navItemActive : styles.navItem)}
              title={item.purpose}
            >
              <span className={styles.navLabel}>{item.label}</span>
              <span className={styles.navPurpose}>{item.purpose}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <div className={styles.body}>
        <Outlet />
      </div>
    </div>
  )
}
