import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardApi, familyApi } from '../api/finance'
import { scanReceipt } from '../camera/scanReceipt'
import { HomeLaunchO } from '../components/HomeLaunchO'
import { JornadaTimeline } from '../components/JornadaTimeline'
import { PaidModuleBadge } from '../components/PaidModuleBadge'
import { PageHeader } from '../components/PageHeader'
import { ScanPurposeSheet, type ScanPurposeChoice } from '../components/ScanPurposeSheet'
import { Button } from '../components/ui/Button'
import { ErrorText } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { currentCompetence } from '../lib/format'
import { hasFullAccess, isFreeLimited } from '../lib/freeTier'
import {
  PREFERENCES_CHANGED,
  PREF_KEYS,
  readHomeJourneyTimeline,
  writeHomeJourneyTimeline,
} from '../lib/preferences'
import { isVoiceMicActive } from '../lib/voiceLaunch'
import pageStyles from './pageStyles'
import homeStyles from './home/home.module.css'
const styles = { ...pageStyles, ...homeStyles }

function firstName(fullName: string | undefined): string {
  const trimmed = fullName?.trim()
  if (!trimmed) {
    return ''
  }
  return trimmed.split(/\s+/).find(Boolean) ?? trimmed
}

export function HomePage() {
  const navigate = useNavigate()
  const { plan } = usePlanAccess()
  const profile = useLoad(() => familyApi.profile(), [])
  const dashboard = useLoad(() => dashboardApi.get(currentCompetence()), [])
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [showJourney, setShowJourney] = useState(readHomeJourneyTimeline)
  const [scanSheetOpen, setScanSheetOpen] = useState(false)
  const name = firstName(profile.data?.name)
  const pendingCategories = dashboard.data?.alerts.find((alert) => alert.code === 'CATEGORY_PENDING_REVIEW')
  const showPaidModulesTag = isFreeLimited(plan) && !hasFullAccess(plan)

  useEffect(() => {
    function onPrefs(event: Event) {
      const detail = (event as CustomEvent<{ key?: string }>).detail
      if (!detail?.key || detail.key === PREF_KEYS.homeJourneyTimeline) {
        setShowJourney(readHomeJourneyTimeline())
      }
    }
    window.addEventListener(PREFERENCES_CHANGED, onPrefs)
    return () => window.removeEventListener(PREFERENCES_CHANGED, onPrefs)
  }, [])

  function openManual() {
    navigate('/lancamentos?novo=1')
  }

  function openScan() {
    setScanSheetOpen(true)
  }

  function onScanPurpose(choice: ScanPurposeChoice) {
    if (choice === 'contracheque') {
      void scanReceipt({ header: 'Contracheque / renda' })
        .then(() => navigate('/diagnostico?foto=1'))
        .catch(() => undefined)
      return
    }
    if (choice === 'boleto') {
      void scanReceipt({ header: 'Boleto' })
        .then(() => navigate('/orcamento?recibo=1'))
        .catch(() => undefined)
      return
    }
    void scanReceipt()
      .then(() => navigate('/lancamentos?novo=1&recibo=1'))
      .catch(() => undefined)
  }

  function openVoice() {
    setVoiceError(null)
    if (!isVoiceMicActive(profile.data?.voiceEntryConfirm)) {
      return
    }
    window.dispatchEvent(new Event('conora:open-voice'))
  }

  function closeJourney() {
    writeHomeJourneyTimeline(false)
    setShowJourney(false)
  }

  const pageClass = [styles.page, styles.homePage, !showJourney ? styles.homePageSolo : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={pageClass}>
      <PageHeader
        kicker="Início"
        title={name ? `Olá, ${name}` : 'Olá'}
        actions={showPaidModulesTag ? <PaidModuleBadge /> : undefined}
      />

      <ErrorText message={dashboard.error ?? profile.error ?? voiceError} />
      {showPaidModulesTag ? (
        <p className={styles.muted}>
          Patrimônio, membros, projeto de vida e marcos abrem para consulta. Cadastro e edição ficam nos planos
          pagos.
        </p>
      ) : null}

      {pendingCategories ? (
        <Link className={styles.homeUrgent} to="/categorias">
          <Icon name="alert" size={20} />
          <span>{pendingCategories.message}</span>
        </Link>
      ) : null}

      <section className={styles.homeLaunch} aria-label="Lançamento">
        <HomeLaunchO
          listening={false}
          voiceEnabled={isVoiceMicActive(profile.data?.voiceEntryConfirm)}
          onScan={openScan}
          onVoice={openVoice}
          onManual={openManual}
        />
        <p className={styles.muted}>
          Câmera: cupom, boleto ou contracheque. Lápis: lançamento manual.
        </p>
      </section>
      <ScanPurposeSheet
        open={scanSheetOpen}
        includeCupom
        onClose={() => setScanSheetOpen(false)}
        onChoose={onScanPurpose}
      />

      {showJourney ? (
        <section className={styles.homeJourney} aria-label="Jornada Raio X">
          <p className={styles.homeJourneyKicker}>Jornada Raio X</p>
          <JornadaTimeline />
          <div className={styles.homeJourneyFooter}>
            <Button type="button" variant="secondary" onClick={closeJourney}>
              Fechar
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
