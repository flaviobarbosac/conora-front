import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { useTheme } from '../../theme/ThemeProvider'
import { PresentationChrome } from './Chrome'
import { feature, type Feature } from './content'
import { BudgetPreview, ChatPreview, PatrimonyPreview, ProjectPreview, RaioXPreview } from './Previews'
import styles from './varianteJornada.module.css'

type Chapter = {
  verb: string
  title: string
  text: string
  features: ReadonlyArray<Feature>
  preview: ReactNode
}

const CHAPTERS: ReadonlyArray<Chapter> = [
  {
    verb: 'Registre',
    title: 'Tudo entra sem esforço',
    text: 'Lance no app, importe o extrato do banco ou mande uma mensagem no WhatsApp. O Conora organiza em categorias.',
    features: [feature('lancamentos'), feature('importar'), feature('whatsapp')],
    preview: <ChatPreview />,
  },
  {
    verb: 'Planeje',
    title: 'O mês começa com um plano',
    text: 'Defina quanto cabe em cada conta e acompanhe o realizado em tempo real — os desvios aparecem antes de virar problema.',
    features: [feature('orcamento'), feature('mes')],
    preview: <BudgetPreview />,
  },
  {
    verb: 'Entenda',
    title: 'Do macro ao lançamento',
    text: 'O Raio-X abre o balancete em árvore e a IA responde perguntas sobre os números do mês em linguagem simples.',
    features: [feature('raio-x'), feature('ia')],
    preview: <RaioXPreview />,
  },
  {
    verb: 'Construa',
    title: 'Patrimônio e sonhos no radar',
    text: 'Acompanhe o patrimônio líquido e transforme objetivos em parcelas mensais dentro do orçamento.',
    features: [feature('patrimonio'), feature('projetos')],
    preview: (
      <div className={styles.stack}>
        <ProjectPreview />
        <PatrimonyPreview />
      </div>
    ),
  },
]

/** Variant 3 — storytelling: the product presented as the family's monthly journey. */
export function VarianteJornada() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const illustration = `${import.meta.env.BASE_URL}brand/${theme === 'dark' ? 'ilustracao-escura' : 'ilustracao-login'}.jpg`

  return (
    <PresentationChrome>
      <section className={styles.hero}>
        <img className={styles.heroImage} src={illustration} alt="" />
        <div className={styles.heroOverlay}>
          <p className={styles.kicker}>A jornada de um mês no Conora</p>
          <h1>Registre. Planeje. Entenda. Construa.</h1>
          <p className={styles.lead}>Quatro movimentos simples que levam a família do extrato ao patrimônio.</p>
          <a href="#capitulo-1" className={styles.scrollHint}>
            Ver a jornada <Icon name="chevron" size={16} />
          </a>
        </div>
      </section>

      <ol className={styles.timeline}>
        {CHAPTERS.map((chapter, index) => (
          <li key={chapter.verb} id={`capitulo-${index + 1}`} className={styles.chapter}>
            <span className={styles.marker} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className={styles.chapterCopy}>
              <p className={styles.verb}>{chapter.verb}</p>
              <h2>{chapter.title}</h2>
              <p className={styles.chapterText}>{chapter.text}</p>
              <ul className={styles.chips}>
                {chapter.features.map((item) => (
                  <li key={item.key}>
                    <Icon name={item.icon} size={16} /> {item.title}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.chapterPreview}>{chapter.preview}</div>
          </li>
        ))}
      </ol>

      <section className={styles.together}>
        <Icon name="user" variant="tile" />
        <h2>E a família inteira junto</h2>
        <p>{feature('membros').text}</p>
        <Button onClick={() => navigate('/register')}>Começar a jornada</Button>
      </section>
    </PresentationChrome>
  )
}
