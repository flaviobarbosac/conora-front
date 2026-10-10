import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { PresentationChrome } from './Chrome'
import { FEATURES, STEPS } from './content'
import { PhonePreview } from './Previews'
import styles from './varianteVitrine.module.css'

/** Variant 1 — classic hero with a phone mock, feature grid and "how it works". */
export function VarianteVitrine() {
  const navigate = useNavigate()

  return (
    <PresentationChrome>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Finanças da família</p>
          <h1>
            Todo o dinheiro da casa, <span>num só lugar</span>.
          </h1>
          <p className={styles.lead}>
            Orçamento, lançamentos, patrimônio e projetos de vida — organizados em categorias que a família
            inteira entende e acompanha mês a mês.
          </p>
          <div className={styles.actions}>
            <Button onClick={() => navigate('/register')}>Começar agora</Button>
            <Button variant="secondary" onClick={() => navigate('/login')}>
              Já tenho conta
            </Button>
          </div>
          <ul className={styles.facts}>
            <li>
              <strong>10</strong> módulos integrados
            </li>
            <li>
              <strong>Web</strong>, Android e iOS
            </li>
            <li>
              <strong>Família</strong> no mesmo orçamento
            </li>
          </ul>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.glow} aria-hidden="true" />
          <PhonePreview />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="v1-features">
        <header className={styles.sectionHead}>
          <p className={styles.kicker}>O que você encontra</p>
          <h2 id="v1-features">Cada parte da vida financeira, com o seu lugar</h2>
        </header>
        <ul className={styles.grid}>
          {FEATURES.map((item) => (
            <li key={item.key} className={styles.card}>
              <Icon name={item.icon} variant="tile" />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="v1-steps">
        <header className={styles.sectionHead}>
          <p className={styles.kicker}>Como funciona</p>
          <h2 id="v1-steps">Três passos para sair do achismo</h2>
        </header>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.closing}>
        <h2>Pronto para enxergar o mês com clareza?</h2>
        <Button onClick={() => navigate('/register')}>Criar conta da família</Button>
      </section>
    </PresentationChrome>
  )
}
