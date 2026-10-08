import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { PresentationChrome } from './Chrome'
import { feature, type Feature } from './content'
import { AiPreview, BudgetPreview, ChatPreview, PatrimonyPreview, ProjectPreview, RaioXPreview } from './Previews'
import styles from './varianteBento.module.css'

type Tile = {
  feature: Feature
  size: 'wide' | 'tall' | 'regular' | 'small'
  preview?: ReactNode
}

const TILES: ReadonlyArray<Tile> = [
  { feature: feature('orcamento'), size: 'wide', preview: <BudgetPreview /> },
  { feature: feature('raio-x'), size: 'tall', preview: <RaioXPreview /> },
  { feature: feature('projetos'), size: 'regular', preview: <ProjectPreview /> },
  { feature: feature('patrimonio'), size: 'regular', preview: <PatrimonyPreview /> },
  { feature: feature('whatsapp'), size: 'regular', preview: <ChatPreview /> },
  { feature: feature('ia'), size: 'regular', preview: <AiPreview /> },
  { feature: feature('lancamentos'), size: 'small' },
  { feature: feature('importar'), size: 'small' },
  { feature: feature('membros'), size: 'small' },
  { feature: feature('mes'), size: 'small' },
]

/** Variant 2 — bento grid where every tile shows a live-looking slice of the product. */
export function VarianteBento() {
  const navigate = useNavigate()

  return (
    <PresentationChrome>
      <section className={styles.hero}>
        <span className={styles.badge}>
          <Icon name="home" size={16} /> Conora para famílias
        </span>
        <h1>
          Clareza para <em>cada real</em> da família.
        </h1>
        <p>Conheça os módulos que transformam extratos soltos numa visão completa — do lançamento ao patrimônio.</p>
        <div className={styles.actions}>
          <Button onClick={() => navigate('/register')}>Criar conta</Button>
          <Button variant="secondary" onClick={() => navigate('/login')}>
            Entrar
          </Button>
        </div>
      </section>

      <section className={styles.bento} aria-label="Funcionalidades">
        {TILES.map(({ feature: item, size, preview }) => (
          <article key={item.key} className={`${styles.tile} ${styles[size]}`}>
            <div className={styles.tileCopy}>
              <span className={styles.tileIcon}>
                <Icon name={item.icon} variant="duo" size={20} />
              </span>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </div>
            {preview ? <div className={styles.tilePreview}>{preview}</div> : null}
          </article>
        ))}
      </section>
    </PresentationChrome>
  )
}
