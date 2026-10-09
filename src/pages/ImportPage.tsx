import { useState, type FormEvent } from 'react'
import { importsApi, type ImportFormat, type ImportPreview } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText } from '../components/ui/Feedback'
import { ChartAccountSelect } from '../components/ChartAccountSelect'
import { Select } from '../components/ui/Select'
import { TextArea } from '../components/ui/TextArea'
import { useAction } from '../hooks/useAction'
import { useLookups } from '../hooks/useLookups'
import { formatDate, formatMoney } from '../lib/format'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

export function ImportPage() {
  const lookups = useLookups()
  const [format, setFormat] = useState<ImportFormat>('Csv')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [accountId, setAccountId] = useState('')
  const [expenseChartAccountId, setExpenseChartAccountId] = useState('')
  const [incomeChartAccountId, setIncomeChartAccountId] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const previewAction = useAction()
  const commitAction = useAction()

  async function runPreview(event: FormEvent) {
    event.preventDefault()
    setResult(null)
    const extension = format === 'Csv' ? 'csv' : 'ofx'
    await previewAction.run(async () => setPreview(await importsApi.preview(`colado.${extension}`, format, content)))
  }

  async function toggleRow(rowId: string, willImport: boolean) {
    if (!preview) {
      return
    }
    await commitAction.run(async () => {
      const row = await importsApi.setRow(preview.batchId, rowId, willImport)
      setPreview({ ...preview, rows: preview.rows.map((item) => (item.id === rowId ? row : item)) })
    })
  }

  async function commit() {
    if (!preview) {
      return
    }
    const saved = await commitAction.run(async () => {
      const done = await importsApi.commit(preview.batchId, accountId, expenseChartAccountId || undefined, incomeChartAccountId || undefined)
      setResult(`${done.imported} lançamento(s) importado(s), ${done.skipped} ignorado(s).`)
      setPreview(null)
      setContent('')
      lookups.reloadAccounts()
    })
    if (saved) {
      showSaveToast('Importação confirmada.')
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Importar extrato" />
      <section className={styles.section}>
        <form className={styles.form} onSubmit={(event) => void runPreview(event)}>
          <Select label="Formato" name="importFormat" value={format} onChange={(event) => setFormat(event.target.value as ImportFormat)}>
            <option value="Csv">CSV</option>
            <option value="Ofx">OFX</option>
          </Select>
          <div className={styles.formWide}>
            <TextArea
              label="Cole o conteúdo do arquivo"
              name="importContent"
              required
              rows={10}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          <div className={styles.formWide}>
            <ErrorText message={previewAction.error} />
            {result ? <p className={styles.success}>{result}</p> : null}
          </div>
          <div className={styles.formActions}>
            <Button type="submit" disabled={previewAction.busy}>
              Pré-visualizar
            </Button>
          </div>
        </form>
      </section>

      {preview ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Pré-visualização</h2>
          <p className={styles.muted}>
            {preview.rowCount} linha(s) · {preview.duplicateCount} possível(is) duplicata(s). Desmarque o que não deve entrar.
          </p>
          <ul className={styles.list}>
            {preview.rows.map((row) => (
              <li key={row.id} className={styles.row}>
                <label className={styles.rowMain}>
                  <strong>
                    <input
                      type="checkbox"
                      checked={row.willImport}
                      disabled={commitAction.busy}
                      onChange={(event) => void toggleRow(row.id, event.target.checked)}
                    />{' '}
                    {row.description}
                  </strong>
                  <span className={styles.rowSub}>{formatDate(row.date)}</span>
                </label>
                <span className={styles.rowEnd}>
                  {row.isDuplicate ? <Badge tone="warning">Duplicata</Badge> : null}
                  <span className={`${styles.amount} ${row.amount < 0 ? styles.negative : styles.positive}`}>{formatMoney(row.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.form}>
            <Select label="Conta de destino" name="importAccount" required value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Selecione</option>
              {lookups.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <span />
            <ChartAccountSelect
              label="Conta padrão de despesa"
              name="importExpenseAccount"
              value={expenseChartAccountId}
              onChange={setExpenseChartAccountId}
              options={lookups.expenseAccounts}
              tree={lookups.chartAccounts}
              emptyLabel="Automática"
            />
            <ChartAccountSelect
              label="Conta padrão de receita"
              name="importIncomeAccount"
              value={incomeChartAccountId}
              onChange={setIncomeChartAccountId}
              options={lookups.incomeAccounts}
              tree={lookups.chartAccounts}
              emptyLabel="Automática"
            />
          </div>
          <ErrorText message={commitAction.error} />
          <div className={styles.actions}>
            <Button disabled={commitAction.busy || !accountId} onClick={() => void commit()}>
              Confirmar importação
            </Button>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cancelar
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
