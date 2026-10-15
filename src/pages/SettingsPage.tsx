import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  familyApi,
  lgpdApi,
  planApi,
  type UserPreferencesInput,
} from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { downloadBlob } from '../lib/format'
import { planSummary } from '../lib/planAccess'
import { showSaveToast } from '../lib/saveToast'
import { useTheme } from '../theme/ThemeProvider'
import styles from './page.module.css'

type PrefDraft = Omit<UserPreferencesInput, 'themeId'>

function fromProfile(
  quietMode: boolean,
  emailsEnabled: boolean,
  reserveTargetMonths: number,
  monthCloseDay: number,
  includeAbsoluteValuesInRetrospective: boolean,
): PrefDraft {
  return {
    quietMode,
    emailsEnabled,
    reserveTargetMonths,
    monthCloseDay,
    includeAbsoluteValuesInRetrospective,
  }
}

export function SettingsPage() {
  const { theme } = useTheme()
  const { logout } = useAuth()
  const profile = useLoad(() => familyApi.profile(), [])
  const plan = useLoad(() => planApi.get(), [])
  const savePrefs = useAction()
  const privacy = useAction()
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
      }),
    )
    if (!ok) return
    setSaved(draft)
    showSaveToast('Configurações salvas.')
    profile.reload()
    window.dispatchEvent(new Event('conora:profile-changed'))
  }

  async function exportData() {
    await privacy.run(async () => {
      const data = await lgpdApi.exportData()
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'conora-meus-dados.json')
    })
  }

  async function deleteAccount() {
    const confirmed = await confirmDestructive(
      'Excluir sua conta remove o acesso ao app. Registros com obrigação fiscal podem ser retidos por até 5 anos. Continuar?',
      { title: 'Excluir conta' },
    )
    if (confirmed && (await privacy.run(() => lgpdApi.deleteAccount()))) {
      await logout()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Configurações" />
      <ErrorText message={profile.error ?? plan.error ?? savePrefs.error ?? privacy.error} />
      {profile.loading && !profile.data ? <Loading /> : null}

      {draft ? (
        <form className={styles.form} onSubmit={(event) => void onSave(event)}>
          <section className={styles.section} id="ritmo">
            <h2 className={styles.sectionTitle}>Ritmo</h2>
            <Select
              label="Modo discreto"
              name="quietMode"
              value={draft.quietMode ? 'on' : 'off'}
              onChange={(event) => patch({ quietMode: event.target.value === 'on' })}
            >
              <option value="off">Desligado — mostra jornada e celebrações</option>
              <option value="on">Ligado — só números, sem celebrações</option>
            </Select>
            <Select
              label="E-mails do Conora"
              name="emailsEnabled"
              value={draft.emailsEnabled ? 'on' : 'off'}
              onChange={(event) => patch({ emailsEnabled: event.target.value === 'on' })}
            >
              <option value="on">Receber — avisos e convites do sistema</option>
              <option value="off">Não receber — desliga e-mails do Conora</option>
            </Select>
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
          </section>

          <section className={styles.section} id="retrospectiva">
            <h2 className={styles.sectionTitle}>Retrospectiva</h2>
            <Select
              label="Incluir valores absolutos"
              name="includeValues"
              value={draft.includeAbsoluteValuesInRetrospective ? 'on' : 'off'}
              onChange={(event) =>
                patch({ includeAbsoluteValuesInRetrospective: event.target.value === 'on' })
              }
            >
              <option value="off">Não — só percentuais e marcos</option>
              <option value="on">Sim — mostrar valores</option>
            </Select>
          </section>

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
          </Link>
        </div>
        <p className={styles.muted}>Baixe uma cópia dos seus dados ou exclua sua conta definitivamente.</p>
        <div className={styles.actions}>
          <Button variant="secondary" disabled={privacy.busy} onClick={() => void exportData()}>
            Exportar meus dados
          </Button>
          <Button variant="secondary" disabled={privacy.busy} onClick={() => void deleteAccount()}>
            Excluir minha conta
          </Button>
        </div>
      </section>
    </div>
  )
}
