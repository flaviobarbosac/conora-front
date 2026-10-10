import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { PresentationChrome } from './Chrome'
import { FEATURES, feature, type Feature } from './content'
import { AiPreview, BudgetPreview, ChatPreview, PatrimonyPreview, ProjectPreview, RaioXPreview } from './Previews'
import styles from './varianteTour.module.css'

type Stop = {
  feature: Feature
  highlights: ReadonlyArray<string>
  preview: ReactNode
}

const STOPS: ReadonlyArray<Stop> = [
  {
    feature: feature('orcamento'),
    highlights: ['Previsto por categoria', 'Alertas quando passa do limite', 'Comparativo mês a mês'],
    preview: <BudgetPreview />,
  },
  {
    feature: feature('raio-x'),
    highlights: ['Balancete em árvore', 'Drill-down até o lançamento', 'Receita, essenciais, projetos e social'],
    preview: <RaioXPreview />,
  },
  {
    feature: feature('patrimonio'),
    highlights: ['Ativos e passivos', 'Patrimônio líquido no tempo', 'Separado do fluxo mensal'],
    preview: <PatrimonyPreview />,
  },
  {
    feature: feature('projetos'),
    highlights: ['Valor e data do objetivo', 'Parcela mensal sugerida', 'Integra ao orçamento'],
    preview: <ProjectPreview />,
  },
  {
    feature: feature('whatsapp'),
    highlights: ['Lançamento por mensagem', 'Chega como rascunho', 'Você confirma conta e categoria'],
    preview: <ChatPreview />,
  },
  {
    feature: feature('ia'),
    highlights: ['Perguntas em linguagem natural', 'Baseada nos números do mês', 'O app segue funcionando sem ela'],
    preview: <AiPreview />,
  },
]

const TOUR_KEYS = new Set(STOPS.map((stop) => stop.feature.key))
const EXTRAS = FEATURES.filter((item) => !TOUR_KEYS.has(item.key))

/** Variant 4 — interactive tour: tabs switch a large product preview. */
export function VarianteTour() {
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const stop = STOPS[active]

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (active + delta + STOPS.length) % STOPS.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <PresentationChrome>
      <section className={styles.band}>
        <div className={styles.bandInner}>
          <p className={styles.kicker}>Tour pelo Conora</p>
          <h1>Veja o que o Conora faz pela sua família</h1>
          <p className={styles.lead}>Escolha um módulo e explore como ele funciona por dentro.</p>
        </div>
      </section>

      <section className={styles.tour}>
        <div className={styles.tabs} role="tablist" aria-label="Módulos do Conora">
          {STOPS.map((item, index) => (
            <button
              key={item.feature.key}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`tour-tab-${item.feature.key}`}
              aria-selected={index === active}
              aria-controls="tour-panel"
              tabIndex={index === active ? 0 : -1}
              className={styles.tab}
              onClick={() => setActive(index)}
              onKeyDown={onTabKeyDown}
            >
              <Icon name={item.feature.icon} size={20} />
              {item.feature.title}
            </button>
          ))}
        </div>

        <div
          key={stop.feature.key}
          id="tour-panel"
          role="tabpanel"
          aria-labelledby={`tour-tab-${stop.feature.key}`}
          className={styles.panel}
        >
          <div className={styles.panelCopy}>
            <Icon name={stop.feature.icon} variant="tile" />
            <h2>{stop.feature.title}</h2>
            <p>{stop.feature.text}</p>
            <ul className={styles.highlights}>
              {stop.highlights.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
          <div className={styles.panelPreview}>{stop.preview}</div>
        </div>

        <div className={styles.progress} aria-hidden="true">
          {STOPS.map((item, index) => (
            <span key={item.feature.key} className={index === active ? styles.progressActive : undefined} />
          ))}
        </div>
      </section>

      <section className={styles.extras} aria-labelledby="tour-extras">
        <h2 id="tour-extras">E ainda</h2>
        <ul>
          {EXTRAS.map((item) => (
            <li key={item.key}>
              <Icon name={item.icon} variant="duo" />
              <span>
                <strong>{item.title}</strong>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button onClick={() => navigate('/register')}>Criar conta</Button>
          <Button variant="secondary" onClick={() => navigate('/login')}>
            Já tenho conta
          </Button>
        </div>
      </section>
    </PresentationChrome>
  )
}
