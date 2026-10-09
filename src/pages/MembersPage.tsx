import { useState, type FormEvent } from 'react'
import { familyApi, type FamilyInvite, type FamilyMemberUser, type FamilyNotice } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { formatDateTime } from '../lib/format'
import styles from './page.module.css'

export function MembersPage() {
  const profile = useLoad(() => familyApi.profile(), [])
  const group = useLoad(() => familyApi.group(), [])
  const [displayName, setDisplayName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const profileAction = useAction()
  const inviteAction = useAction()
  const rowAction = useAction()

  const profileData = profile.data
  const groupData = group.data
  const nameDraft = displayName || profileData?.name || ''

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    const name = nameDraft.trim()
    if (!name) {
      profileAction.setError('Informe um nome.')
      return
    }
    if (await profileAction.run(() => familyApi.updateProfile(name))) {
      showSaveToast('Perfil salvo.')
      setDisplayName('')
      profile.reload()
      group.reload()
      window.dispatchEvent(new Event('conora:profile-changed'))
    }
  }

  async function sendInvite(event: FormEvent) {
    event.preventDefault()
    const email = inviteEmail.trim()
    if (!email) {
      inviteAction.setError('Informe o e-mail do convite.')
      return
    }
    if (await inviteAction.run(() => familyApi.invite(email))) {
      showSaveToast('Convite enviado.')
      setInviteEmail('')
      group.reload()
    }
  }

  async function cancelInvite(invite: FamilyInvite) {
    if (
      !(await confirmDestructive(`Cancelar o convite para ${invite.email}?`, {
        title: 'Cancelar convite',
        confirmLabel: 'Cancelar convite',
      }))
    ) {
      return
    }
    if (await rowAction.run(() => familyApi.cancelInvite(invite.id))) {
      group.reload()
    }
  }

  async function leaveGroup() {
    if (
      !(await confirmDestructive('Sair do grupo familiar? Seu orçamento volta a ser só pessoal.', {
        title: 'Sair do grupo',
        confirmLabel: 'Sair',
      }))
    ) {
      return
    }
    if (await rowAction.run(() => familyApi.leave())) {
      group.reload()
    }
  }

  async function removeMember(member: FamilyMemberUser) {
    if (
      !(await confirmDestructive(`Remover ${member.name} do grupo?`, {
        title: 'Remover membro',
        confirmLabel: 'Remover',
      }))
    ) {
      return
    }
    if (await rowAction.run(() => familyApi.removeMember(member.usuarioId))) {
      group.reload()
    }
  }

  async function readNotice(notice: FamilyNotice) {
    if (notice.isRead) {
      return
    }
    if (await rowAction.run(() => familyApi.readNotice(notice.id))) {
      group.reload()
    }
  }

  const openInvites = groupData?.pendingInvites.filter((i) => i.isOpen) ?? []
  const hasGroup = Boolean(groupData?.groupId)

  return (
    <div className={styles.page}>
      <PageHeader kicker="Família" title="Grupo e perfil" />
      <ErrorText message={profile.error ?? group.error ?? profileAction.error ?? inviteAction.error ?? rowAction.error} />
      {(profile.loading && !profileData) || (group.loading && !groupData) ? <Loading /> : null}

      {profileData ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Seu perfil</h2>
          <p className={styles.muted}>{profileData.email}</p>
          <form className={styles.form} onSubmit={(event) => void saveProfile(event)}>
            <div className={styles.formWide}>
              <Field
                label="Nome exibido"
                name="profileName"
                required
                value={nameDraft}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="submit" disabled={profileAction.busy}>
                Salvar perfil
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {groupData ? (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Grupo familiar</h2>
              {hasGroup ? <Badge tone="ok">Ativo</Badge> : <Badge tone="warning">Só você</Badge>}
            </div>
            {groupData.members.length === 0 ? <Empty>Nenhum membro.</Empty> : null}
            <ul className={styles.list}>
              {groupData.members.map((member) => (
                <li key={member.usuarioId} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>
                      {member.name}
                      {member.isSelf ? ' (você)' : ''}
                    </strong>
                    <span className={styles.rowSub}>{member.email}</span>
                  </span>
                  <span className={styles.rowEnd}>
                    {!member.isSelf && hasGroup ? (
                      <DeleteIconButton
                        label="Remover"
                        disabled={rowAction.busy}
                        onClick={() => void removeMember(member)}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {hasGroup ? (
              <div className={styles.actions}>
                <Button variant="secondary" disabled={rowAction.busy} onClick={() => void leaveGroup()}>
                  Sair do grupo
                </Button>
              </div>
            ) : null}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Convidar por e-mail</h2>
            <form className={styles.form} onSubmit={(event) => void sendInvite(event)}>
              <div className={styles.formWide}>
                <Field
                  label="E-mail"
                  name="inviteEmail"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="pessoa@email.com"
                />
              </div>
              <div className={styles.formActions}>
                <Button type="submit" disabled={inviteAction.busy}>
                  Enviar convite
                </Button>
              </div>
            </form>
            {openInvites.length > 0 ? (
              <>
                <h3 className={styles.sectionTitle}>Convites pendentes</h3>
                <ul className={styles.list}>
                  {openInvites.map((invite) => (
                    <li key={invite.id} className={styles.row}>
                      <span className={styles.rowMain}>
                        <strong>{invite.email}</strong>
                        <span className={styles.rowSub}>Expira {formatDateTime(invite.expiresAt)}</span>
                      </span>
                      <DeleteIconButton
                        label="Cancelar convite"
                        disabled={rowAction.busy}
                        onClick={() => void cancelInvite(invite)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          {groupData.notices.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Avisos</h2>
              <ul className={styles.list}>
                {groupData.notices.map((notice) => (
                  <li key={notice.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>{notice.message}</strong>
                      <span className={styles.rowSub}>{formatDateTime(notice.createdAt)}</span>
                    </span>
                    <span className={styles.rowEnd}>
                      {notice.isRead ? (
                        <Badge tone="ok">Lido</Badge>
                      ) : (
                        <Button variant="secondary" disabled={rowAction.busy} onClick={() => void readNotice(notice)}>
                          Marcar lido
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
