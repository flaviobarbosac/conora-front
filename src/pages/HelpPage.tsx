import { useEffect, useMemo, useState } from 'react'
import { helpApi, type HelpModule } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Field } from '../components/ui/Field'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import help from './HelpPage.module.css'
import styles from './page.module.css'

const FEATURED_MODULE_KEY = 'membros'

function matchesQuery(module: HelpModule, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  if (module.title.toLowerCase().includes(q) || module.summary.toLowerCase().includes(q)) return true
  return module.fields.some(
    (field) => field.name.toLowerCase().includes(q) || field.description.toLowerCase().includes(q),
  )
}

function ModuleCard({
  module,
  open,
  onToggle,
  featured = false,
}: {
  module: HelpModule
  open: boolean
  onToggle: () => void
  featured?: boolean
}) {
  return (
    <article className={featured ? help.moduleFeatured : help.module}>
      {featured ? <p className={help.featuredBadge}>Destaque — leia primeiro</p> : null}
      <button
        type="button"
        className={help.moduleToggle}
        aria-expanded={open}
        onClick={onToggle}
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
}

export function HelpPage() {
  const helpData = useLoad(() => helpApi.get(), [])
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(() => {
    const hash = typeof window === 'undefined' ? '' : window.location.hash.replace('#', '')
    return hash || FEATURED_MODULE_KEY
  })

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      setOpenKey(hash)
    }
  }, [])
  const data = helpData.data
  const q = query.trim()

  const featured = useMemo(() => {
    if (!data?.modules) return null
    const module = data.modules.find((item) => item.key === FEATURED_MODULE_KEY)
    if (!module) return null
    return matchesQuery(module, q) ? module : null
  }, [data, q])

  const modules = useMemo(() => {
    if (!data?.modules) return []
    return data.modules
      .filter((module) => module.key !== FEATURED_MODULE_KEY)
      .filter((module) => matchesQuery(module, q))
  }, [data, q])

  const glossary = useMemo(() => {
    if (!data?.glossary) return []
    const lower = q.toLowerCase()
    if (!lower) return data.glossary
    return data.glossary.filter(
      (term) => term.term.toLowerCase().includes(lower) || term.definition.toLowerCase().includes(lower),
    )
  }, [data, q])

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
              Cada pessoa tem a própria conta e os próprios lançamentos. Se vocês formarem um grupo familiar, algumas
              telas mostram a soma dos dois — sem misturar o dinheiro de cada um. Veja o destaque abaixo sobre como
              vincular e desvincular.
            </p>
          </section>

          {featured ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Grupo familiar</h2>
              <ModuleCard
                module={featured}
                featured
                open={openKey === featured.key || Boolean(q)}
                onToggle={() => setOpenKey((current) => (current === featured.key ? null : featured.key))}
              />
            </section>
          ) : null}

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
            {modules.length === 0 && !featured ? <p className={help.empty}>Nenhum módulo encontrado para essa busca.</p> : null}
            <div className={help.modules}>
              {modules.map((module) => {
                const open = openKey === module.key || Boolean(q)
                return (
                  <ModuleCard
                    key={module.key}
                    module={module}
                    open={open}
                    onToggle={() => setOpenKey((current) => (current === module.key ? null : module.key))}
                  />
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
