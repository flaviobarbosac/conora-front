import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, exportApi } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { currentCompetence, downloadBlob, formatMoney } from '../lib/format'
import styles from './pageStyles'

const TILES: ReadonlyArray<{ to: string; title: string; text: string }> = [
  { to: '/diagnostico', title: 'Diagnóstico', text: 'Fontes de renda e valor líquido' },
  { to: '/jornada', title: 'Jornada Raio X', text: 'Cadastros, marcos e maturidade do Ian' },
  { to: '/marcos', title: 'Marcos', text: 'Conquistas do método' },
  { to: '/retrospectiva', title: 'Retrospectiva', text: 'Resumo do ano' },
  { to: '/plano', title: 'Plano', text: 'Assinatura e situação' },
  { to: '/operacao', title: 'Operação', text: 'Auditoria e saúde da API' },
  { to: '/ajuda', title: 'Central de ajuda', text: 'Módulos, campos e glossário' },
  { to: '/importar', title: 'Importar extrato', text: 'CSV ou OFX' },
]

export function MorePage() {
  const [ym, setYm] = useState(currentCompetence)
  const report = useLoad(() => dashboardApi.monthlyReport(ym), [ym])
  const files = useAction()

  async function download(load: () => Promise<{ blob: Blob; fileName: string }>) {
    await files.run(async () => {
      const { blob, fileName } = await load()
      downloadBlob(blob, fileName)
    })
  }

  const data = report.data

  return (
    <div className={styles.page}>
      <PageHeader kicker="Mais" title="Relatórios" actions={<CompetencePicker value={ym} onChange={setYm} />} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Resumo do mês</h2>
        <ErrorText message={report.error} />
        {report.loading && !data ? <Loading /> : null}
        {data ? (
          <>
            <div className={styles.grid3}>
              <div className={styles.stat}>
                <span>Renda</span>
                <strong>{formatMoney(data.summary.incomeTotal)}</strong>
              </div>
              <div className={styles.stat}>
                <span>Despesas</span>
                <strong>{formatMoney(data.summary.expenseTotal)}</strong>
              </div>
              <div className={styles.stat}>
                <span>Resultado</span>
                <strong className={data.summary.result < 0 ? styles.negative : styles.positive}>
                  {formatMoney(data.summary.result)}
                </strong>
              </div>
            </div>
            <p className={styles.muted}>
              Em {data.previousYm}: despesas de {formatMoney(data.previousExpenseTotal)} (variação{' '}
              {formatMoney(data.expenseDelta)}) e resultado de {formatMoney(data.previousResult)}.
            </p>
            {data.byAccount.length > 0 ? (
              <ul className={styles.list}>
                {data.byAccount.map((item) => (
                  <li key={item.categoryId ?? item.categoryName} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>{item.categoryName}</strong>
                    </span>
                    <span className={styles.amount}>{formatMoney(item.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        <ErrorText message={files.error} />
        <div className={styles.actions}>
          <Button variant="secondary" disabled={files.busy} onClick={() => void download(() => exportApi.entries(ym))}>
            Exportar lançamentos (CSV)
          </Button>
          <Button variant="secondary" disabled={files.busy} onClick={() => void download(() => exportApi.summary(ym))}>
            Exportar resumo
          </Button>
        </div>
      </section>

      <nav className={styles.tiles} aria-label="Mais opções">
        {TILES.map((tile) => (
          <Link key={tile.to} to={tile.to} className={styles.tile}>
            <strong>{tile.title}</strong>
            <span>{tile.text}</span>
          </Link>
        ))}
      </nav>

    </div>
  )
}
