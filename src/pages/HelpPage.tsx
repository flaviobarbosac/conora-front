import { useMemo, useState } from 'react'
import { helpApi, type HelpModule } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Field } from '../components/ui/Field'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import styles from './page.module.css'

function matchesQuery(module: HelpModule, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (module.title.toLowerCase().includes(q) || module.summary.toLowerCase().includes(q)) return true
  return module.fields.some(
    (field) => field.name.toLowerCase().includes(q) || field.description.toLowerCase().includes(q),
  )
}

export function HelpPage() {
  const help = useLoad(() => helpApi.get(), [])
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const data = help.data

  const modules = useMemo(() => {
    if (!data?.modules) return []
    return data.modules.filter((module) => matchesQuery(module, query.trim()))
  }, [data, query])

  const glossary = useMemo(() => {
    if (!data?.glossary) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.glossary
    return data.glossary.filter(
      (term) => term.term.toLowerCase().includes(q) || term.definition.toLowerCase().includes(q),
    )
  }, [data, query])

  return (
    <div className={styles.page}>
      <PageHeader
        secondary
        title="Central de ajuda"
        actions={
          <Field
            label="Buscar"
            name="helpSearch"
            placeholder="Módulo, campo ou termo…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        }
      />
      <ErrorText message={help.error} />
      {help.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Como o Conora funciona</h2>
            <p className={styles.muted}>
              Cada tela e cada campo está explicado abaixo. Use a busca para achar um módulo ou atributo sem precisar de
              suporte.
            </p>
          </section>

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
            <h2 className={styles.sectionTitle}>Módulos e campos</h2>
            {modules.length === 0 ? <p className={styles.muted}>Nenhum módulo encontrado para essa busca.</p> : null}
            <div className={styles.list}>
              {modules.map((module) => {
                const open = openKey === module.key || Boolean(query.trim())
                return (
                  <div key={module.key} className={styles.row} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <button
                      type="button"
                      className={styles.sectionHead}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'inherit',
                      }}
                      aria-expanded={open}
                      onClick={() => setOpenKey((current) => (current === module.key ? null : module.key))}
                    >
                      <span className={styles.rowMain}>
                        <strong>{module.title}</strong>
                        <span className={styles.rowSub}>{module.summary}</span>
                      </span>
                      <span className={styles.muted} aria-hidden>
                        {open ? '−' : '+'}
                      </span>
                    </button>
                    {open ? (
                      <dl className={styles.list} style={{ marginTop: '0.75rem' }}>
                        {module.fields.map((field) => (
                          <div key={`${module.key}-${field.name}`} className={styles.row}>
                            <span className={styles.rowMain}>
                              <strong>{field.name}</strong>
                              <span className={styles.rowSub}>{field.description}</span>
                            </span>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Glossário</h2>
            {glossary.length === 0 ? <p className={styles.muted}>Nenhum termo encontrado para essa busca.</p> : null}
            <dl className={styles.list}>
              {glossary.map((term) => (
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
