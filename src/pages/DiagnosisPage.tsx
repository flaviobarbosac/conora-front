import { useState, type FormEvent } from 'react'
import { diagnosisApi, type IncomeSource } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { confirmDestructive } from '../lib/confirm'
import { currentCompetence, formatMoney, parseMoney } from '../lib/format'
import styles from './page.module.css'

function amountOrZero(text: string): number {
  return text.trim() ? parseMoney(text) : 0
}

export function DiagnosisPage() {
  const [ym, setYm] = useState(currentCompetence)
  const diagnosis = useLoad(() => diagnosisApi.get(ym), [ym])
  const remove = useAction()
  const data = diagnosis.data

  async function removeSource(source: IncomeSource) {
    if (!(await confirmDestructive(`Excluir a fonte "${source.name}"?`, { title: 'Excluir fonte' }))) {
      return
    }
    if (await remove.run(() => diagnosisApi.remove(source.id))) {
      diagnosis.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Diagnóstico" actions={<CompetencePicker value={ym} onChange={setYm} />} />
      <ErrorText message={diagnosis.error ?? remove.error} />
      {diagnosis.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.hero}>
            <span>Líquido para gastar</span>
            <strong>{formatMoney(data.netSpendable)}</strong>
            <span>
              Bruto {formatMoney(data.gross)} − INSS {formatMoney(data.inss)} − IR {formatMoney(data.ir)} · dízimo previsto{' '}
              {formatMoney(data.plannedTithe)}
            </span>
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Fontes de renda</h2>
            {data.sources.length === 0 ? <Empty>Nenhuma fonte cadastrada nesta competência.</Empty> : null}
            <ul className={styles.list}>
              {data.sources.map((source) => (
                <li key={source.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>{source.name}</strong>
                    <span className={styles.rowSub}>
                      Bruto {formatMoney(source.gross)} · INSS {formatMoney(source.inss)} · IR {formatMoney(source.ir)} · dízimo{' '}
                      {formatMoney(source.tithe)}
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <span className={`${styles.amount} ${styles.positive}`}>{formatMoney(source.netSpendable)}</span>
                    <Button variant="ghost" onClick={() => void removeSource(source)}>
                      Excluir
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
      <SourceForm ym={ym} onSaved={diagnosis.reload} />
    </div>
  )
}

function SourceForm({ ym, onSaved }: { ym: string; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [gross, setGross] = useState('')
  const [inss, setInss] = useState('')
  const [ir, setIr] = useState('')
  const [tithe, setTithe] = useState('')
  const action = useAction()

  const values = { gross: amountOrZero(gross), inss: amountOrZero(inss), ir: amountOrZero(ir), tithe: amountOrZero(tithe) }
  const net = values.gross - values.inss - values.ir

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0) || values.gross <= 0) {
      action.setError('Confira os valores informados.')
      return
    }
    if (await action.run(() => diagnosisApi.create({ name: name.trim(), competenceYm: ym, ...values }))) {
      setName('')
      setGross('')
      setInss('')
      setIr('')
      setTithe('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Nova fonte de renda</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
          <Field label="Nome" name="sourceName" required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <MoneyField label="Bruto (R$)" name="gross" required value={gross} onChange={setGross} />
        <MoneyField label="INSS (R$)" name="inss" value={inss} onChange={setInss} />
        <MoneyField label="IR (R$)" name="ir" value={ir} onChange={setIr} />
        <MoneyField label="Dízimo (R$)" name="tithe" value={tithe} onChange={setTithe} />
        <p className={`${styles.formWide} ${styles.muted}`}>
          Líquido: <strong>{formatMoney(Number.isFinite(net) ? net : 0)}</strong> (bruto − INSS − IR). O dízimo não reduz a renda.
        </p>
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Adicionar fonte
          </Button>
        </div>
      </form>
    </section>
  )
}
