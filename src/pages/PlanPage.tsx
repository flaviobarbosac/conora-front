import { planApi, type PlanKind, type SubscriptionStatus } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { formatDate, formatMoney } from '../lib/format'
import styles from './page.module.css'

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  Active: 'Ativo',
  Expired: 'Expirado',
  ReadOnly: 'Somente leitura',
}

const PLANS: ReadonlyArray<{ kind: PlanKind; title: string; price: number; text: string }> = [
  { kind: 'Monthly1490', title: 'Mensal', price: 14.9, text: 'Cobrança todo mês' },
  { kind: 'Yearly14990', title: 'Anual', price: 149.9, text: 'Pague uma vez por ano' },
]

export function PlanPage() {
  const plan = useLoad(() => planApi.get(), [])
  const subscribe = useAction()
  const data = plan.data

  async function choose(kind: PlanKind) {
    if (await subscribe.run(() => planApi.subscribe(kind))) {
      plan.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Plano" />
      <ErrorText message={plan.error ?? subscribe.error} />
      {plan.loading && !data ? <Loading /> : null}
      {data ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Situação</h2>
            <Badge tone={data.status === 'Active' ? 'ok' : 'warning'}>{STATUS_LABEL[data.status]}</Badge>
          </div>
          <p>
            {data.plan
              ? `Plano ${data.plan === 'Monthly1490' ? 'mensal' : 'anual'}${data.price !== null ? ` · ${formatMoney(data.price)}` : ''}`
              : 'Você ainda não assinou — período de teste com todos os recursos.'}
          </p>
          {data.expiresAt ? <p className={styles.muted}>Válido até {formatDate(data.expiresAt)}</p> : null}
          {data.isReadOnly ? (
            <p className={styles.error}>Sua conta está em modo somente leitura. Assine para voltar a lançar.</p>
          ) : null}
        </section>
      ) : null}
      <div className={styles.grid2}>
        {PLANS.map((option) => (
          <section key={option.kind} className={styles.section}>
            <h2 className={styles.sectionTitle}>{option.title}</h2>
            <strong className={styles.sectionTitle}>{formatMoney(option.price)}</strong>
            <p className={styles.muted}>{option.text}</p>
            <Button
              variant={data?.plan === option.kind ? 'secondary' : 'primary'}
              disabled={subscribe.busy}
              onClick={() => void choose(option.kind)}
            >
              {data?.plan === option.kind ? 'Renovar' : 'Assinar'}
            </Button>
          </section>
        ))}
      </div>
    </div>
  )
}
