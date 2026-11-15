import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  importsApi,
  type ImportCurrentRow,
  type ImportPreview,
  type ImportReport,
} from '../api/finance'
import { CategorySelect } from '../components/CategorySelect'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLookups } from '../hooks/useLookups'
import { confirmDestructive } from '../lib/confirm'
import { currentCompetence, formatDate, formatMoney } from '../lib/format'
import { showSaveToast } from '../lib/saveToast'
import { peekPendingShare, takePendingShare } from '../share/pendingShare'
import pageStyles from './pageStyles'
import local from './statementImport.module.css'

const styles = { ...pageStyles, ...local }

type Phase = 'boot' | 'summary' | 'account' | 'classify' | 'report' | 'done'

function fileFromDataUrl(dataUrl: string, fileName: string, mimeType: string): File {
  const [, base64 = ''] = dataUrl.split(',')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], fileName, { type: mimeType || 'application/octet-stream' })
}

export function StatementImportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lookups = useLookups()
  const action = useAction()
  const { setError } = action
  const fileRef = useRef<HTMLInputElement>(null)

  const competenceYm = searchParams.get('mes') || currentCompetence()
  const [phase, setPhase] = useState<Phase>('boot')
  const [batch, setBatch] = useState<ImportPreview | null>(null)
  const [current, setCurrent] = useState<ImportCurrentRow | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [resumeBatchId, setResumeBatchId] = useState<string | null>(null)

  const categoryOptions = useMemo(() => {
    if (!current) {
      return lookups.expenseAccounts
    }
    return current.row.amount >= 0 ? lookups.incomeAccounts : lookups.expenseAccounts
  }, [current, lookups.expenseAccounts, lookups.incomeAccounts])

  const loadCurrent = useCallback(
    async (batchId: string) => {
      const next = await importsApi.current(batchId)
      setCurrent(next)
      if (!next) {
        setPhase('done')
        setCategoryId('')
        return
      }
      setCategoryId(next.row.suggestedCategoryId ?? '')
      setPhase('classify')
    },
    [],
  )

  const enterBatch = useCallback(
    async (preview: ImportPreview, showSummary: boolean) => {
      setBatch(preview)
      setAccountId(preview.accountId ?? '')
      const toClassify = preview.pendingCount + preview.deferredCount
      if (!preview.accountMatched && (preview.accountNeedsCreate || !preview.accountId)) {
        setPhase('account')
        return
      }
      if (showSummary && (preview.duplicateCount > 0 || toClassify > 0)) {
        setPhase('summary')
        return
      }
      if (toClassify === 0) {
        setPhase('done')
        return
      }
      await loadCurrent(preview.batchId)
    },
    [loadCurrent],
  )

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const open = await importsApi.open(competenceYm)
        if (!active) {
          return
        }
        if (open) {
          setResumeBatchId(open.batchId)
        }

        const share = peekPendingShare()
        const isStatement =
          share &&
          (share.mimeType.includes('pdf') ||
            share.fileName.toLowerCase().endsWith('.pdf') ||
            share.fileName.toLowerCase().endsWith('.ofx') ||
            share.fileName.toLowerCase().endsWith('.csv') ||
            share.mimeType.includes('ofx') ||
            share.mimeType.includes('csv'))

        if (isStatement && share) {
          const file = fileFromDataUrl(share.dataUrl, share.fileName, share.mimeType)
          takePendingShare()
          const preview = await importsApi.upload(file, competenceYm)
          if (!active) {
            return
          }
          await enterBatch(preview, true)
          return
        }

        if (open && open.pendingCount + open.deferredCount > 0) {
          setBatch(open)
          setAccountId(open.accountId ?? '')
          // Only seed the initial screen — never stomp classify/report mid-flow when deps refresh.
          setPhase((current) =>
            current === 'boot' ? (open.accountId ? 'summary' : 'account') : current,
          )
          return
        }

        setPhase((current) => (current === 'boot' ? 'boot' : current))
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : 'Falha ao abrir o extrato.')
          setPhase('boot')
        }
      }
    })()
    return () => {
      active = false
    }
  }, [competenceYm, enterBatch, setError])

  async function uploadFile(file: File) {
    await action.run(async () => {
      const preview = await importsApi.upload(file, competenceYm)
      lookups.reloadAccounts()
      await enterBatch(preview, true)
    })
  }

  async function onPickFile(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) {
      return
    }
    await uploadFile(file)
  }

  async function resumeOpen() {
    if (!batch && resumeBatchId) {
      await action.run(async () => {
        const preview = await importsApi.get(resumeBatchId)
        await enterBatch(preview, false)
      })
      return
    }
    if (!batch) {
      return
    }
    if (!batch.accountId) {
      setPhase('account')
      return
    }
    await action.run(async () => loadCurrent(batch.batchId))
  }

  async function discardBatch() {
    if (!batch) {
      return
    }
    const ok = await confirmDestructive('Descartar este extrato e as linhas ainda não lançadas?', {
      title: 'Descartar extrato',
      confirmLabel: 'Descartar',
      cancelLabel: 'Manter',
    })
    if (!ok) {
      return
    }
    await action.run(async () => {
      await importsApi.discard(batch.batchId)
      setBatch(null)
      setCurrent(null)
      setResumeBatchId(null)
      setPhase('boot')
      showSaveToast('Extrato descartado.')
    })
  }

  async function bindExistingAccount() {
    if (!batch || !accountId) {
      action.setError('Selecione a conta.')
      return
    }
    await action.run(async () => {
      const preview = await importsApi.bindAccount(batch.batchId, { accountId })
      setBatch(preview)
      lookups.reloadAccounts()
      await loadCurrent(preview.batchId)
    })
  }

  async function createDetectedAccount() {
    if (!batch) {
      return
    }
    const detected = batch.detectedAccount
    const label = [
      detected?.bankName ?? detected?.bankCode,
      detected?.agency ? `Ag ${detected.agency}` : null,
      detected?.accountNumber
        ? `Cc ${detected.accountNumber}${detected.checkDigit ? `-${detected.checkDigit}` : ''}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

    const ok = await confirmDestructive(
      `A conta ${label || 'do extrato'} não está cadastrada. Deseja registrá-la agora?`,
      {
        title: 'Cadastrar conta',
        confirmLabel: 'Sim, cadastrar',
        cancelLabel: 'Não',
        danger: false,
      },
    )
    if (!ok) {
      return
    }
    await action.run(async () => {
      const preview = await importsApi.bindAccount(batch.batchId, {
        createIfMissing: true,
        kind: 'Checking',
      })
      setBatch(preview)
      lookups.reloadAccounts()
      await loadCurrent(preview.batchId)
    })
  }

  async function openReport() {
    if (!batch) {
      return
    }
    await action.run(async () => {
      setReport(await importsApi.report(batch.batchId))
      setPhase('report')
    })
  }

  async function commitCurrent(confirmDuplicate = false) {
    if (!batch || !current) {
      return
    }
    if (!categoryId) {
      action.setError('Escolha a categoria.')
      return
    }

    if (current.requiresDuplicateConfirm && !confirmDuplicate) {
      const choice = await confirmDestructive(
        'Já existe um lançamento com esta data, valor e descrição. Deseja lançar de novo ou pular?',
        {
          title: 'Possível duplicata',
          confirmLabel: 'Lançar de novo',
          cancelLabel: 'Pular',
          danger: false,
        },
      )
      if (!choice) {
        await action.run(async () => {
          const next = await importsApi.skipDuplicate(batch.batchId, current.row.id)
          setCurrent(next)
          if (!next) {
            setPhase('done')
            showSaveToast('Extrato concluído.')
            return
          }
          setCategoryId(next.row.suggestedCategoryId ?? '')
        })
        return
      }
      confirmDuplicate = true
    }

    const categoryLabel = lookups.categoryName(categoryId)
    const ok = await confirmDestructive(
      `Confirmar registro em ${categoryLabel} de ${formatMoney(Math.abs(current.row.amount))}?`,
      {
        title: 'Confirmar lançamento',
        confirmLabel: 'Sim',
        cancelLabel: 'Não',
        danger: false,
      },
    )
    if (!ok) {
      return
    }

    await action.run(async () => {
      const next = await importsApi.commitRow(batch.batchId, current.row.id, categoryId, confirmDuplicate)
      setCurrent(next)
      if (!next) {
        setPhase('done')
        showSaveToast('Extrato concluído.')
        return
      }
      setCategoryId(next.row.suggestedCategoryId ?? '')
      showSaveToast('Lançamento gravado.')
    })
  }

  async function deferCurrent() {
    if (!batch || !current) {
      return
    }
    await action.run(async () => {
      const next = await importsApi.deferRow(batch.batchId, current.row.id)
      setCurrent(next)
      if (!next) {
        setPhase('done')
        return
      }
      setCategoryId(next.row.suggestedCategoryId ?? '')
    })
  }

  async function ignoreCurrent() {
    if (!batch || !current) {
      return
    }
    await action.run(async () => {
      const next = await importsApi.ignoreRow(batch.batchId, current.row.id)
      setCurrent(next)
      if (!next) {
        setPhase('done')
        showSaveToast('Extrato concluído.')
        return
      }
      setCategoryId(next.row.suggestedCategoryId ?? '')
    })
  }

  const toClassify = (batch?.pendingCount ?? 0) + (batch?.deferredCount ?? 0)
  const alreadyLaunched = batch?.duplicateCount ?? 0

  return (
    <div className={styles.page}>
      <PageHeader
        title="Extrato bancário"
        backTo={{ to: '/lancamentos', label: '← Lançamentos' }}
        actions={
          phase === 'classify' && batch ? (
            <Button variant="secondary" disabled={action.busy} onClick={() => void openReport()}>
              Relatório
            </Button>
          ) : null
        }
      />

      <p className={styles.muted}>Competência {competenceYm}</p>
      <ErrorText message={action.error} />
      {action.error && /feedback|suporte t[eé]cnico/i.test(action.error) ? (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => window.dispatchEvent(new Event('conora:open-feedback'))}
          >
            Abrir Feedback
          </Button>
        </div>
      ) : null}

      {phase === 'boot' ? (
        <section className={styles.section}>
          <p className={styles.muted}>
            Envie o extrato em PDF, OFX ou CSV. Todos os dias do arquivo precisam ser deste mês.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.ofx,.qfx,.csv,application/pdf,application/x-ofx,text/csv"
            hidden
            onChange={(event) => void onPickFile(event.target.files)}
          />
          <div className={styles.actions}>
            <Button disabled={action.busy} onClick={() => fileRef.current?.click()}>
              Enviar extrato bancário
            </Button>
            {resumeBatchId ? (
              <Button variant="secondary" disabled={action.busy} onClick={() => void resumeOpen()}>
                Retomar extrato
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {phase === 'summary' && batch ? (
        <section className={styles.section}>
          <div className={styles.card}>
            <p className={styles.reportCount}>
              {alreadyLaunched} já lançados. {toClassify} para classificar.
            </p>
            <p className={styles.muted}>{batch.fileName}</p>
          </div>
          <div className={styles.actions}>
            <Button disabled={action.busy || toClassify === 0} onClick={() => void resumeOpen()}>
              {toClassify > 0 ? `Classificar os ${toClassify}` : 'Concluído'}
            </Button>
            <Button variant="secondary" disabled={action.busy} onClick={() => navigate('/lancamentos')}>
              Agora não
            </Button>
            <Button variant="secondary" disabled={action.busy} onClick={() => void discardBatch()}>
              Descartar extrato
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'account' && batch ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Conta do extrato</h2>
          {batch.detectedAccount ? (
            <div className={styles.card}>
              <strong>
                {batch.detectedAccount.bankName ?? batch.detectedAccount.bankCode ?? 'Banco'}
              </strong>
              <span className={styles.muted}>
                Agência {batch.detectedAccount.agency ?? '—'} · Conta{' '}
                {batch.detectedAccount.accountNumber ?? '—'}
                {batch.detectedAccount.checkDigit ? `-${batch.detectedAccount.checkDigit}` : ''}
              </span>
              {batch.accountNeedsCreate ? (
                <p className={styles.muted}>Esta conta não está cadastrada no Conora.</p>
              ) : null}
            </div>
          ) : (
            <p className={styles.muted}>Não foi possível ler banco e conta do arquivo. Escolha a conta.</p>
          )}
          <Select
            label="Conta de destino"
            name="statementAccount"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">Selecione</option>
            {lookups.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <div className={styles.actions}>
            <Button disabled={action.busy || !accountId} onClick={() => void bindExistingAccount()}>
              Usar esta conta
            </Button>
            {batch.accountNeedsCreate ? (
              <Button variant="secondary" disabled={action.busy} onClick={() => void createDetectedAccount()}>
                Cadastrar conta do extrato
              </Button>
            ) : null}
            <Button variant="secondary" disabled={action.busy} onClick={() => void discardBatch()}>
              Descartar extrato
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'classify' && current ? (
        <section className={styles.section}>
          <div className={styles.counter}>
            <span className={styles.counterText}>
              {current.position}/{current.totalRows}
              {current.deferredCount > 0 ? ` · ${current.deferredCount} para depois` : ''}
            </span>
          </div>
          <div className={styles.card}>
            <span className={styles.muted}>{formatDate(current.row.date)}</span>
            <strong>{current.row.description}</strong>
            <span className={`${styles.amount} ${current.row.amount < 0 ? styles.negative : styles.positive}`}>
              {formatMoney(current.row.amount)}
            </span>
            <span className={styles.muted}>{current.row.amount < 0 ? 'Débito' : 'Crédito'}</span>
          </div>
          <CategorySelect
            label="Categoria"
            name="statementCategory"
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            tree={lookups.categories}
            emptyLabel="Pesquisar categoria"
          />
          {current.row.suggestedCategoryName ? (
            <p className={styles.muted}>Sugestão: {current.row.suggestedCategoryName}</p>
          ) : null}
          <div className={styles.stickyActions}>
            <Button disabled={action.busy || !categoryId} onClick={() => void commitCurrent()}>
              Próximo
            </Button>
            <Button variant="secondary" disabled={action.busy} onClick={() => void deferCurrent()}>
              Classificar depois
            </Button>
            <Button variant="secondary" disabled={action.busy} onClick={() => void ignoreCurrent()}>
              Ignorar
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'report' && report ? (
        <section className={styles.section}>
          <div className={styles.reportBlock}>
            <h2 className={styles.sectionTitle}>Para classificar</h2>
            <p className={styles.reportCount}>{report.pendingCount}</p>
            <ul className={styles.reportList}>
              {report.pending.map((row) => (
                <li key={row.id} className={styles.reportItem}>
                  <strong>{row.description}</strong>
                  <span className={styles.muted}>
                    {formatDate(row.date)} · {formatMoney(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.reportBlock}>
            <h2 className={styles.sectionTitle}>Já lançados</h2>
            <p className={styles.reportCount}>{report.committedCount}</p>
            <ul className={styles.reportList}>
              {report.committed.map((row) => (
                <li key={row.id} className={styles.reportItem}>
                  <strong>{row.description}</strong>
                  <span className={styles.muted}>
                    {formatDate(row.date)} · {formatMoney(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.reportBlock}>
            <h2 className={styles.sectionTitle}>Adiados</h2>
            <p className={styles.reportCount}>{report.deferredCount}</p>
            <ul className={styles.reportList}>
              {report.deferred.map((row) => (
                <li key={row.id} className={styles.reportItem}>
                  <strong>{row.description}</strong>
                  <span className={styles.muted}>
                    {formatDate(row.date)} · {formatMoney(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className={styles.ignoredNote}>Ignorados: {report.ignoredCount}</p>
          <div className={styles.stickyActions}>
            <Button
              disabled={action.busy}
              onClick={() => {
                setPhase('classify')
              }}
            >
              Continuar análise
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'done' ? (
        <section className={styles.section}>
          <div className={styles.card}>
            <p className={styles.success}>Extrato tratado por completo.</p>
            <p className={styles.muted}>
              Todas as linhas foram lançadas, adiadas ou ignoradas. Não resta nada para classificar neste
              arquivo.
            </p>
          </div>
          <div className={styles.actions}>
            <Button onClick={() => navigate('/lancamentos')}>Ir para lançamentos</Button>
          </div>
        </section>
      ) : null}

      {action.busy && phase === 'boot' ? <Loading /> : null}
    </div>
  )
}
