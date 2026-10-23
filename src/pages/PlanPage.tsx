import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { lgpdApi, planApi, type Plan, type PlanOffer, type PlanTier } from '../api/finance'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { confirmDestructive } from '../lib/confirm'
import { downloadBlob, formatDate, formatMoney } from '../lib/format'
import {
  markGraceScreenShown,
  PLAN_CHANGED,
  READ_ONLY_UNTIL_DAY,
  TIER_INFO,
  tierOfKind,
  TRIAL_DAYS,
} from '../lib/planAccess'
import { isNativeApp } from '../lib/platform'
import { showSaveToast } from '../lib/saveToast'
import styles from './PlanPage.module.css'

const TIERS: ReadonlyArray<PlanTier> = ['Individual', 'Family', 'FamilyPlus']
const RECOMMENDED: PlanTier = 'FamilyPlus'

const INCLUDED = [
  'Lançamentos de receitas e despesas',
  'Raio X da vida financeira',
  'Orçamento mensal e fechamento do mês',
  'Contas e cartões de crédito',
  'Projetos de vida e patrimônio',
  'Ian, seu assistente com IA',
  'Recibos por foto e pelo WhatsApp',
  'Exportação dos seus dados',
]

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Sou aluno do treinamento. Preciso pagar agora?',
    a: `Não. Alunos do treinamento financeiro do Leomar Campos têm ${TRIAL_DAYS} dias de acesso completo e gratuito ao Conora. Você só escolhe um plano quando quiser continuar depois desse período.`,
  },
  {
    q: `O que acontece depois dos ${TRIAL_DAYS} dias se eu não assinar?`,
    a: `A conta fica em modo somente leitura: você consulta e exporta seus dados até o dia ${READ_ONLY_UNTIL_DAY}. A partir do dia ${READ_ONLY_UNTIL_DAY + 1} a conta é bloqueada e o acesso aos dados passa a ser só por chamado no suporte.`,
  },
  {
    q: 'Meus lançamentos ficam guardados?',
    a: 'Sim. Ao assinar, tudo volta exatamente como você deixou, sem perder nenhum lançamento.',
  },
  {
    q: 'Qual a diferença entre os planos?',
    a: 'Todos têm todas as funcionalidades do Conora. O que muda é o grupo: o Individual é só para você, o Duo é para duas pessoas e o Family é para três ou mais, cada uma com o próprio acesso.',
  },
  {
    q: 'Como funciona o plano anual?',
    a: 'Você paga 10 mensalidades e usa por 12 meses: são 2 meses grátis em relação ao plano mensal.',
  },
]

function offerFor(offers: PlanOffer[], tier: PlanTier, yearly: boolean): PlanOffer | undefined {
  return offers.find((offer) => offer.tier === tier && offer.yearly === yearly)
}

function currentTier(plan: Plan): PlanTier | null {
  if (plan.phase !== 'Subscribed' || plan.coveredByFamily || !plan.plan) return null
  return tierOfKind(plan.plan)
}

export function PlanPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = (searchParams.get('convite') ?? '').trim()
  const plan = useLoad(() => planApi.get(), [])
  const access = usePlanAccess()
  const subscribe = useAction()
  const exporter = useAction()
  const data = plan.data
  // Digital plans are sold outside the store. Native apps (Android and iOS) must not show prices or a subscribe action.
  const hideCheckout = isNativeApp()
  const [cycleChoice, setYearly] = useState<boolean | null>(null)
  // Default to yearly (best value); subscribers start on their current cycle.
  const yearly = cycleChoice ?? (data?.phase === 'Subscribed' && data.plan ? data.yearly : true)

  useEffect(() => {
    if (data?.phase === 'Grace') markGraceScreenShown()
  }, [data?.phase])

  useEffect(() => {
    if (!inviteToken) return
    // After the store step, continue to the invite accept screen with the same token.
    if (data?.phase === 'Subscribed' || data?.phase === 'Trial') {
      navigate(`/grupo/convite/${encodeURIComponent(inviteToken)}`, { replace: true })
    }
  }, [inviteToken, data?.phase, navigate])

  async function choose(offer: PlanOffer) {
    const info = TIER_INFO[offer.tier]
    if (import.meta.env.PROD || hideCheckout) {
      subscribe.setError(
        'A assinatura só muda quando a Google Play ou a App Store confirmar a compra. Abra o plano na loja do celular.',
      )
      return
    }
    const cycle = offer.yearly ? 'ano' : 'mês'
    const ok = await confirmDestructive(
      `Assinar o plano ${info.title} ${offer.yearly ? 'anual' : 'mensal'} por ${formatMoney(offer.price)}/${cycle}?`,
      { title: 'Confirmar assinatura', confirmLabel: 'Assinar', danger: false },
    )
    if (!ok) return
    // Dev stub: simulates the store purchase token the webhook will send in production.
    const stubToken = `dev-store-${offer.kind}-${Date.now()}`
    if (await subscribe.run(() => planApi.subscribe(offer.kind, stubToken))) {
      showSaveToast(`Plano ${info.title} ativado (loja simulada em desenvolvimento).`)
      plan.reload()
      access.reload()
      window.dispatchEvent(new Event(PLAN_CHANGED))
    }
  }

  async function exportData() {
    await exporter.run(async () => {
      const exported = await lgpdApi.exportData()
      downloadBlob(new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }), 'conora-meus-dados.json')
    })
  }

  return (
    <div className={styles.page}>
      {inviteToken ? (
        <p className={styles.intro} role="status">
          Você foi convidado para um grupo. Confirme o plano na loja; em seguida o Conora abre o aceite do convite.
          Se você já paga Individual sozinho, o aceite cancela essa cobrança.
        </p>
      ) : null}
      <header className={styles.intro}>
        {hideCheckout ? (
          <>
            <span className={styles.eyebrow}>Sua conta</span>
            <h1>Situação do plano</h1>
            <p>O acesso contratado fora da loja continua valendo aqui. Este app não vende assinatura.</p>
          </>
        ) : (
          <>
            <span className={styles.eyebrow}>Planos Conora</span>
            <h1>Sua vida financeira organizada, com quem você ama</h1>
            <p>Todas as funcionalidades em todos os planos. Escolha só quantas pessoas vão usar com você.</p>
          </>
        )}
      </header>

      <ErrorText message={plan.error ?? subscribe.error ?? exporter.error} />
      {plan.loading && !data ? <Loading /> : null}

      {data ? (
        <StatusHero plan={data} exporting={exporter.busy} onExport={() => void exportData()} hideCheckout={hideCheckout} />
      ) : null}

      {data && !hideCheckout ? (
        <>
          <div className={styles.cycleRow}>
            <div className={styles.cycle} role="radiogroup" aria-label="Forma de cobrança">
              <button
                type="button"
                role="radio"
                aria-checked={!yearly}
                className={!yearly ? styles.cycleActive : undefined}
                onClick={() => setYearly(false)}
              >
                Mensal
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={yearly}
                className={yearly ? styles.cycleActive : undefined}
                onClick={() => setYearly(true)}
              >
                Anual
                <span className={styles.freeBadge}>2 meses grátis</span>
              </button>
            </div>
          </div>

          <div className={styles.cards}>
            {TIERS.map((tier) => {
              const offer = offerFor(data.offers, tier, yearly)
              const monthly = offerFor(data.offers, tier, false)
              if (!offer || !monthly) return null
              const info = TIER_INFO[tier]
              const isCurrent = currentTier(data) === tier && data.yearly === yearly
              const recommended = tier === RECOMMENDED
              const savings = monthly.price * 12 - offer.price
              return (
                <section
                  key={tier}
                  className={`${styles.card} ${recommended ? styles.cardRecommended : ''}`}
                  aria-label={`Plano ${info.title}`}
                >
                  {recommended ? <span className={styles.ribbon}>Recomendado</span> : null}
                  <div className={styles.cardHead}>
                    <h2>{info.title}</h2>
                    <p>{info.tagline}</p>
                  </div>
                  <div className={styles.price}>
                    <strong>{formatMoney(offer.monthlyEquivalent)}</strong>
                    <span>/mês</span>
                  </div>
                  <p className={styles.priceNote}>
                    {offer.yearly ? (
                      <>
                        {formatMoney(offer.price)} por ano ·{' '}
                        <span className={styles.save}>economize {formatMoney(savings)}</span>
                      </>
                    ) : (
                      'Cobrança mensal'
                    )}
                  </p>
                  <p className={styles.people}>{info.people}</p>
                  <ul className={styles.features}>
                    <li className={styles.yes}>Todas as funcionalidades do Conora</li>
                    {info.family ? (
                      <li className={styles.yes}>{info.family}</li>
                    ) : (
                      <li className={styles.no}>Grupo familiar não incluso</li>
                    )}
                    {info.family ? <li className={styles.yes}>Cada pessoa com o próprio login</li> : null}
                  </ul>
                  <Button
                    className={styles.cta}
                    variant={recommended && !isCurrent ? 'primary' : 'secondary'}
                    disabled={subscribe.busy}
                    onClick={() => void choose(offer)}
                  >
                    {isCurrent ? 'Renovar plano atual' : `Assinar ${info.title}`}
                  </Button>
                  {isCurrent ? <p className={styles.currentNote}>Seu plano atual</p> : null}
                </section>
              )
            })}
          </div>
        </>
      ) : null}

      {hideCheckout ? null : (
      <section className={styles.included}>
        <h2>Incluído em todos os planos</h2>
        <ul>
          {INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      )}

      {hideCheckout ? null : (
        <section className={styles.faq}>
          <h2>Dúvidas frequentes</h2>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
          <p className={styles.support}>
            Ainda com dúvida? <Link to="/ajuda">Fale com o suporte</Link>.
          </p>
        </section>
      )}
    </div>
  )
}

type HeroProps = { plan: Plan; exporting: boolean; onExport: () => void; hideCheckout: boolean }

function StatusHero({ plan, exporting, onExport, hideCheckout }: HeroProps) {
  if (plan.phase === 'Subscribed') {
    const tier = plan.plan ? tierOfKind(plan.plan) : 'Individual'
    return (
      <section className={`${styles.hero} ${styles.heroOk}`}>
        <strong>
          {plan.coveredByFamily
            ? 'Você está no plano familiar do responsável pelo grupo'
            : `Plano ${TIER_INFO[tier].title} ${plan.yearly ? 'anual' : 'mensal'} ativo`}
        </strong>
        {plan.expiresAt ? <span>Válido até {formatDate(plan.expiresAt)}.</span> : null}
      </section>
    )
  }

  if (plan.phase === 'Expired') {
    return (
      <section className={`${styles.hero} ${styles.heroWarn}`}>
        <strong>Seu plano venceu</strong>
        <span>
          O Conora está em modo somente leitura.
          {hideCheckout ? ' Seus dados continuam guardados.' : ' Renove para voltar a lançar — seus dados continuam guardados.'}
        </span>
      </section>
    )
  }

  if (plan.phase === 'Blocked') {
    return (
      <section className={`${styles.hero} ${styles.heroDanger}`}>
        <strong>Sua conta está bloqueada</strong>
        <span>
          O acesso gratuito terminou em {formatDate(plan.trialEndsAt)} e o prazo de consulta em{' '}
          {formatDate(plan.blockAt)}.
          {hideCheckout
            ? ' Seus dados continuam guardados.'
            : ' Assine um plano para reativar na hora: seus dados continuam guardados.'}
        </span>
        <span>
          Precisa só dos seus dados? <Link to="/ajuda">Abra um chamado no suporte</Link>.
        </span>
        <Timeline plan={plan} />
      </section>
    )
  }

  if (plan.phase === 'Grace') {
    return (
      <section className={`${styles.hero} ${styles.heroWarn}`}>
        <strong>Seu acesso gratuito de {TRIAL_DAYS} dias terminou</strong>
        <span>
          Agora o Conora está em modo somente leitura. Até {formatDate(plan.blockAt)} ({plan.daysLeft}{' '}
          {plan.daysLeft === 1 ? 'dia' : 'dias'}) você pode consultar e exportar seus dados. Depois disso, a conta é
          bloqueada.
        </span>
        <div className={styles.heroActions}>
          <Button variant="secondary" disabled={exporting} onClick={onExport}>
            Exportar meus dados
          </Button>
        </div>
        <Timeline plan={plan} />
      </section>
    )
  }

  return (
    <section className={styles.hero}>
      <strong>
        Você é aluno: {plan.daysLeft} {plan.daysLeft === 1 ? 'dia' : 'dias'} de acesso completo e gratuito
      </strong>
      <span>
        Cortesia do treinamento financeiro do Leomar Campos, até {formatDate(plan.trialEndsAt)}.
        {hideCheckout ? '' : ' Assine antes e continue sem nenhuma interrupção.'}
      </span>
      <Timeline plan={plan} />
    </section>
  )
}

function Timeline({ plan }: { plan: Plan }) {
  const steps = [
    { key: 'Trial', day: 'Dia 1', title: 'Acesso completo', text: 'Grátis para alunos' },
    { key: 'Grace', day: `Dia ${TRIAL_DAYS}`, title: 'Somente leitura', text: 'Consulta e exportação' },
    { key: 'Blocked', day: `Dia ${READ_ONLY_UNTIL_DAY + 1}`, title: 'Conta bloqueada', text: 'Dados só via suporte' },
  ] as const
  const progress =
    plan.phase === 'Trial' ? Math.min(100, Math.max(4, ((TRIAL_DAYS - plan.daysLeft) / TRIAL_DAYS) * 100)) : 100
  return (
    <div className={styles.timeline}>
      {plan.phase === 'Trial' ? (
        <div
          className={styles.track}
          role="progressbar"
          aria-label="Dias de acesso gratuito usados"
          aria-valuemin={0}
          aria-valuemax={TRIAL_DAYS}
          aria-valuenow={TRIAL_DAYS - plan.daysLeft}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <ol>
        {steps.map((step) => (
          <li key={step.key} className={plan.phase === step.key ? styles.stepActive : undefined}>
            <small>{step.day}</small>
            <strong>{step.title}</strong>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
