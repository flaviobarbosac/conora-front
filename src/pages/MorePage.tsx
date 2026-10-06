import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, exportApi, lgpdApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { currentCompetence, downloadBlob, formatMoney } from '../lib/format'
import styles from './page.module.css'

const TILES: ReadonlyArray<{ to: string; title: string; text: string }> = [
  { to: '/diagnostico', title: 'Diagnóstico', text: 'Fontes de renda e valor líquido' },
  { to: '/categorias', title: 'Categorias', text: 'Do sistema e personalizadas' },
  { to: '/patrimonio', title: 'Patrimônio', text: 'Bens, dívidas e reserva' },
  { to: '/membros', title: 'Membros', text: 'Quem divide as finanças' },
  { to: '/plano', title: 'Plano', text: 'Assinatura e situação' },
  { to: '/ajuda', title: 'Ajuda', text: 'Glossário e 7 passos' },
  { to: '/ia', title: 'Perguntar à IA', text: 'Dúvidas sobre seu mês' },
  { to: '/whatsapp', title: 'WhatsApp', text: 'Vincular número e rascunhos' },
  { to: '/importar', title: 'Importar extrato', text: 'CSV ou OFX' },
  { to: '/mes', title: 'Fechar mês', text: 'Fechar ou reabrir competência' },
]

export function MorePage() {
  const { logout } = useAuth()
  const [ym, setYm] = useState(currentCompetence)
  const report = useLoad(() => dashboardApi.monthlyReport(ym), [ym])
  const files = useAction()
  const privacy = useAction()

  async function download(load: () => Promise<{ blob: Blob; fileName: string }>) {
    await files.run(async () => {
      const { blob, fileName } = await load()
      downloadBlob(blob, fileName)
    })
  }

  async function exportData() {
    await privacy.run(async () => {
      const data = await lgpdApi.exportData()
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'conora-meus-dados.json')
    })
  }

  async function deleteAccount() {
    const confirmed = window.confirm('Excluir sua conta e todos os seus dados? Esta ação não pode ser desfeita.')
    if (confirmed && (await privacy.run(() => lgpdApi.deleteAccount()))) {
      await logout()
    }
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
                <span>Receitas</span>
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
            {data.byCategory.length > 0 ? (
              <ul className={styles.list}>
                {data.byCategory.map((item) => (
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

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Privacidade (LGPD)</h2>
        <p className={styles.muted}>Baixe uma cópia dos seus dados ou exclua sua conta definitivamente.</p>
        <ErrorText message={privacy.error} />
        <div className={styles.actions}>
          <Button variant="secondary" disabled={privacy.busy} onClick={() => void exportData()}>
            Exportar meus dados
          </Button>
          <Button variant="secondary" disabled={privacy.busy} onClick={() => void deleteAccount()}>
            Excluir minha conta
          </Button>
        </div>
      </section>
    </div>
  )
}
