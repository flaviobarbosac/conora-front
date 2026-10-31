import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { receiptsApi, type ReceiptIntake } from '../api/finance'
import { ReceiptClassifyDialog } from '../components/ReceiptClassifyDialog'
import {
  ReceiptReadingOverlay,
  WordLancamento,
  WordOrcamento,
} from '../components/ReceiptReadingOverlay'
import {
  pauseForDestinationCue,
  peekPendingIntakeId,
  pickReceiptMedia,
  pollReceipt,
  setPendingIntakeId,
  setReceiptRerouteHint,
  takePendingIntakeId,
  takeReceiptRerouteHint,
  uploadPendingShare,
} from '../lib/receiptFlow'
import { peekPendingShare, takePendingShare } from '../share/pendingShare'
import { resetMobileViewport } from '../lib/resetMobileViewport'
import { isNativeApp } from '../lib/platform'
import { scanReceipt, fileFromPending } from '../camera/scanReceipt'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { ScanPurposeSheet, type ScanPurposeChoice } from '../components/ScanPurposeSheet'
import { SharingViewToggle } from '../components/SharingViewToggle'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useBudgetPageController } from '../hooks/useBudgetPageController'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { formatCompetence } from '../lib/format'
import { budgetsApi } from '../api/finance'
import pageStyles from './pageStyles'
import budgetStyles from './budget/budget.module.css'
import { BudgetTreeEditor } from './budget/BudgetPagePanels'

const styles = { ...pageStyles, ...budgetStyles }

/** Container: route/data via hook; boleto orchestration stays here; tree is presentational panel. */
export function BudgetPage() {
  const navigate = useNavigate()
  const {
    searchParams,
    setSearchParams,
    focusCategoryId,
    returnTo,
    ym,
    setYm,
    scope,
    setScope,
    confirmLeave,
    isDirty,
    budget,
    year,
    yearData,
    categories,
    projects,
    monthStatus,
  } = useBudgetPageController()

  const copy = useAction()
  const canEdit = budget.data?.canEdit !== false
  const monthClosed = Boolean(monthStatus.data?.isClosed)
  const [boletoBusy, setBoletoBusy] = useState(false)
  const [boletoError, setBoletoError] = useState<string | null>(null)
  const [boletoIntake, setBoletoIntake] = useState<ReceiptIntake | null>(null)
  const [boletoClassifyOpen, setBoletoClassifyOpen] = useState(false)
  const [boletoRerouteHint, setBoletoRerouteHint] = useState<'to-budget' | 'to-expense' | null>(null)
  const [readingPurpose, setReadingPurpose] = useState<'Expense' | 'BudgetBoleto'>('BudgetBoleto')
  const [readingRerouted, setReadingRerouted] = useState(false)
  const [scanSheetOpen, setScanSheetOpen] = useState(false)

  async function finishBoleto(intake: ReceiptIntake) {
    if (intake.purpose === 'Expense') {
      setReadingPurpose('Expense')
      setReadingRerouted(true)
      setPendingIntakeId(intake.id)
      setReceiptRerouteHint('to-expense')
      await pauseForDestinationCue()
      navigate('/lancamentos?novo=1&recibo=1', { replace: true })
      return
    }
    if (intake.status === 'Failed') {
      setBoletoError(intake.failureReason ?? 'Não foi possível ler o boleto.')
      takePendingIntakeId()
      return
    }
    if (intake.status === 'Confirmed') {
      takePendingIntakeId()
      const competence = intake.budgetCompetenceYm
      showSaveToast(
        competence
          ? `Despesa a pagar no orçamento de ${formatCompetence(competence)}.`
          : 'Boleto provisionado no orçamento.',
      )
      if (competence && competence !== ym) {
        setYm(competence)
      } else {
        budget.reload()
        yearData.reload()
      }
      return
    }
    if (intake.needsClassification || intake.status === 'NeedsClassification') {
      setBoletoRerouteHint(takeReceiptRerouteHint())
      setBoletoIntake(intake)
      setBoletoClassifyOpen(true)
      return
    }
    if (intake.status === 'Ready') {
      const result = await receiptsApi.confirmBudget(intake.id)
      takePendingIntakeId()
      showSaveToast(
        `Despesa a pagar no orçamento de ${formatCompetence(result.competenceYm)}.` +
          (result.expenseDay != null ? ` Vencimento dia ${result.expenseDay}.` : ''),
      )
      if (result.competenceYm !== ym) {
        setYm(result.competenceYm)
      } else {
        budget.reload()
        yearData.reload()
      }
      return
    }
    setBoletoError('Classifique o boleto para gravar no orçamento.')
  }

  async function runContrachequeScan() {
    if (boletoBusy || !canEdit || monthClosed) return
    setBoletoError(null)
    resetMobileViewport()
    try {
      await scanReceipt({
        header: 'Contracheque / renda',
        photo: 'Galeria',
        picture: 'Câmera',
      })
      resetMobileViewport()
      navigate('/diagnostico?foto=1')
    } catch {
      /* user cancelled camera */
    } finally {
      resetMobileViewport()
    }
  }

  async function runBoletoScan() {
    if (boletoBusy || !canEdit || monthClosed) return
    setBoletoBusy(true)
    setReadingPurpose('BudgetBoleto')
    setReadingRerouted(false)
    setBoletoError(null)
    resetMobileViewport()
    try {
      // Native: camera. Web: file/PDF picker. One button covers both.
      const file = isNativeApp()
        ? await fileFromPending(
            await scanReceipt({
              header: 'Boleto',
              photo: 'Galeria',
              picture: 'Câmera',
            }),
          )
        : await pickReceiptMedia()
      resetMobileViewport()
      const created = await receiptsApi.upload(file, file.name || 'boleto.jpg', 'App', 'BudgetBoleto')
      const intake = await pollReceipt(created.id)
      setReadingPurpose(intake.purpose)
      await finishBoleto(intake)
    } catch (error) {
      setBoletoError(error instanceof Error ? error.message : 'Falha ao enviar a foto.')
    } finally {
      setBoletoBusy(false)
      setReadingRerouted(false)
      resetMobileViewport()
    }
  }

  function onScanPurpose(choice: ScanPurposeChoice) {
    if (choice === 'contracheque') {
      void runContrachequeScan()
      return
    }
    if (choice === 'cupom') {
      void scanReceipt()
        .then(() => navigate('/lancamentos?novo=1&recibo=1'))
        .catch(() => undefined)
      return
    }
    void runBoletoScan()
  }

  async function bootstrapPendingBoleto() {
    if (boletoBusy) return
    let intakeId = peekPendingIntakeId()
    if (!intakeId && !peekPendingShare()) return
    setBoletoBusy(true)
    setReadingPurpose('BudgetBoleto')
    setReadingRerouted(false)
    setBoletoError(null)
    resetMobileViewport()
    try {
      if (!intakeId) {
        const share = peekPendingShare()
        if (!share) return
        const created = await uploadPendingShare(share, 'App', 'BudgetBoleto')
        takePendingShare()
        intakeId = created.id
      }
      const intake = await pollReceipt(intakeId)
      setReadingPurpose(intake.purpose)
      await finishBoleto(intake)
    } catch (error) {
      setBoletoError(error instanceof Error ? error.message : 'Falha ao processar o boleto.')
    } finally {
      setBoletoBusy(false)
      setReadingRerouted(false)
      resetMobileViewport()
    }
  }

  useEffect(() => {
    if (searchParams.get('recibo') !== '1') return
    const next = new URLSearchParams(searchParams)
    next.delete('recibo')
    setSearchParams(next, { replace: true })
    void bootstrapPendingBoleto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function changeYm(next: string) {
    if (next === ym) return
    if (isDirty && !(await confirmLeave())) return
    setYm(next)
  }

  async function copyPrevious() {
    if (isDirty && !(await confirmLeave())) return
    const hasPlanned = (budget.data?.lines ?? []).some(
      (line) => !line.isGroup && Math.abs(line.plannedAmount) > 0.001,
    )
    let overwrite = false
    if (hasPlanned) {
      overwrite = await confirmDestructive(
        'Este mês já tem valores previstos. Deseja sobrescrever com o mês anterior?',
        {
          title: 'Copiar mês anterior',
          confirmLabel: 'Sobrescrever',
          cancelLabel: 'Só contas vazias',
          danger: false,
        },
      )
    }
    if (await copy.run(() => budgetsApi.copyPrevious(ym, overwrite))) {
      showSaveToast(
        overwrite ? 'Orçamento copiado do mês anterior.' : 'Contas vazias preenchidas com o mês anterior.',
      )
      budget.reload()
      yearData.reload()
    }
  }

  const data = budget.data
  // Only when Orçamento was opened from Raio-X (returnTo query from that click).
  const canReturnToRaioX = Boolean(returnTo)

  function goBackToRaioX() {
    if (!returnTo) {
      return
    }
    navigate(returnTo)
  }

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Planejamento"
        title="Orçamento"
        actions={
          <>
            {canReturnToRaioX ? (
              <Button variant="secondary" onClick={goBackToRaioX}>
                Voltar pro Raio-X
              </Button>
            ) : null}
            <SharingViewToggle onChange={setScope} />
            <CompetencePicker value={ym} onChange={(next) => void changeYm(next)} />
            <Button
              variant="secondary"
              disabled={boletoBusy || !canEdit || monthClosed}
              onClick={() => setScanSheetOpen(true)}
            >
              {boletoBusy ? 'Lendo foto…' : 'Enviar Foto'}
            </Button>
            <span className={styles.budgetHeaderPair}>
              <Button variant="secondary" disabled={copy.busy || !canEdit} onClick={() => void copyPrevious()}>
                Copiar mês anterior
              </Button>
              <Button
                variant="secondary"
                disabled={monthClosed}
                onClick={() => navigate(`/mes?competenceYm=${encodeURIComponent(ym)}`)}
              >
                Fechar mês
              </Button>
            </span>
          </>
        }
      />
      <ReceiptReadingOverlay
        open={boletoBusy}
        purpose={readingPurpose}
        rerouted={readingRerouted}
        message={
          readingRerouted ? (
            <>
              Com valor pago: isso é um <WordLancamento />, não um <WordOrcamento />. Abrindo para
              escolher conta e categoria…
            </>
          ) : (
            <>
              Identificando se é boleto (<WordOrcamento />) ou cupom (<WordLancamento />).
            </>
          )
        }
      />
      <ErrorText
        message={
          boletoError ??
          budget.error ??
          copy.error ??
          categories.error ??
          yearData.error ??
          projects.error ??
          monthStatus.error
        }
      />
      <ScanPurposeSheet
        open={scanSheetOpen}
        includeCupom
        onClose={() => setScanSheetOpen(false)}
        onChoose={onScanPurpose}
      />
      <ReceiptClassifyDialog
        open={boletoClassifyOpen}
        intake={boletoIntake}
        rerouteHint={boletoRerouteHint}
        onClose={() => {
          setBoletoClassifyOpen(false)
          setBoletoRerouteHint(null)
        }}
        onClassified={(intake) => {
          setBoletoClassifyOpen(false)
          setBoletoRerouteHint(null)
          void finishBoleto(intake).catch((error: unknown) => {
            setBoletoError(error instanceof Error ? error.message : 'Falha ao gravar o boleto.')
          })
        }}
      />
      {data && !canEdit ? (
        <p className={styles.muted}>Somente o responsável pelo orçamento familiar pode editar o previsto.</p>
      ) : null}
      {budget.loading && !data ? <Loading /> : null}
      {data ? (
        <BudgetTreeEditor
          ym={ym}
          scope={scope}
          canEdit={canEdit}
          budget={data}
          categories={categories.data ?? []}
          categoriesLoading={categories.loading && !categories.data}
          projects={projects.data ?? []}
          year={year}
          yearData={yearData.data}
          focusCategoryId={focusCategoryId}
          onReturnToRaioX={canReturnToRaioX ? goBackToRaioX : undefined}
          onSaved={() => {
            void Promise.all([budget.reload(), yearData.reload(), projects.reload()])
          }}
        />
      ) : null}
    </div>
  )
}
