import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  familyApi,
  lgpdApi,
  monthsApi,
  planApi,
  type DeleteAccountInput,
  type UserPreferencesInput,
} from '../api/finance'
import { appleSignInAvailable, requestAppleRevocationGrant } from '../auth/apple'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { CheckboxField } from '../components/ui/CheckboxField'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { confirmDestructive } from '../lib/confirm'
import { formatCompetence, formatDate, todayInput } from '../lib/format'
import { planSummary } from '../lib/planAccess'
import { showSaveToast } from '../lib/saveToast'
import { VOICE_LAUNCH_ENABLED } from '../lib/voiceLaunch'
import { useTheme } from '../theme/ThemeProvider'
import pageStyles from './pageStyles'
import settingsStyles from './settings/settings.module.css'
import { WhatsAppSection } from './settings/WhatsAppSection'

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
  const { plan: accessPlan } = usePlanAccess()
  const profile = useLoad(() => familyApi.profile(), [])
  const plan = useLoad(() => planApi.get(), [])
  const exportOnlyUntil = accessPlan?.exportOnlyUntil
  const exportOnly = Boolean(exportOnlyUntil && new Date(exportOnlyUntil).getTime() > Date.now())
  const savePrefs = useAction()
  const privacy = useAction()
  const share = useAction()
  const savedMonths = useLoad(() => monthsApi.shared(), [])
  const [shareYm, setShareYm] = useState(() => todayInput().slice(0, 7))
  const [pending, setPending] = useState<string[]>([])
  const [draft, setDraft] = useState<PrefDraft | null>(null)
  const [saved, setSaved] = useState<PrefDraft | null>(null)
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

  const sharedNow = savedMonths.data ?? []
  const months = [...new Set([...sharedNow, ...pending])].sort()

  function addShareMonth() {
    if (!/^\d{4}-\d{2}$/.test(shareYm)) {
      share.setError('Escolha o mês e o ano.')
      return
    }
    if (shareYm > todayInput().slice(0, 7)) {
      share.setError('Escolha um mês até o atual.')
      return
    }
    if (months.includes(shareYm)) {
      share.setError(null)
      return
    }
    setPending((current) => [...current, shareYm])
    share.setError(null)
  }

  async function shareMonth(event: FormEvent) {
    event.preventDefault()
    if (pending.length === 0) {
      share.setError('Adicione ao menos um mês.')
      return
    }
    const picked = [...pending]
    const ok = await share.run(async () => {
      for (const ym of picked) {
        await monthsApi.share(ym)
      }
    })
    if (ok) {
      setPending([])
      savedMonths.reload()
      showSaveToast(picked.length === 1 ? 'Mês compartilhado.' : 'Meses compartilhados.')
    }
  }

  async function removeShareMonth(ym: string) {
    const confirmed = await confirmDestructive(
      `Tirar ${formatCompetence(ym)} dos meses compartilhados?`,
      { title: 'Tirar mês', confirmLabel: 'Tirar' },
    )
    if (!confirmed) return
    if (sharedNow.includes(ym)) {
      const ok = await share.run(() => monthsApi.unshare(ym))
      if (ok) savedMonths.reload()
      return
    }
    setPending((current) => current.filter((item) => item !== ym))
  }

  async function exportData() {
    const ok = await privacy.run(() => lgpdApi.exportData())
    if (ok) {
      showSaveToast(
        'A exportação será agendada e estará disponível pra você daqui a 24 horas.',
        5000,
      )
    }
  }

  async function deleteAccount() {
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
      <ErrorText message={profile.error ?? plan.error ?? savePrefs.error ?? privacy.error ?? share.error ?? savedMonths.error} />
      {profile.loading && !profile.data ? <Loading /> : null}

      {draft ? (
        <form
          id="settings-prefs"
          className={`${styles.form} ${styles.settingsForm}`}
          onSubmit={(event) => void onSave(event)}
        >
          <details className={`${styles.section} ${settingsStyles.accordion}`} id="ritmo">
            <summary>
              <strong>Ritmo</strong>
              <span>Modo discreto, e-mails, reserva e fechamento.</span>
            </summary>
            <div className={settingsStyles.accordionBody}>
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
              className={settingsStyles.shortNumber}
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
              className={settingsStyles.shortNumber}
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
              className={settingsStyles.shortNumber}
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
              description="Desligado fecha a jornada de vez, neste aparelho e nos outros. Para só esconder, com um botão para abrir de novo, use Esconder na tela inicial."
            />
            </div>
          </details>

          <details className={`${styles.section} ${settingsStyles.accordion}`} id="retrospectiva">
            <summary>
              <strong>Retrospectiva</strong>
              <span>Valores ou só percentuais.</span>
            </summary>
            <div className={settingsStyles.accordionBody}>
            <CheckboxField
              label="Incluir valores absolutos"
              name="includeValues"
              checked={draft.includeAbsoluteValuesInRetrospective}
              onChange={(event) => patch({ includeAbsoluteValuesInRetrospective: event.target.checked })}
              description="Ligado: mostra valores. Desligado: só percentuais e marcos."
            />
            </div>
          </details>

          {VOICE_LAUNCH_ENABLED ? (
            <details className={`${styles.section} ${settingsStyles.accordion}`} id="voz">
              <summary>
                <strong>Voz</strong>
                <span>Confirmação antes de gravar.</span>
              </summary>
              <div className={settingsStyles.accordionBody}>
              <CheckboxField
                label="Confirmar lançamento por voz"
                name="voiceEntryConfirm"
                checked={draft.voiceEntryConfirm}
                onChange={(event) => patch({ voiceEntryConfirm: event.target.checked })}
                description="Ligado: microfone no início e o Ian confirma o lançamento antes de gravar. Desligado: sem microfone no painel."
              />
              </div>
            </details>
          ) : null}
        </form>
      ) : null}

      <details className={`${styles.section} ${settingsStyles.accordion}`} id="whatsapp">
        <summary>
          <strong>WhatsApp</strong>
          <span>Vínculo do celular e conversa.</span>
        </summary>
        <div className={settingsStyles.accordionBody}>
          <WhatsAppSection framed={false} />
        </div>
      </details>

      <details className={`${styles.section} ${settingsStyles.accordion}`} id="conta">
        <summary>
          <strong>Conta</strong>
          <span>Plano, perfil, exportar e excluir.</span>
        </summary>
        <div className={settingsStyles.accordionBody}>
        <div className={styles.accountLinks}>
          <Link to="/novidades" className={styles.accountLink}>
            <strong>Novidades</strong>
            <span>O que entrou em cada versão.</span>
          </Link>
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
          Baixe uma cópia dos seus dados ou exclua sua conta. Exportar e excluir são ações separadas: dá para
          excluir sem exportar. O aceite ciente da LGPD é pedido só no pagamento de um plano pago.
        </p>
        {exportOnly ? (
          <p className={styles.muted} role="status">
            Sua compra na Hotmart foi cancelada. Até {formatDate(exportOnlyUntil)} você só pode exportar seus dados.
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" disabled={privacy.busy} onClick={() => void exportData()}>
            Exportar meus dados
          </Button>
          <Button
            variant="danger"
            disabled={privacy.busy}
            onClick={() => void deleteAccount()}
          >
            Excluir minha conta
          </Button>
        </div>
        </div>
      </details>

      <details className={`${styles.section} ${settingsStyles.accordion}`} id="compartilhar-mes">
        <summary>
          <strong>Compartilhar mês</strong>
          <span>Meses para o acompanhamento.</span>
        </summary>
        <form className={settingsStyles.accordionBody} onSubmit={(event) => void shareMonth(event)}>
          <p className={styles.muted}>
            Ao compartilhar, os administradores do Conora passam a acompanhar somente os meses que você
            incluir aqui, para análise e assistência no programa raio-X, conforme o combinado com o seu
            consultor financeiro. Se você não contratou esse acompanhamento, não faça o compartilhamento.
          </p>
          <div className={settingsStyles.sharePick}>
            <Field
              label="Mês"
              name="shareYm"
              type="month"
              required
              max={todayInput().slice(0, 7)}
              value={shareYm}
              onChange={(event) => setShareYm(event.target.value)}
            />
            <Button type="button" variant="secondary" onClick={addShareMonth}>
              Adicionar mês
            </Button>
          </div>
          {months.length > 0 ? (
            <ul className={settingsStyles.shareList}>
              {months.map((ym) => (
                <li key={ym}>
                  <span>{formatCompetence(ym)}</span>
                  <DeleteIconButton
                    label={`Tirar ${formatCompetence(ym)}`}
                    onClick={() => void removeShareMonth(ym)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Nenhum mês na lista.</p>
          )}
          <div className={styles.formActions}>
            <Button type="submit" disabled={share.busy || pending.length === 0}>
              Compartilhar meses
            </Button>
          </div>
        </form>
      </details>

      <div className={styles.formActions}>
        <Button type="button" variant="secondary" disabled={!dirty || savePrefs.busy} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" form="settings-prefs" disabled={!dirty || savePrefs.busy}>
          Salvar
        </Button>
      </div>
    </div>
  )
}
