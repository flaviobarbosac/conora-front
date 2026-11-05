import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardApi, familyApi } from '../api/finance'
import { scanReceipt } from '../camera/scanReceipt'
import { HomeLaunchO } from '../components/HomeLaunchO'
import { JornadaTimeline } from '../components/JornadaTimeline'
import { PageHeader } from '../components/PageHeader'
import { ScanPurposeSheet, type ScanPurposeChoice } from '../components/ScanPurposeSheet'
import { ErrorText } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { currentCompetence, formatDate } from '../lib/format'
import { hasJornadaAnswer, readJornadaDiagnostico, type JornadaDiagnosticoAnswers } from '../lib/jornadaDiagnostico'
import { isVoiceMicActive } from '../lib/voiceLaunch'
import pageStyles from './pageStyles'
import homeStyles from './home/home.module.css'
const styles = { ...pageStyles, ...homeStyles }

function journeyFromProfile(
  stored: { rendaFixa: boolean | null; divida: boolean | null; patrimonio: boolean | null; projetoVida: boolean | null } | null | undefined,
): JornadaDiagnosticoAnswers | null {
  if (!stored) return readJornadaDiagnostico()
  const answers: JornadaDiagnosticoAnswers = {
    ...(typeof stored.rendaFixa === 'boolean' ? { rendaFixa: stored.rendaFixa } : {}),
    ...(typeof stored.divida === 'boolean' ? { divida: stored.divida } : {}),
    ...(typeof stored.patrimonio === 'boolean' ? { patrimonio: stored.patrimonio } : {}),
    ...(typeof stored.projetoVida === 'boolean' ? { projetoVida: stored.projetoVida } : {}),
  }
  return hasJornadaAnswer(answers) ? answers : readJornadaDiagnostico()
}

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
  const [scanSheetOpen, setScanSheetOpen] = useState(false)
  const name = firstName(profile.data?.name)
  const journeyDisplay =
    profile.data?.homeJourneyDisplay ??
    (profile.data?.homeJourneyTimelineEnabled === false ? 'closed' : 'shown')
  const showJourney = journeyDisplay === 'shown'
  const pendingCategories = dashboard.data?.alerts.find((alert) => alert.code === 'CATEGORY_PENDING_REVIEW')
  const studentTrial =
    plan?.isTrainingStudent === true && plan.phase === 'Trial' && Boolean(plan.trialEndsAt)

  useEffect(() => {
    function onProfileChanged() {
      profile.reload()
    }
    window.addEventListener('conora:profile-changed', onProfileChanged)
    return () => window.removeEventListener('conora:profile-changed', onProfileChanged)
  }, [profile])

  function openManual() {
    navigate('/lancamentos')
  }

  function openScan() {
    setScanSheetOpen(true)
  }

  function onScanPurpose(choice: ScanPurposeChoice) {
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

  const journeyAnswers = journeyFromProfile(profile.data?.jornadaDiagnostico)

  async function setJourneyDisplay(display: 'shown' | 'hidden' | 'closed') {
    setVoiceError(null)
    try {
      await familyApi.updateJornada({ display })
      profile.reload()
    } catch {
      setVoiceError('Não foi possível atualizar a jornada.')
    }
  }

  function openVoice() {
    setVoiceError(null)
    if (!isVoiceMicActive(profile.data?.voiceEntryConfirm)) {
      return
    }
    window.dispatchEvent(new Event('conora:open-voice'))
  }

  const pageClass = [styles.page, styles.homePage, !showJourney ? styles.homePageSolo : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={pageClass}>
      <PageHeader
        kicker="Início"
        title={name ? `Olá, ${name}` : 'Olá'}
      />

      <ErrorText message={dashboard.error ?? profile.error ?? voiceError} />
      {studentTrial ? (
        <p className={styles.muted}>Período de teste válido até {formatDate(plan?.trialEndsAt)}.</p>
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
      </section>
      <ScanPurposeSheet
        open={scanSheetOpen}
        includeCupom
        onClose={() => setScanSheetOpen(false)}
        onChoose={onScanPurpose}
      />

      {showJourney ? (
        <section className={styles.homeJourney} aria-label="Jornada Raio X">
          <div className={styles.homeJourneyHead}>
            <p className={styles.homeJourneyKicker}>Jornada Raio X</p>
            <div className={styles.homeJourneyActions}>
              <button type="button" className={styles.homeJourneyAction} onClick={() => void setJourneyDisplay('hidden')}>
                Esconder
              </button>
              <button type="button" className={styles.homeJourneyAction} onClick={() => void setJourneyDisplay('closed')}>
                Fechar
              </button>
            </div>
          </div>
          <JornadaTimeline diagnostico={journeyAnswers} />
        </section>
      ) : null}
      {journeyDisplay === 'hidden' ? (
        <button type="button" className={styles.homeJourneyReveal} onClick={() => void setJourneyDisplay('shown')}>
          <Icon name="chevron" size={20} />
          Mostrar jornada
        </button>
      ) : null}
    </div>
  )
}
