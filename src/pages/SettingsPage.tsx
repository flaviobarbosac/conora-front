import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { familyApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import {
  readDefaultBudgetMode,
  readSidebarCollapsed,
  writeDefaultBudgetMode,
  writeSidebarCollapsed,
} from '../lib/preferences'
import { ThemeName, useTheme } from '../theme/ThemeProvider'
import styles from './page.module.css'

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const profile = useLoad(() => familyApi.profile(), [])
  const saveProfile = useAction()
  const [name, setName] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [budgetMode, setBudgetMode] = useState(readDefaultBudgetMode)

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name)
    }
  }, [profile.data])

  async function onSaveName(event: FormEvent) {
    event.preventDefault()
    if (await saveProfile.run(() => familyApi.updateProfile(name.trim()))) {
      profile.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Configurações" />
      <ErrorText message={profile.error ?? saveProfile.error} />
      {profile.loading && !profile.data ? <Loading /> : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aparência</h2>
        <Select
          label="Tema"
          name="theme"
          value={theme}
          onChange={(event) => setTheme(event.target.value === ThemeName.Dark ? ThemeName.Dark : ThemeName.Light)}
        >
          <option value={ThemeName.Light}>Claro</option>
          <option value={ThemeName.Dark}>Escuro</option>
        </Select>
        <Select
          label="Menu lateral (desktop)"
          name="sidebar"
          value={sidebarCollapsed ? 'collapsed' : 'expanded'}
          onChange={(event) => {
            const collapsed = event.target.value === 'collapsed'
            setSidebarCollapsed(collapsed)
            writeSidebarCollapsed(collapsed)
          }}
        >
          <option value="expanded">Expandido (ícone e texto)</option>
          <option value="collapsed">Recolhido (só ícones)</option>
        </Select>
        <p className={styles.muted}>O tema e o menu ficam neste aparelho. O nome de exibição vale na sua conta.</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Orçamento</h2>
        <Select
          label="Modo padrão"
          name="budgetMode"
          value={budgetMode}
          onChange={(event) => {
            const mode = event.target.value === 'Detailed' ? 'Detailed' : 'Simple'
            setBudgetMode(mode)
            writeDefaultBudgetMode(mode)
          }}
        >
          <option value="Simple">Simples (por grupo)</option>
          <option value="Detailed">Detalhado (por linha)</option>
        </Select>
        <p className={styles.muted}>Usado quando o mês ainda não tem orçamento gravado. Depois vale o que estiver salvo no mês.</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Perfil</h2>
        <form className={styles.form} onSubmit={(event) => void onSaveName(event)}>
          <div className={styles.formWide}>
            <Field
              label="Nome de exibição"
              name="displayName"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              hint="Aparece no grupo familiar e nos avisos."
            />
          </div>
          <Field label="E-mail" name="email" value={profile.data?.email ?? ''} readOnly disabled />
          <div className={styles.formActions}>
            <Button type="submit" disabled={saveProfile.busy || !name.trim()}>
              Salvar nome
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Atalhos</h2>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowMain}>
              <strong>Grupo familiar</strong>
              <span className={styles.rowSub}>Convite, sair e membros</span>
            </span>
            <Link to="/membros">Abrir</Link>
          </li>
          <li className={styles.row}>
            <span className={styles.rowMain}>
              <strong>WhatsApp</strong>
              <span className={styles.rowSub}>Vincular número e rascunhos</span>
            </span>
            <Link to="/whatsapp">Abrir</Link>
          </li>
          <li className={styles.row}>
            <span className={styles.rowMain}>
              <strong>Plano</strong>
              <span className={styles.rowSub}>Assinatura e situação</span>
            </span>
            <Link to="/plano">Abrir</Link>
          </li>
          <li className={styles.row}>
            <span className={styles.rowMain}>
              <strong>Central de ajuda</strong>
              <span className={styles.rowSub}>Módulos, campos e glossário</span>
            </span>
            <Link to="/ajuda">Abrir</Link>
          </li>
        </ul>
      </section>
    </div>
  )
}
