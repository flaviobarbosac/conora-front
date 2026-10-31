import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  familyApi,
  lgpdApi,
  planApi,
  type DeleteAccountInput,
  type UserPreferencesInput,
} from '../api/finance'
import { appleSignInAvailable, requestAppleRevocationGrant } from '../auth/apple'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { CheckboxField } from '../components/ui/CheckboxField'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { planSummary } from '../lib/planAccess'
import { showSaveToast } from '../lib/saveToast'
import { VOICE_LAUNCH_ENABLED } from '../lib/voiceLaunch'
import { useTheme } from '../theme/ThemeProvider'
import pageStyles from './pageStyles'
import settingsStyles from './settings/settings.module.css'

const styles = { ...pageStyles, ...settingsStyles }

type PrefDraft = Omit<UserPreferencesInput, 'themeId'>

function fromProfile(
  quietMode: boolean,
  emailsEnabled: boolean,
  reserveTargetMonths: number,
  monthCloseDay: number,
  includeAbsoluteValuesInRetrospective: boolean,
  voiceEntryConfirm: boolean,
  budgetAlertPercent: number,
  photoEvolutionEnabled: boolean,
  homeJourneyTimelineEnabled: boolean,
): PrefDraft {
  return {
    quietMode,
    emailsEnabled,
    reserveTargetMonths,
    monthCloseDay,
    includeAbsoluteValuesInRetrospective,
    voiceEntryConfirm,
    budgetAlertPercent,
    photoEvolutionEnabled,
    homeJourneyTimelineEnabled,
  }
}

export function SettingsPage() {
  const { theme } = useTheme()
  const { logout } = useAuth()
  const profile = useLoad(() => familyApi.profile(), [])
  const plan = useLoad(() => planApi.get(), [])
  const lgpdStatus = useLoad(() => lgpdApi.status(), [])
  const savePrefs = useAction()
  const privacy = useAction()
  const [draft, setDraft] = useState<PrefDraft | null>(null)
  const [saved, setSaved] = useState<PrefDraft | null>(null)
  const canDeleteAccount = Boolean(lgpdStatus.data?.canDeleteAccount)

  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved))
  useRegisterDirty('settings-form', dirty)

  useEffect(() => {
    if (!profile.data) return
    const next = fromProfile(
      profile.data.quietMode,
      profile.data.emailsEnabled ?? true,
      profile.data.reserveTargetMonths,
      profile.data.monthCloseDay,
      profile.data.includeAbsoluteValuesInRetrospective,
      profile.data.voiceEntryConfirm !== false,
      profile.data.budgetAlertPercent ?? 70,
      profile.data.photoEvolutionEnabled !== false,
      profile.data.homeJourneyTimelineEnabled !== false,
    )
    setDraft(next)
    setSaved(next)
  }, [profile.data])

  function patch(partial: Partial<PrefDraft>) {
    setDraft((current) => (current ? { ...current, ...partial } : current))
  }

  function onCancel() {
    if (saved) {
      setDraft(saved)
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    const ok = await savePrefs.run(() =>
      familyApi.updatePreferences({
        themeId: theme,
        quietMode: draft.quietMode,
        emailsEnabled: draft.emailsEnabled,
        reserveTargetMonths: draft.reserveTargetMonths,
        monthCloseDay: draft.monthCloseDay,
        includeAbsoluteValuesInRetrospective: draft.includeAbsoluteValuesInRetrospective,
        voiceEntryConfirm: draft.voiceEntryConfirm,
        budgetAlertPercent: draft.budgetAlertPercent,
        photoEvolutionEnabled: draft.photoEvolutionEnabled,
        homeJourneyTimelineEnabled: draft.homeJourneyTimelineEnabled,
      }),
    )
    if (!ok) return
    setSaved(draft)
    showSaveToast('Configurações salvas.')
    profile.reload()
    window.dispatchEvent(new Event('conora:profile-changed'))
  }

  async function exportData() {
    const ok = await privacy.run(() => lgpdApi.exportData())
    if (ok) {
      showSaveToast(
        'A exportação será agendada e estará disponível pra você daqui a 24 horas.',
        5000,
      )
      lgpdStatus.reload()
    }
  }

  async function deleteAccount() {
    if (!canDeleteAccount) {
      showSaveToast(
        lgpdStatus.data?.message
          ?? 'Aguarde a exportação dos seus dados ficar disponível antes de excluir a conta.',
        5000,
      )
      return
    }
    const confirmed = await confirmDestructive(
      'Excluir sua conta remove o acesso ao app. Registros com obrigação fiscal podem ser retidos por até 5 anos. Continuar?',
      { title: 'Excluir conta' },
    )
    if (!confirmed) return
    const body = await appleRevocationBody()
    if (await privacy.run(() => lgpdApi.deleteAccount(body))) {
      await logout()
    }
  }

  // Accounts linked to Apple confirm with Apple once more so the backend can revoke the grant.
  async function appleRevocationBody(): Promise<DeleteAccountInput | undefined> {
    if (!profile.data?.hasAppleLogin || !appleSignInAvailable()) return undefined
    try {
      return await requestAppleRevocationGrant()
    } catch {
      return undefined
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Configurações" />
      <ErrorText message={profile.error ?? plan.error ?? savePrefs.error ?? privacy.error} />
      {profile.loading && !profile.data ? <Loading /> : null}

      {draft ? (
        <form className={`${styles.form} ${styles.settingsForm}`} onSubmit={(event) => void onSave(event)}>
          <section className={styles.section} id="ritmo">
            <h2 className={styles.sectionTitle}>Ritmo</h2>
            <CheckboxField
              label="Modo discreto"
              name="quietMode"
              checked={draft.quietMode}
              onChange={(event) => patch({ quietMode: event.target.checked })}
              description="Desligado: mostra jornadas e celebrações. Ligado: mostra só números."
            />
            <CheckboxField
              label="E-mails do Conora"
              name="emailsEnabled"
              checked={draft.emailsEnabled}
              onChange={(event) => patch({ emailsEnabled: event.target.checked })}
              description="Receber avisos e convites do sistema."
            />
            <Field
              label="Meta da reserva (meses)"
              name="reserveTargetMonths"
              type="number"
              inputMode="numeric"
              min={1}
              max={24}
              step={1}
              value={String(draft.reserveTargetMonths)}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '')
                patch({ reserveTargetMonths: digits ? Number(digits) : 0 })
              }}
              onBlur={() => {
                const value = Math.min(24, Math.max(1, draft.reserveTargetMonths || 6))
                patch({ reserveTargetMonths: value })
              }}
              hint="Padrão: 6 meses de despesas essenciais"
            />
            <Field
              label="Dia de fechamento do mês"
              name="monthCloseDay"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              step={1}
              value={String(draft.monthCloseDay)}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '')
                patch({ monthCloseDay: digits ? Number(digits) : 0 })
              }}
              onBlur={() => {
                const value = Math.min(31, Math.max(1, draft.monthCloseDay || 1))
                patch({ monthCloseDay: value })
              }}
              hint="Dia da competência (1 a 31). Separado do dia de fechamento do cartão."
            />
            <Field
              label="Alerta de atenção do orçamento (%)"
              name="budgetAlertPercent"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              step={1}
              value={String(draft.budgetAlertPercent ?? 70)}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '')
                patch({ budgetAlertPercent: digits ? Number(digits) : 0 })
              }}
              onBlur={() => {
                const value = Math.min(99, Math.max(1, draft.budgetAlertPercent || 70))
                patch({ budgetAlertPercent: value })
              }}
              hint="Amarelo desse percentual até 99%. Em 100% o aviso é Limite atingido. Acima de 100% fica vermelho."
            />
            <CheckboxField
              label="Evolução das fotos do Ian e da Clara"
              name="photoEvolutionEnabled"
              checked={draft.photoEvolutionEnabled !== false}
              onChange={(event) => patch({ photoEvolutionEnabled: event.target.checked })}
              description="Ligado: foto e voz seguem os marcos. Desligado: ficam nos 30 anos."
            />
            <CheckboxField
              label="Mostrar a Jornada Raio X na tela inicial"
              name="homeJourneyTimelineEnabled"
              checked={draft.homeJourneyTimelineEnabled !== false}
              onChange={(event) => patch({ homeJourneyTimelineEnabled: event.target.checked })}
              description="Ligado: a linha do tempo do Ian ou da Clara aparece abaixo do lançamento na inicial. Desligado: a jornada some da inicial; você escolhe Ian ou Clara ali do mesmo jeito."
            />
          </section>

          <section className={styles.section} id="retrospectiva">
            <h2 className={styles.sectionTitle}>Retrospectiva</h2>
            <CheckboxField
              label="Incluir valores absolutos"
              name="includeValues"
              checked={draft.includeAbsoluteValuesInRetrospective}
              onChange={(event) => patch({ includeAbsoluteValuesInRetrospective: event.target.checked })}
              description="Ligado: mostra valores. Desligado: só percentuais e marcos."
            />
          </section>

          {VOICE_LAUNCH_ENABLED ? (
            <section className={styles.section} id="voz">
              <h2 className={styles.sectionTitle}>Voz</h2>
              <CheckboxField
                label="Confirmar lançamento por voz"
                name="voiceEntryConfirm"
                checked={draft.voiceEntryConfirm}
                onChange={(event) => patch({ voiceEntryConfirm: event.target.checked })}
                description="Ligado: microfone no início e o Ian confirma o lançamento antes de gravar. Desligado: sem microfone no painel."
              />
            </section>
          ) : null}

          <div className={styles.formActions}>
            <Button type="button" variant="secondary" disabled={!dirty || savePrefs.busy} onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!dirty || savePrefs.busy}>
              Salvar
            </Button>
          </div>
        </form>
      ) : null}

      <section className={styles.section} id="conta">
        <h2 className={styles.sectionTitle}>Conta</h2>
        <div className={styles.accountLinks}>
          <Link to="/plano" className={styles.accountLink}>
            <strong>Plano</strong>
            <span>{planSummary(plan.data)}</span>
          </Link>
          <Link to="/perfil" className={styles.accountLink}>
            <strong>Perfil</strong>
            <span>{profile.data?.name?.trim() || 'Sem nome'}</span>
            {profile.data?.email ? <span>{profile.data.email}</span> : null}
          </Link>
        </div>
        <p className={styles.muted}>
          Processos satélites da LGPD: baixe uma cópia dos seus dados ou exclua sua conta definitivamente. O
          aceite ciente da LGPD é pedido só no pagamento de um plano pago — não no acesso gratuito.
          Exportar e excluir são ações separadas; a exclusão só libera depois que a exportação estiver pronta.
        </p>
        {lgpdStatus.data && !lgpdStatus.data.canDeleteAccount ? (
          <p className={styles.muted}>{lgpdStatus.data.message}</p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" disabled={privacy.busy} onClick={() => void exportData()}>
            Exportar meus dados
          </Button>
          <Button
            variant="danger"
            disabled={privacy.busy || !canDeleteAccount}
            onClick={() => void deleteAccount()}
          >
            Excluir minha conta
          </Button>
        </div>
      </section>
    </div>
  )
}
