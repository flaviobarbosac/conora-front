import { helpApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import styles from './page.module.css'

export function HelpPage() {
  const help = useLoad(() => helpApi.get(), [])
  const data = help.data

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Ajuda" />
      <ErrorText message={help.error} />
      {help.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7 passos para começar</h2>
            <ol className={styles.list}>
              {[...data.steps]
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <li key={step.key} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>
                        {step.order}. {step.title}
                      </strong>
                      <span className={styles.rowSub}>{step.text}</span>
                    </span>
                  </li>
                ))}
            </ol>
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Glossário</h2>
            <dl className={styles.list}>
              {data.glossary.map((term) => (
                <div key={term.key} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>{term.term}</strong>
                    <span className={styles.rowSub}>{term.definition}</span>
                  </span>
                </div>
              ))}
            </dl>
          </section>
        </>
      ) : null}
    </div>
  )
}
