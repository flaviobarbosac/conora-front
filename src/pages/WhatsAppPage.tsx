import { PageHeader } from '../components/PageHeader'
import styles from './page.module.css'

/** WhatsApp launch is deferred; keep the route so old links do not 404. */
export function WhatsAppPage() {
  return (
    <div className={styles.page}>
      <PageHeader secondary title="WhatsApp" />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Em breve</h2>
        <p className={styles.muted}>
          Lançamentos por WhatsApp ainda não estão disponíveis nesta versão. A funcionalidade entra em uma versão
          futura.
        </p>
      </section>
    </div>
  )
}
