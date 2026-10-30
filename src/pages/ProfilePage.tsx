import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { familyApi, planApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { planSummary } from '../lib/planAccess'
import { showSaveToast } from '../lib/saveToast'
import styles from './pageStyles'

function initialsFrom(name: string, email: string): string {
  const source = name.trim() || email.trim()
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

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

export function ProfilePage() {
  const profile = useLoad(() => familyApi.profile(), [])
  const plan = useLoad(() => planApi.get(), [])
  const saveProfile = useAction()
  const photoAction = useAction()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [savedName, setSavedName] = useState('')
  const [savedPhone, setSavedPhone] = useState('')
  const [savedCep, setSavedCep] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const dirty =
    name.trim() !== savedName.trim() ||
    digitsOnly(phone) !== digitsOnly(savedPhone) ||
    digitsOnly(cep) !== digitsOnly(savedCep)
  useRegisterDirty('profile-form', dirty)

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name)
      setSavedName(profile.data.name)
      setPhone(profile.data.phone ? formatPhone(profile.data.phone) : '')
      setSavedPhone(profile.data.phone ? formatPhone(profile.data.phone) : '')
      setCep(profile.data.cep ? formatCep(profile.data.cep) : '')
      setSavedCep(profile.data.cep ? formatCep(profile.data.cep) : '')
    }
  }, [profile.data])

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    if (!profile.data?.hasPhoto) {
      setPhotoUrl(null)
      return
    }
    void familyApi.photoBlob().then((blob) => {
      if (cancelled || !blob) {
        if (!cancelled) setPhotoUrl(null)
        return
      }
      const url = URL.createObjectURL(blob)
      revoked = url
      setPhotoUrl(url)
    })
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [profile.data?.hasPhoto, profile.data?.photoContentHash])

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (
      await saveProfile.run(() =>
        familyApi.updateProfile({
          name: name.trim(),
          phone: digitsOnly(phone) || null,
          cep: digitsOnly(cep) || null,
        }),
      )
    ) {
      setSavedName(name.trim())
      setSavedPhone(formatPhone(phone))
      setSavedCep(formatCep(cep))
      showSaveToast('Perfil salvo.')
      profile.reload()
      window.dispatchEvent(new Event('conora:profile-changed'))
    }
  }

  function onCancel() {
    setName(savedName)
    setPhone(savedPhone)
    setCep(savedCep)
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return
    if (
      await photoAction.run(() => familyApi.uploadPhoto(file, file.name || 'photo.jpg'))
    ) {
      showSaveToast(profile.data?.hasPhoto ? 'Foto atualizada.' : 'Foto enviada.')
      profile.reload()
      window.dispatchEvent(new Event('conora:profile-changed'))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onRemovePhoto() {
    if (!(await photoAction.run(() => familyApi.deletePhoto()))) return
    showSaveToast('Foto removida.')
    profile.reload()
    window.dispatchEvent(new Event('conora:profile-changed'))
  }

  const data = profile.data

  return (
    <div className={styles.page}>
      <PageHeader title="Perfil" backTo={{ to: '/', label: '← Início' }} />
      <ErrorText message={profile.error ?? saveProfile.error ?? photoAction.error} />
      {profile.loading && !data ? <Loading /> : null}

      {data ? (
        <section className={styles.section}>
          <div className={styles.profileHead}>
            <span className={styles.avatarLarge} aria-hidden="true">
              {photoUrl ? (
                <img className={styles.avatarImage} src={photoUrl} alt="" />
              ) : (
                initialsFrom(name || data.name, data.email)
              )}
            </span>
            <div className={styles.profileIdentity}>
              <strong>{name.trim() || data.name}</strong>
              <span className={styles.profileLogin}>{data.email}</span>
            </div>
            <div className={styles.photoActions}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => void onPickPhoto(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={photoAction.busy}
                onClick={() => fileRef.current?.click()}
              >
                {data.hasPhoto ? 'Trocar foto' : 'Enviar foto'}
              </Button>
              {data.hasPhoto ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={photoAction.busy}
                  onClick={() => void onRemovePhoto()}
                >
                  Remover
                </Button>
              ) : null}
            </div>
          </div>

          <div className={styles.accountLinks}>
            <Link to="/plano" className={styles.accountLink}>
              <strong>Plano</strong>
              <span>{planSummary(plan.data)}</span>
            </Link>
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
            <Field
              label="E-mail"
              name="email"
              value={data.email}
              readOnly
              disabled
              autoComplete="username"
            />
            <Field
              label="Telefone"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
            />
            <Field
              label="CEP"
              name="cep"
              inputMode="numeric"
              autoComplete="postal-code"
              value={cep}
              onChange={(event) => setCep(formatCep(event.target.value))}
            />
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
