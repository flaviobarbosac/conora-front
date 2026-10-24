import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountsApi, cardsApi, familyApi } from '../api/finance'
import { AccountForm } from '../components/finance/AccountForm'
import { CardForm } from '../components/finance/CardForm'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import {
  canCompleteOnboarding,
  digitsOnly,
  resumeOnboardingStep,
  type OnboardingStep,
} from '../lib/onboardingFlow'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

type Step = OnboardingStep

const STEPS: { id: Step; title: string; hint: string }[] = [
  { id: 'profile', title: 'Seus dados', hint: 'Nome, telefone, e-mail e CEP.' },
  { id: 'account', title: 'Conta bancária', hint: 'A mesma conta da tela Contas.' },
  { id: 'card', title: 'Cartão de crédito', hint: 'O mesmo cadastro da tela Cartões.' },
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
  const profile = useLoad(() => familyApi.profile(), [])
  const accounts = useLoad(() => accountsApi.list(true), [])
  const cards = useLoad(() => cardsApi.list(), [])
  const saveProfile = useAction()
  const complete = useAction()

  const [step, setStep] = useState<Step>('profile')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [savedName, setSavedName] = useState('')
  const [savedPhone, setSavedPhone] = useState('')
  const [savedCep, setSavedCep] = useState('')

  const activeAccounts = (accounts.data ?? []).filter((a) => !a.isArchived)
  const hasAccount = activeAccounts.length > 0
  const hasCard = (cards.data ?? []).length > 0

  useEffect(() => {
    if (!profile.data) return
    setName(profile.data.name ?? '')
    setSavedName(profile.data.name ?? '')
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
        hasCard,
      }),
    )
  }, [profile.data, hasAccount, hasCard])

  const dirtyProfile =
    name.trim() !== savedName.trim() ||
    digitsOnly(phone) !== digitsOnly(savedPhone) ||
    digitsOnly(cep) !== digitsOnly(savedCep)
  useRegisterDirty('onboarding-profile', dirtyProfile)

  async function saveContact(event: FormEvent) {
    event.preventDefault()
    if (
      await saveProfile.run(() =>
        familyApi.updateProfile({
          name: name.trim(),
          phone: digitsOnly(phone),
          cep: digitsOnly(cep),
        }),
      )
    ) {
      setSavedName(name.trim())
      setSavedPhone(formatPhone(phone))
      setSavedCep(formatCep(cep))
      showSaveToast('Dados salvos.')
      window.dispatchEvent(new Event('conora:profile-changed'))
      profile.reload()
      setStep(hasAccount ? (hasCard ? 'video' : 'card') : 'account')
    }
  }

  async function finish() {
    const gate = canCompleteOnboarding({
      phone: profile.data?.phone ?? phone,
      cep: profile.data?.cep ?? cep,
      hasAccount,
      hasCard,
    })
    if (!gate.ok) {
      complete.setError(
        gate.missing.includes('account') || gate.missing.includes('card')
          ? 'Corrija a conta ou o cartão e tente de novo. Você não fica preso fora do app.'
          : 'Complete telefone e CEP antes de entrar.',
      )
      setStep(resumeOnboardingStep({ phone: profile.data?.phone ?? phone, cep: profile.data?.cep ?? cep, hasAccount, hasCard }))
      return
    }
    if (!(await complete.run(() => familyApi.completeOnboarding()))) {
      return
    }
    window.dispatchEvent(new Event('conora:profile-changed'))
    showSaveToast('Onboard concluído.')
    navigate('/', { replace: true })
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className={`${styles.page} ${styles.onboarding}`}>
      <PageHeader title="Bem-vindo ao Conora" kicker="Onboard obrigatório" />
      <p className={styles.muted}>
        Preencha uma vez. Os mesmos dados aparecem no perfil, em Contas e em Cartões. Se fechar no meio, volta daqui.
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
        {STEPS.map((item, index) => {
          const done =
            (item.id === 'profile' && Boolean(profile.data?.phone && profile.data?.cep)) ||
            (item.id === 'account' && hasAccount) ||
            (item.id === 'card' && hasCard) ||
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

      <ErrorText message={profile.error ?? accounts.error ?? cards.error ?? saveProfile.error ?? complete.error} />
      {profile.loading && !profile.data ? <Loading /> : null}

      {step === 'profile' && profile.data ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Seus dados</h2>
          <form className={styles.form} onSubmit={(event) => void saveContact(event)}>
            <div className={styles.formWide}>
              <Field
                label="Nome"
                name="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <Field label="E-mail" name="email" value={profile.data.email} readOnly disabled />
            <Field
              label="Telefone"
              name="phone"
              required
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              hint="Com DDD."
            />
            <Field
              label="CEP"
              name="cep"
              required
              value={cep}
              onChange={(event) => setCep(formatCep(event.target.value))}
            />
            <div className={styles.formActions}>
              <Button type="submit" disabled={saveProfile.busy || !name.trim() || digitsOnly(phone).length < 10 || digitsOnly(cep).length !== 8}>
                Salvar e continuar
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 'account' ? (
        <>
          {hasAccount ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Conta cadastrada</h2>
              <ul className={styles.list}>
                {activeAccounts.map((account) => (
                  <li key={account.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>{account.name}</strong>
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.formActions}>
                <Button onClick={() => setStep('card')}>Continuar</Button>
              </div>
            </section>
          ) : (
            <AccountForm
              title="Conta bancária"
              submitLabel="Salvar conta e continuar"
              onSaved={() => {
                accounts.reload()
                setStep('card')
              }}
            />
          )}
        </>
      ) : null}

      {step === 'card' ? (
        <>
          {!hasAccount ? (
            <Empty>Cadastre a conta bancária antes do cartão.</Empty>
          ) : hasCard ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Cartão cadastrado</h2>
              <ul className={styles.list}>
                {(cards.data ?? []).map((card) => (
                  <li key={card.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>{card.name}</strong>
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.formActions}>
                <Button onClick={() => setStep('video')}>Continuar</Button>
              </div>
            </section>
          ) : (
            <CardForm
              accounts={activeAccounts}
              title="Cartão de crédito"
              submitLabel="Salvar cartão e continuar"
              onSaved={() => {
                cards.reload()
                setStep('video')
              }}
            />
          )}
        </>
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
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setStep('card')}>
              Voltar
            </Button>
            <Button disabled={complete.busy || !hasAccount || !hasCard} onClick={() => void finish()}>
              Concluir e entrar
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
