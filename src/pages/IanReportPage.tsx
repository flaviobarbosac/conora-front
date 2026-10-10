import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { aiApi, type IanReportQuery } from '../api/finance'
import { IanAnalyzeDialog } from '../components/IanAnalyzeDialog'
import { IanChart, LegendModeToggle, type LegendMode } from '../components/charts/IanCharts'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { selectionFromReportQuery } from '../lib/ianReport'
import reportStyles from './IanReportPage.module.css'
import styles from './page.module.css'

function queryFromSearch(params: URLSearchParams): IanReportQuery | null {
  const kind = params.get('kind')
  if (!kind) return null
  return {
    kind,
    competenceYm: params.get('competenceYm'),
    fromYm: params.get('fromYm'),
    toYm: params.get('toYm'),
    subject: params.get('subject'),
    matchKind: params.get('matchKind'),
    matchId: params.get('matchId'),
    focus: params.get('focus'),
    categoryIds: params.get('categoryIds'),
    chartKind: params.get('chartKind'),
    insight: params.get('insight'),
  }
}

export function IanReportPage() {
  const [params] = useSearchParams()
  const query = useMemo(() => queryFromSearch(params), [params])
  const [legendMode, setLegendMode] = useState<LegendMode>('description')
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const report = useLoad(
    () => (query ? aiApi.ianReport(query) : Promise.reject(new Error('Relatório inválido.'))),
    [params.toString()],
  )

  const analyzeSelection = query ? selectionFromReportQuery(query) : null

  if (!query) {
    return (
      <div className={styles.page}>
        <PageHeader secondary title="Relatório do Ian" />
        <p className={styles.muted}>
          Peça um relatório no chat do Ian.{' '}
          <Link to="/ia">Abrir o Ian</Link>
        </p>
      </div>
    )
  }

  const data = report.data
  const table = data?.table
  const insight = data?.insight ?? query.insight

  return (
    <div className={`${styles.page} ${reportStyles.printRoot}`}>
      <PageHeader secondary title={data?.title ?? 'Relatório do Ian'} />
      <div className={`${reportStyles.toolbar} ${reportStyles.noPrint}`}>
        <LegendModeToggle value={legendMode} onChange={setLegendMode} />
        <div className={reportStyles.toolbarActions}>
          {analyzeSelection ? (
            <Button type="button" variant="secondary" onClick={() => setAnalyzeOpen(true)}>
              Analisar de novo
            </Button>
          ) : null}
          <Button type="button" onClick={() => window.print()} disabled={!data}>
            Exportar PDF
          </Button>
        </div>
      </div>
      <ErrorText message={report.error} />
      {report.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          {insight ? <p className={reportStyles.insight}>{insight}</p> : null}
          {!data.found ? (
            <p className={styles.muted}>Não encontrei valores para este pedido no período.</p>
          ) : null}
          {table && table.rows.length > 0 ? (
            <div className={reportStyles.tableWrap}>
              <table className={reportStyles.table}>
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column.key} scope="col">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.key} className={row.key === 'total' ? reportStyles.totalRow : undefined}>
                      {row.cells.map((cell, index) => (
                        <td key={`${row.key}-${index}`} className={index === 1 ? reportStyles.amountCell : undefined}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {data.chartKind !== 'none' && data.points.length > 0 ? (
            <section className={reportStyles.chartSection} aria-label="Gráfico do relatório">
              <h2 className={reportStyles.chartTitle}>
                {data.chartKind === 'line' ? 'Evolução' : data.chartKind === 'pie' ? 'Composição' : 'Gráfico'}
              </h2>
              <IanChart chartKind={data.chartKind} points={data.points} legendMode={legendMode} />
            </section>
          ) : null}
        </>
      ) : null}

      <IanAnalyzeDialog
        open={analyzeOpen}
        onClose={() => setAnalyzeOpen(false)}
        initial={analyzeSelection}
      />
    </div>
  )
}
