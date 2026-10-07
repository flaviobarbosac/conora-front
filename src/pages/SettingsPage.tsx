import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
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

const SHORTCUTS: ReadonlyArray<{ to: string; title: string; text: string }> = [
  { to: '/membros', title: 'Grupo familiar', text: 'Convite, sair e membros' },
  { to: '/plano', title: 'Plano', text: 'Assinatura e situação' },
  { to: '/ajuda', title: 'Central de ajuda', text: 'Módulos, campos e glossário' },
]

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { hash } = useLocation()
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

  useEffect(() => {
    const id = hash.replace(/^#/, '')
    if (!id) {
      return
    }
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hash, profile.loading])

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

      <section className={styles.section} id="aparencia">
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

      <section className={styles.section} id="perfil">
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
          {SHORTCUTS.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className={styles.rowLink}>
                <span className={styles.rowMain}>
                  <strong>{item.title}</strong>
                  <span className={styles.rowSub}>{item.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
