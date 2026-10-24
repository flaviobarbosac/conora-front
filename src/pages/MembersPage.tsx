import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { familyApi, planApi, type FamilyInvite, type FamilyMemberUser, type FamilyNotice } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { confirmDestructive } from '../lib/confirm'
import { familyInviteLimit } from '../lib/planAccess'
import { formatDateTime } from '../lib/format'
import { cameraAvailable, renderQrDataUrl, startQrScan, type QrKind, type QrScanSession } from '../lib/qrInvite'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

export function MembersPage() {
  const navigate = useNavigate()
  const profile = useLoad(() => familyApi.profile(), [])
  const group = useLoad(() => familyApi.group(), [])
  const plan = useLoad(() => planApi.get(), [])
  const [displayName, setDisplayName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [transferQr, setTransferQr] = useState<string | null>(null)
  const [qrInviteId, setQrInviteId] = useState<string | null>(null)
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanRef = useRef<QrScanSession | null>(null)
  const profileAction = useAction()
  const inviteAction = useAction()
  const qrAction = useAction()
  const rowAction = useAction()

  const profileData = profile.data
  const groupData = group.data
  const nameDraft = displayName || profileData?.name || ''

  useEffect(() => {
    return () => {
      scanRef.current?.stop()
      scanRef.current = null
    }
  }, [])

  const transferUrl = groupData?.isBudgetOwner ? groupData.pendingOwnerTransfer?.authorizeUrl : null
  useEffect(() => {
    if (!transferUrl || groupData?.pendingOwnerTransfer?.isAuthorized) {
      setTransferQr(null)
      return
    }
    let cancelled = false
    void renderQrDataUrl(transferUrl).then((dataUrl) => {
      if (!cancelled) setTransferQr(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [transferUrl, groupData?.pendingOwnerTransfer?.isAuthorized])

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
    if (seatFull && seat) {
      inviteAction.setError(seat.message)
      return
    }
    if (await inviteAction.run(() => familyApi.invite(email))) {
      showSaveToast('Convite enviado.')
      setInviteEmail('')
      group.reload()
    }
  }

  async function showQr() {
    setQrError(null)
    if (seatFull && seat) {
      setQrError(seat.message)
      return
    }
    try {
      const created = await familyApi.createQrInvite()
      const dataUrl = await renderQrDataUrl(created.joinUrl)
      setQrDataUrl(dataUrl)
      setQrInviteId(created.id)
      setQrExpiresAt(created.expiresAt)
      group.reload()
    } catch (caught) {
      setQrError(caught instanceof Error ? caught.message : 'Não foi possível gerar o QR code.')
    }
  }

  async function hideQr() {
    if (qrInviteId) {
      await qrAction.run(() => familyApi.cancelInvite(qrInviteId))
    }
    setQrDataUrl(null)
    setQrInviteId(null)
    setQrExpiresAt(null)
    group.reload()
  }

  async function beginScan() {
    setQrError(null)
    if (!cameraAvailable()) {
      setQrError(
        'Este navegador não liberou a câmera. Use o Chrome, o Safari, o Edge, o Firefox ou o aplicativo Conora.',
      )
      return
    }
    setScanning(true)
    await new Promise((resolve) => window.setTimeout(resolve, 50))
    const video = videoRef.current
    if (!video) {
      setScanning(false)
      setQrError('Não foi possível abrir a câmera.')
      return
    }
    try {
      scanRef.current = await startQrScan(
        video,
        (token, kind) => {
          setScanning(false)
          void acceptFromQr(token, kind)
        },
        (message) => setQrError(message),
      )
    } catch (caught) {
      setScanning(false)
      setQrError(caught instanceof Error ? caught.message : 'Não foi possível abrir a câmera.')
    }
  }

  function stopScan() {
    scanRef.current?.stop()
    scanRef.current = null
    setScanning(false)
  }

  async function acceptFromQr(token: string, kind: QrKind = 'invite') {
    stopScan()
    if (kind === 'owner') {
      if (await qrAction.run(() => familyApi.acceptOwnerTransfer(token))) {
        showSaveToast('Autorização registrada. O orçamento muda quando o titular cancelar na loja.')
        group.reload()
      }
      return
    }
    if (await qrAction.run(() => familyApi.acceptInvite(token))) {
      showSaveToast('Você entrou no grupo.')
      group.reload()
      navigate('/orcamento')
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
    if (groupData && !groupData.canLeave) {
      rowAction.setError(
        'Responsável pelo orçamento precisa transferir o orçamento antes de sair do grupo.',
      )
      return
    }
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

  async function transferOwnership(member: FamilyMemberUser) {
    if (
      !(await confirmDestructive(
        `Pedir para ${member.name} autorizar a administração? Ela escaneia o QR. Nada muda até ela autorizar e você cancelar na loja.`,
        { title: 'Transferir orçamento', confirmLabel: 'Enviar pedido' },
      ))
    ) {
      return
    }
    if (await rowAction.run(() => familyApi.requestOwnerTransfer(member.usuarioId))) {
      showSaveToast('Pedido de transferência enviado.')
      group.reload()
    }
  }

  async function confirmStoreCancelled() {
    if (await rowAction.run(() => familyApi.confirmStoreCancelled())) {
      showSaveToast('Cancelamento registrado. Os orçamentos deste mês em diante foram para a nova responsável.')
      group.reload()
    }
  }

  async function cancelTransfer() {
    if (await rowAction.run(() => familyApi.cancelOwnerTransfer())) {
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

  const openInvites = (groupData?.pendingInvites.filter((i) => i.isOpen && i.email.trim()) ?? [])
  const seat = plan.data ? familyInviteLimit(plan.data) : null
  const occupiedExtra = Math.max(0, (groupData?.members.length ?? 1) - 1) + openInvites.length
  const seatFull = seat !== null && occupiedExtra >= seat.maxExtra
  const hasGroup = Boolean(groupData?.groupId)
  const canInvite = !hasGroup || Boolean(groupData?.isBudgetOwner)
  const canScan = !hasGroup

  return (
    <div className={styles.page}>
      <PageHeader kicker="Família" title="Grupo e perfil" />
      <ErrorText
        message={
          profile.error ??
          group.error ??
          profileAction.error ??
          inviteAction.error ??
          qrAction.error ??
          rowAction.error ??
          qrError
        }
      />
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
                    {member.isBudgetOwner ? <Badge tone="ok">Orçamento</Badge> : null}
                    {groupData.isBudgetOwner && !member.isSelf && hasGroup ? (
                      <Button
                        variant="secondary"
                        disabled={rowAction.busy || Boolean(groupData.pendingOwnerTransfer)}
                        onClick={() => void transferOwnership(member)}
                      >
                        Transferir orçamento
                      </Button>
                    ) : null}
                    {groupData.isBudgetOwner && !member.isSelf && hasGroup ? (
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
            {groupData.pendingOwnerTransfer ? (
              <p className={styles.muted}>
                A transferência de administração fica disponível do dia 1 ao dia 5. Pendente para{' '}
                {groupData.pendingOwnerTransfer.toName}.
                {groupData.pendingOwnerTransfer.isAuthorized
                  ? ' Autorizada. Cancele a assinatura na loja. Depois do cancelamento, a nova responsável tem 24 horas para assinar.'
                  : ' Ela precisa autorizar no QR antes de qualquer mudança.'}{' '}
                {groupData.isBudgetOwner && groupData.pendingOwnerTransfer.isAuthorized ? (
                  <>
                    {' '}
                    <Button
                      variant="secondary"
                      disabled={rowAction.busy}
                      onClick={() => void confirmStoreCancelled()}
                    >
                      Já cancelei na loja
                    </Button>
                  </>
                ) : null}
                {groupData.isBudgetOwner ? (
                  <>
                    {' '}
                    <Button variant="secondary" disabled={rowAction.busy} onClick={() => void cancelTransfer()}>
                      Cancelar pedido
                    </Button>
                  </>
                ) : null}
              </p>
            ) : null}
            {transferQr ? (
              <img src={transferQr} alt="QR para a nova responsável autorizar a administração" width={220} height={220} />
            ) : null}
            {hasGroup ? (
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  disabled={rowAction.busy || !groupData.canLeave}
                  onClick={() => void leaveGroup()}
                >
                  Sair do grupo
                </Button>
                {!groupData.canLeave ? (
                  <span className={styles.muted}>Transfira o orçamento antes de sair.</span>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Convite por QR code</h2>
            <p className={styles.muted}>
              O responsável mostra o QR. Quem ainda não está em grupo lê o código nesta mesma tela.
            </p>
            {seatFull && seat && canInvite ? (
              <p className={styles.muted}>
                {seat.message} <Link to="/plano">Ver planos</Link>
              </p>
            ) : null}
            <div className={styles.actions}>
              {canInvite ? (
                qrDataUrl ? (
                  <Button variant="secondary" disabled={qrAction.busy} onClick={() => void hideQr()}>
                    Fechar QR
                  </Button>
                ) : (
                  <Button disabled={qrAction.busy} onClick={() => void showQr()}>
                    Mostrar QR
                  </Button>
                )
              ) : null}
              {canScan ? (
                scanning ? (
                  <Button variant="secondary" onClick={stopScan}>
                    Parar câmera
                  </Button>
                ) : (
                  <Button variant="secondary" disabled={qrAction.busy} onClick={() => void beginScan()}>
                    Ler QR code
                  </Button>
                )
              ) : null}
            </div>
            {qrDataUrl ? (
              <div className={styles.qrPanel}>
                <img className={styles.qrImage} src={qrDataUrl} alt="QR code do convite do grupo" />
                {qrExpiresAt ? (
                  <p className={styles.muted}>Válido até {formatDateTime(qrExpiresAt)} · uso único</p>
                ) : null}
              </div>
            ) : null}
            {scanning ? (
              <div className={styles.qrPanel}>
                <video ref={videoRef} className={styles.qrVideo} muted playsInline />
                <p className={styles.muted}>Aponte para o QR do responsável pelo grupo.</p>
              </div>
            ) : null}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Convidar por e-mail</h2>
            {seatFull && seat && canInvite ? (
              <p className={styles.muted}>
                {seat.message} <Link to="/plano">Ver planos</Link>
              </p>
            ) : null}
            {canInvite ? (
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
            ) : (
              <p className={styles.muted}>
                Só o responsável pelo grupo pode convidar. Se a responsabilidade for transferida para você, o
                convite passa a aparecer aqui.
              </p>
            )}
            {canInvite && openInvites.length > 0 ? (
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
