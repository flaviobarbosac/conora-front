import { useState, type FormEvent } from 'react'
import { membersApi, type Member } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import styles from './page.module.css'

export function MembersPage() {
  const members = useLoad(() => membersApi.list(), [])
  const [name, setName] = useState('')
  const create = useAction()
  const rowAction = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await create.run(() => membersApi.create(name.trim()))) {
      setName('')
      members.reload()
    }
  }

  async function toggle(member: Member) {
    if (await rowAction.run(() => membersApi.update(member.id, member.name, !member.isActive))) {
      members.reload()
    }
  }

  async function remove(member: Member) {
    if (window.confirm(`Excluir "${member.name}"?`) && (await rowAction.run(() => membersApi.remove(member.id)))) {
      members.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Membros" />
      <section className={styles.section}>
        <ErrorText message={members.error ?? rowAction.error} />
        {members.loading && !members.data ? <Loading /> : null}
        {members.data && members.data.length === 0 ? <Empty>Nenhum membro cadastrado.</Empty> : null}
        <ul className={styles.list}>
          {members.data?.map((member) => (
            <li key={member.id} className={styles.row}>
              <span className={styles.rowMain}>
                <strong>{member.name}</strong>
              </span>
              <span className={styles.rowEnd}>
                <Badge tone={member.isActive ? 'ok' : 'warning'}>{member.isActive ? 'Ativo' : 'Inativo'}</Badge>
                <Button variant="ghost" disabled={rowAction.busy} onClick={() => void toggle(member)}>
                  {member.isActive ? 'Desativar' : 'Ativar'}
                </Button>
                <Button variant="ghost" disabled={rowAction.busy} onClick={() => void remove(member)}>
                  Excluir
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Novo membro</h2>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <div className={styles.formWide}>
            <Field label="Nome" name="memberName" required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className={styles.formWide}>
            <ErrorText message={create.error} />
          </div>
          <div className={styles.formActions}>
            <Button type="submit" disabled={create.busy}>
              Adicionar membro
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
