import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { accountsApi, familyApi } from '../api/finance'
import { AccountForm } from '../components/finance/AccountForm'
import { JornadaDiagnosticoWizard } from '../components/JornadaDiagnosticoWizard'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import {
  isJornadaDiagnosticoComplete,
  readJornadaDiagnostico,
} from '../lib/jornadaDiagnostico'
import {
  canCompleteOnboarding,
  digitsOnly,
  resumeOnboardingStep,
  type OnboardingStep,
} from '../lib/onboardingFlow'
import { showSaveToast } from '../lib/saveToast'
import pageStyles from './pageStyles'
import onboardingStyles from './onboarding/onboarding.module.css'

const styles = { ...pageStyles, ...onboardingStyles }

type Step = OnboardingStep

const STEPS: { id: Step; title: string; hint: string }[] = [
  { id: 'profile', title: 'Seus dados', hint: 'Telefone e CEP.' },
  { id: 'account', title: 'Conta bancária', hint: 'Uma conta para receber os lançamentos.' },
  {
    id: 'diagnosis',
    title: 'Diagnóstico',
    hint: 'Você no comando do próximo passo. Quatro respostas simples.',
  },
  { id: 'video', title: 'Vídeo rápido', hint: 'Um vídeo curto para começar.' },
]

function formatPhone(value: string): string {
  const d = digitsOnly(value).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function formatCep(value: string): string {
  const d = digitsOnly(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const replay = searchParams.get('replay') === '1'
  const profile = useLoad(() => familyApi.profile(), [])
  const accounts = useLoad(() => accountsApi.list(true), [])
  const saveProfile = useAction()
  const complete = useAction()

  const [step, setStep] = useState<Step>('profile')
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [savedPhone, setSavedPhone] = useState('')
  const [savedCep, setSavedCep] = useState('')
  const [editAccount, setEditAccount] = useState(false)
  const [hasDiagnostico, setHasDiagnostico] = useState(() =>
    isJornadaDiagnosticoComplete(readJornadaDiagnostico()),
  )

  const activeAccounts = (accounts.data ?? []).filter((a) => !a.isArchived)
  const hasAccount = activeAccounts.length > 0
  const profileName = (profile.data?.name ?? '').trim()

  useEffect(() => {
    if (!profile.data) return
    setPhone(profile.data.phone ? formatPhone(profile.data.phone) : '')
    setSavedPhone(profile.data.phone ? formatPhone(profile.data.phone) : '')
    setCep(profile.data.cep ? formatCep(profile.data.cep) : '')
    setSavedCep(profile.data.cep ? formatCep(profile.data.cep) : '')
  }, [profile.data])

  useEffect(() => {
    if (!profile.data) return
    setStep(
      resumeOnboardingStep({
        phone: profile.data.phone,
        cep: profile.data.cep,
        hasAccount,
        hasDiagnostico,
      }),
    )
  }, [profile.data, hasAccount, hasDiagnostico])

  const dirtyProfile =
    digitsOnly(phone) !== digitsOnly(savedPhone) || digitsOnly(cep) !== digitsOnly(savedCep)
  useRegisterDirty('onboarding-profile', dirtyProfile)

  async function saveContact(event: FormEvent) {
    event.preventDefault()
    if (
      await saveProfile.run(() =>
        familyApi.updateProfile({
          name: profileName,
          phone: digitsOnly(phone),
          cep: digitsOnly(cep),
        }),
      )
    ) {
      setSavedPhone(formatPhone(phone))
      setSavedCep(formatCep(cep))
      showSaveToast('Dados salvos.')
      window.dispatchEvent(new Event('conora:profile-changed'))
      profile.reload()
      setStep(hasAccount ? (hasDiagnostico ? 'video' : 'diagnosis') : 'account')
    }
  }

  async function finish() {
    const gate = canCompleteOnboarding({
      phone: profile.data?.phone ?? phone,
      cep: profile.data?.cep ?? cep,
      hasAccount,
      hasDiagnostico,
    })
    if (!gate.ok) {
      if (gate.missing.includes('diagnostico')) {
        complete.setError('Responda o diagnóstico antes de entrar.')
      } else if (gate.missing.includes('account')) {
        complete.setError('Cadastre uma conta para receber os lançamentos e tente de novo.')
      } else {
        complete.setError('Complete telefone e CEP antes de entrar.')
      }
      setStep(
        resumeOnboardingStep({
          phone: profile.data?.phone ?? phone,
          cep: profile.data?.cep ?? cep,
          hasAccount,
          hasDiagnostico,
        }),
      )
      return
    }
    if (!(await complete.run(() => familyApi.completeOnboarding()))) {
      return
    }
    const prefs = profile.data
    if (prefs) {
      try {
        await familyApi.updatePreferences({
          themeId: prefs.themeId,
          quietMode: prefs.quietMode,
          emailsEnabled: prefs.emailsEnabled ?? true,
          reserveTargetMonths: prefs.reserveTargetMonths,
          monthCloseDay: prefs.monthCloseDay,
          includeAbsoluteValuesInRetrospective: prefs.includeAbsoluteValuesInRetrospective,
          voiceEntryConfirm: prefs.voiceEntryConfirm !== false,
          budgetAlertPercent: prefs.budgetAlertPercent ?? 70,
          photoEvolutionEnabled: prefs.photoEvolutionEnabled !== false,
          homeJourneyTimelineEnabled: true,
        })
      } catch {
        // Onboard already completed; home still defaults to showing the journey.
      }
    }
    window.dispatchEvent(new Event('conora:profile-changed'))
    showSaveToast('Onboard concluído.')
    navigate('/', { replace: true })
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  /** Vídeo rápido is step 4 only — never listed on profile/account/diagnosis. */
  const listSteps = step === 'video' ? STEPS : STEPS.filter((item) => item.id !== 'video')

  if (profile.data?.onboardingCompleted && !replay) {
    return <Navigate to="/" replace />
  }

  return (
    <div className={`${styles.page} ${styles.onboarding}`}>
      <PageHeader
        title="Bem-vindo ao Conora"
        kicker={replay ? 'Teste do onboard' : 'Onboard obrigatório'}
        backTo={replay ? { to: '/', label: '← Início' } : undefined}
      />
      <p className={styles.muted}>
        {replay
          ? 'Modo teste: percorra o fluxo mesmo com o onboard já concluído.'
          : 'Complete seus dados, a conta e o diagnóstico. Depois é só começar.'}
      </p>

      <div className={styles.journeyProgress}>
        <div className={styles.journeyProgressLabel}>
          <span>
            Passo {stepIndex + 1} de {STEPS.length}
          </span>
          <span>{STEPS[stepIndex]?.title}</span>
        </div>
        <div
          className={styles.journeyTrack}
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          <span style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <ol className={styles.journeyList}>
        {listSteps.map((item, index) => {
          const done =
            (item.id === 'profile' && Boolean(profile.data?.phone && profile.data?.cep)) ||
            (item.id === 'account' && hasAccount) ||
            (item.id === 'diagnosis' && hasDiagnostico) ||
            (item.id === 'video' && false)
          const tone =
            item.id === step ? styles.journeyNext : done ? styles.journeyDone : styles.journeyItem
          return (
            <li key={item.id} className={tone}>
              <button type="button" className={styles.journeyOpen} onClick={() => setStep(item.id)}>
                <span className={styles.journeyIndex} aria-hidden>
                  {done ? '✓' : index + 1}
                </span>
                <span className={styles.journeyBody}>
                  <strong>{item.title}</strong>
                  <span className={styles.muted}>{item.hint}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <ErrorText message={profile.error ?? accounts.error ?? saveProfile.error ?? complete.error} />
      {profile.loading && !profile.data ? <Loading /> : null}

      {step === 'profile' && profile.data ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Seus dados</h2>
          <form className={styles.form} onSubmit={(event) => void saveContact(event)}>
            <div className={styles.formWide}>
              <Field label="Nome" name="name" value={profileName} readOnly disabled />
            </div>
            <Field label="E-mail" name="email" value={profile.data.email} readOnly disabled />
            <Field
              label="Telefone"
              name="phone"
              required
              inputMode="numeric"
              autoComplete="tel-national"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              hint="Com DDD."
            />
            <Field
              label="CEP"
              name="cep"
              required
              inputMode="numeric"
              autoComplete="postal-code"
              value={cep}
              onChange={(event) => setCep(formatCep(event.target.value))}
            />
            <div className={styles.formActions}>
              <Button
                type="submit"
                disabled={
                  saveProfile.busy ||
                  !profileName ||
                  digitsOnly(phone).length < 10 ||
                  digitsOnly(cep).length !== 8
                }
              >
                Salvar e continuar
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 'account' ? (
        <>
          {hasAccount && !editAccount ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Conta cadastrada</h2>
              <ul className={styles.list}>
                {activeAccounts.map((account) => (
                  <li key={account.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>{account.name}</strong>
                    </span>
                    <Button
                      variant="ghost"
                      aria-label={`Editar ${account.name}`}
                      title="Editar conta"
                      onClick={() => setEditAccount(true)}
                    >
                      <Icon name="pen" size={20} decorative />
                    </Button>
                  </li>
                ))}
              </ul>
              <p className={styles.muted}>Use o lápis para ajustar a conta antes de continuar.</p>
              <div className={styles.formActions}>
                <Button onClick={() => setStep(hasDiagnostico ? 'video' : 'diagnosis')}>Continuar</Button>
              </div>
            </section>
          ) : (
            <AccountForm
              title={editAccount ? 'Editar conta bancária' : 'Conta bancária'}
              submitLabel={editAccount ? 'Salvar conta' : 'Salvar conta e continuar'}
              initial={editAccount ? activeAccounts[0] : undefined}
              onSaved={() => {
                accounts.reload()
                setEditAccount(false)
                if (!editAccount) setStep('diagnosis')
              }}
              onCancel={editAccount ? () => setEditAccount(false) : undefined}
            />
          )}
        </>
      ) : null}

      {step === 'diagnosis' ? (
        <JornadaDiagnosticoWizard
          initial={readJornadaDiagnostico()}
          kicker="Diagnóstico"
          title="Você no comando do próximo passo"
          hint="Quatro respostas simples. Com isso a Jornada Raio-X se organiza na ordem certa pra você. Clareza agora, maturidade financeira no caminho."
          submitLabel="Salvar e continuar"
          onBack={() => setStep('account')}
          onComplete={() => {
            setHasDiagnostico(true)
            setStep('video')
          }}
        />
      ) : null}

      {step === 'video' ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Vídeo rápido</h2>
          <div className={styles.closeRitual}>
            <iframe
              className={styles.welcomeVideo}
              src="https://www.youtube.com/embed/ljs3zGINCAs"
              title="Vídeo de boas-vindas"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <ul className={styles.onboardVideoPoints} aria-label="O que você vai ver no app">
            <li>No Início, o círculo tem três jeitos: foto, voz e WhatsApp (e o lápis para lançar na mão).</li>
            <li>Dá para inativar categoria que não usa.</li>
            <li>O Ian acompanha como narrador adulto da jornada.</li>
          </ul>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setStep('diagnosis')}>
              Voltar
            </Button>
            <Button disabled={complete.busy || !hasAccount || !hasDiagnostico} onClick={() => void finish()}>
              Concluir e entrar
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
