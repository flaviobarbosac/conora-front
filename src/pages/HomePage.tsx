import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardApi, familyApi } from '../api/finance'
import { scanReceipt } from '../camera/scanReceipt'
import { HomeLaunchO } from '../components/HomeLaunchO'
import { PageHeader } from '../components/PageHeader'
import { ErrorText } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { currentCompetence } from '../lib/format'
import { speechRecognitionAvailable } from '../lib/voiceDraft'
import styles from './page.module.css'

function firstName(fullName: string | undefined): string {
  const trimmed = fullName?.trim()
  if (!trimmed) {
    return ''
  }
  return trimmed.split(/\s+/).find(Boolean) ?? trimmed
}

export function HomePage() {
  const navigate = useNavigate()
  const profile = useLoad(() => familyApi.profile(), [])
  const dashboard = useLoad(() => dashboardApi.get(currentCompetence()), [])
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const name = firstName(profile.data?.name)
  const pendingCategories = dashboard.data?.alerts.find((alert) => alert.code === 'CATEGORY_PENDING_REVIEW')

  function openManual() {
    navigate('/lancamentos?novo=1')
  }

  function openScan() {
    void scanReceipt()
      .then(() => navigate('/lancamentos?novo=1&recibo=1'))
      .catch(() => undefined)
  }

  function openVoice() {
    setVoiceError(null)
    if (!speechRecognitionAvailable()) {
      setVoiceError('Este navegador não liberou o microfone para ditado.')
      return
    }
    window.dispatchEvent(new Event('conora:open-voice'))
  }

  return (
    <div className={`${styles.page} ${styles.homePage}`}>
      <PageHeader kicker="Início" title={name ? `Olá, ${name}` : 'Olá'} />

      <ErrorText message={dashboard.error ?? profile.error ?? voiceError} />

      {pendingCategories ? (
        <Link className={styles.homeUrgent} to="/categorias">
          <Icon name="alert" size={20} />
          <span>{pendingCategories.message}</span>
        </Link>
      ) : null}

      <section className={styles.homeLaunch} aria-label="Lançamento">
        <HomeLaunchO listening={false} onScan={openScan} onVoice={openVoice} onManual={openManual} />
      </section>
    </div>
  )
}
