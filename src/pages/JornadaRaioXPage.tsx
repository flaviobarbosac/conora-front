import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { JornadaTimeline } from '../components/JornadaTimeline'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import {
  PREFERENCES_CHANGED,
  PREF_KEYS,
  readHomeJourneyTimeline,
  writeHomeJourneyTimeline,
} from '../lib/preferences'
import page from './page.module.css'
import styles from './JornadaRaioXPage.module.css'

export function JornadaRaioXPage() {
  const navigate = useNavigate()
  const [showOnHome, setShowOnHome] = useState(readHomeJourneyTimeline)

  useEffect(() => {
    function onPrefs(event: Event) {
      const detail = (event as CustomEvent<{ key?: string }>).detail
      if (!detail?.key || detail.key === PREF_KEYS.homeJourneyTimeline) {
        setShowOnHome(readHomeJourneyTimeline())
      }
    }
    window.addEventListener(PREFERENCES_CHANGED, onPrefs)
    return () => window.removeEventListener(PREFERENCES_CHANGED, onPrefs)
  }, [])

  return (
    <div className={`${page.page} ${styles.wrap}`}>
      <PageHeader kicker="Raio-X" title="Jornada Raio X" />

      <section className={styles.headerCard} aria-label="Exibição na tela inicial">
        <Select
          label="Exibir na tela inicial"
          name="homeJourneyTimeline"
          value={showOnHome ? 'on' : 'off'}
          onChange={(event) => {
            const next = event.target.value === 'on'
            writeHomeJourneyTimeline(next)
            setShowOnHome(next)
          }}
        >
          <option value="on">Sim — mostra a linha do tempo abaixo do lançamento</option>
          <option value="off">Não — oculta na tela inicial</option>
        </Select>
      </section>

      <JornadaTimeline />

      <div className={styles.footer}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Continuar no aplicativo
        </Button>
        <p className={styles.footerHint}>
          Lançamentos liberados · feche na inicial ou desmarque acima para ocultar
        </p>
      </div>
    </div>
  )
}
