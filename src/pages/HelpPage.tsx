import { useEffect, useMemo, useState } from 'react'
import { helpApi, type HelpModule } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Field } from '../components/ui/Field'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import help from './HelpPage.module.css'
import styles from './pageStyles'

const HELP_GROUPS = [
  { id: 'comecar', title: 'Começar', keys: ['onboarding'] },
  {
    id: 'dia-a-dia',
    title: 'Dia a dia',
    keys: ['inicio', 'lancamentos', 'raio-x', 'orcamento', 'diagnostico', 'mes'],
  },
  {
    id: 'cadastros',
    title: 'Cadastros',
    keys: ['contas', 'cartoes', 'categorias', 'projetos', 'patrimonio', 'importar'],
  },
  { id: 'familia', title: 'Família', keys: ['membros', 'familia-primeiro'] },
  {
    id: 'conta',
    title: 'Conta e app',
    keys: ['plano', 'relatorios', 'ia', 'menu', 'configuracoes', 'whatsapp'],
  },
] as const

function scrollToHelp(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function ModuleList({
  modules,
  openKey,
  query,
  onToggle,
}: {
  modules: HelpModule[]
  openKey: string | null
  query: string
  onToggle: (update: (current: string | null) => string | null) => void
}) {
  if (modules.length === 0) return null
  return (
    <div className={help.modules}>
      {modules.map((module) => (
        <ModuleCard
          key={module.key}
          module={module}
          open={openKey === module.key || Boolean(query)}
          onToggle={() => onToggle((current) => (current === module.key ? null : module.key))}
        />
      ))}
    </div>
  )
}

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
}: {
  module: HelpModule
  open: boolean
  onToggle: () => void
}) {
  return (
    <article className={help.module} id={module.key}>
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
    return hash || null
  })

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      setOpenKey(hash)
    }
  }, [])
  const data = helpData.data
  const q = query.trim()

  const groups = useMemo(() => {
    const modules = data?.modules ?? []
    const used = new Set<string>()
    const grouped: { id: string; title: string; items: HelpModule[] }[] = HELP_GROUPS.map((group) => {
      const items = group.keys
        .map((key) => modules.find((module) => module.key === key))
        .filter((module): module is HelpModule => Boolean(module))
        .filter((module) => matchesQuery(module, q))
      for (const item of items) used.add(item.key)
      return { id: group.id, title: group.title, items }
    })
    const rest = modules.filter((module) => !used.has(module.key) && matchesQuery(module, q))
    if (rest.length > 0) {
      grouped.push({ id: 'outros', title: 'Outros', items: rest })
    }
    return grouped.filter((group) => group.id === 'comecar' || group.items.length > 0)
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
              Cada pessoa tem a própria conta e os próprios lançamentos. No grupo familiar, algumas telas somam os dois
              sem misturar o dinheiro de cada um. Escolha um assunto para ir direto ao ponto.
            </p>
            <nav className={help.index} aria-label="Assuntos da ajuda">
              {groups
                .filter((group) => group.id === 'comecar' || group.items.length > 0)
                .map((group) => (
                  <button key={group.id} type="button" onClick={() => scrollToHelp(group.id)}>
                    {group.title}
                  </button>
                ))}
              <button type="button" onClick={() => scrollToHelp('glossario')}>
                Glossário
              </button>
            </nav>
          </section>

          <section id="comecar" className={`${styles.section} ${help.group}`}>
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
            <ModuleList
              modules={groups.find((group) => group.id === 'comecar')?.items ?? []}
              openKey={openKey}
              query={q}
              onToggle={setOpenKey}
            />
          </section>

          {groups
            .filter((group) => group.id !== 'comecar' && group.items.length > 0)
            .map((group) => (
              <section key={group.id} id={group.id} className={`${styles.section} ${help.group}`}>
                <h2 className={styles.sectionTitle}>{group.title}</h2>
                <ModuleList modules={group.items} openKey={openKey} query={q} onToggle={setOpenKey} />
              </section>
            ))}

          {q && groups.every((group) => group.items.length === 0) ? (
            <p className={help.empty}>Nenhum módulo encontrado para essa busca.</p>
          ) : null}

          <section id="glossario" className={`${styles.section} ${help.group}`}>
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
