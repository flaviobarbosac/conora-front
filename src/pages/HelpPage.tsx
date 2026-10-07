import { useMemo, useState } from 'react'
import { helpApi, type HelpModule } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Field } from '../components/ui/Field'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import help from './HelpPage.module.css'
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
  const helpData = useLoad(() => helpApi.get(), [])
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const data = helpData.data

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
      <ErrorText message={helpData.error} />
      {helpData.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Como o Conora funciona</h2>
            <p className={help.lead}>
              Cada tela e cada campo está explicado abaixo. Use a busca para achar um módulo ou atributo sem precisar de
              suporte.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7 passos para começar</h2>
            <ol className={help.steps}>
              {[...data.steps]
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <li key={step.key} className={help.step}>
                    <span className={help.stepIndex} aria-hidden="true">
                      {step.order}
                    </span>
                    <div>
                      <h3 className={help.stepTitle}>{step.title}</h3>
                      <p className={help.stepBody}>{step.text}</p>
                    </div>
                  </li>
                ))}
            </ol>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Módulos e campos</h2>
            {modules.length === 0 ? <p className={help.empty}>Nenhum módulo encontrado para essa busca.</p> : null}
            <div className={help.modules}>
              {modules.map((module) => {
                const open = openKey === module.key || Boolean(query.trim())
                return (
                  <article key={module.key} className={help.module}>
                    <button
                      type="button"
                      className={help.moduleToggle}
                      aria-expanded={open}
                      onClick={() => setOpenKey((current) => (current === module.key ? null : module.key))}
                    >
                      <span>
                        <h3 className={help.moduleTitle}>{module.title}</h3>
                        <p className={help.moduleSummary}>{module.summary}</p>
                      </span>
                      <span className={help.moduleChevron} aria-hidden="true">
                        {open ? '−' : '+'}
                      </span>
                    </button>
                    {open ? (
                      <dl className={help.fields}>
                        {module.fields.map((field) => (
                          <div key={`${module.key}-${field.name}`} className={help.field}>
                            <dt className={help.fieldName}>{field.name}</dt>
                            <dd className={help.fieldBody}>{field.description}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Glossário</h2>
            {glossary.length === 0 ? <p className={help.empty}>Nenhum termo encontrado para essa busca.</p> : null}
            <dl className={help.glossary}>
              {glossary.map((term) => (
                <div key={term.key} className={help.glossaryItem}>
                  <dt className={help.glossaryTerm}>{term.term}</dt>
                  <dd className={help.glossaryBody}>{term.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      ) : null}
    </div>
  )
}
