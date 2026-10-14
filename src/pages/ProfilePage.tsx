import { useEffect, useState, type FormEvent } from 'react'
import { familyApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

function initialsFrom(name: string, email: string): string {
  const source = name.trim() || email.trim()
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

export function ProfilePage() {
  const profile = useLoad(() => familyApi.profile(), [])
  const saveProfile = useAction()
  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const dirty = name.trim() !== savedName.trim()
  useRegisterDirty('profile-form', dirty)

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name)
      setSavedName(profile.data.name)
    }
  }, [profile.data])

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (await saveProfile.run(() => familyApi.updateProfile(name.trim()))) {
      setSavedName(name.trim())
      showSaveToast('Nome salvo.')
      profile.reload()
      window.dispatchEvent(new Event('conora:profile-changed'))
    }
  }

  function onCancel() {
    setName(savedName)
  }

  const data = profile.data

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Perfil" />
      <ErrorText message={profile.error ?? saveProfile.error} />
      {profile.loading && !data ? <Loading /> : null}

      {data ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.avatarLarge} aria-hidden="true">
              {initialsFrom(name || data.name, data.email)}
            </span>
            <div>
              <h2 className={styles.sectionTitle}>Conta</h2>
              <p className={styles.muted}>Sem foto. A inicial do nome identifica você no app.</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={(event) => void onSave(event)}>
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
            <Field label="E-mail" name="email" value={data.email} readOnly disabled />
            <div className={styles.formActions}>
              <Button type="button" variant="secondary" disabled={!dirty || saveProfile.busy} onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveProfile.busy || !name.trim() || !dirty}>
                Salvar
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  )
}
