import { useEffect, useRef, useState } from 'react'
import type { Product } from '@capgo/native-purchases'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { familyApi, lgpdApi, planApi, type Plan, type PlanOffer, type PlanTier } from '../api/finance'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { hasFullAccess, planCtaLabel } from '../lib/freeTier'
import { formatDate, formatMoney } from '../lib/format'
import {
  markGraceScreenShown,
  PLAN_CHANGED,
  TIER_INFO,
  tierOfKind,
  TRIAL_DAYS,
} from '../lib/planAccess'
import { ConoraCelebrate } from '../components/ConoraCelebrate'
import { purchasePlan } from '../lib/planCheckout'
import { isAndroidApp, isNativeApp } from '../lib/platform'
import { showSaveToast } from '../lib/saveToast'
import {
  openStoreSubscriptions,
  restoreStorePurchases,
  STORE_PRODUCT_IDS,
  storeCheckoutAvailable,
  storeName,
  storePriceLabel,
  storeProducts,
} from '../lib/storeBilling'
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
    a: `Não. Alunos do treinamento financeiro do Leomar Campos têm ${TRIAL_DAYS} dias de acesso completo e gratuito ao Conora. A cobrança só entra depois desse período; até lá nenhuma tela existente fica trancada.`,
  },
  {
    q: `O que acontece depois dos ${TRIAL_DAYS} dias se eu não assinar?`,
    a: 'Você continua no Conora grátis: lança em aluguel, luz, água e escola, com uma conta. Patrimônio, membros, projeto de vida e marcos ficam só para consulta. Assine para liberar o acesso completo.',
  },
  {
    q: 'Meus lançamentos ficam guardados?',
    a: 'Sim. Ao assinar, tudo volta exatamente como você deixou, sem perder nenhum lançamento.',
  },
  {
    q: 'Qual a diferença entre os planos?',
    a: 'Todos têm todas as funcionalidades do Conora. O que muda é o grupo: o Individual é só para você, o Duo é para duas pessoas e o Família é para até cinco pessoas, cada uma com o próprio acesso.',
  },
  {
    q: 'Como cancelo?',
    a: 'Nas assinaturas da sua conta da loja (App Store ou Google Play), até 24 horas antes da renovação. O acesso segue até o fim do período já pago. Não há multa de cancelamento.',
  },
  {
    q: 'Troquei de celular. Como recupero a assinatura?',
    a: 'Entre com o mesmo login do Conora e toque em "Restaurar compras" nesta tela, usando a mesma conta da loja em que você assinou.',
  },
  {
    q: 'Como funciona o plano anual?',
    a: 'Você paga uma vez e usa por 12 meses, com 16% de desconto em relação a 12 mensalidades: quase 2 meses grátis.',
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
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const inviteToken = (searchParams.get('convite') ?? '').trim()
  const plan = useLoad(() => planApi.get(), [])
  const course = useLoad(() => planApi.courseCheckout(), [])
  const profile = useLoad(() => familyApi.profile(), [])
  const access = usePlanAccess()
  const subscribe = useAction()
  const exporter = useAction()
  const restorer = useAction()
  const data = plan.data
  // Native apps sell plans only through the store (App Store In-App Purchase / Google Play Billing).
  // The web shows the plans but sends the user to the app; local development keeps a stub checkout.
  const storeCheckout = storeCheckoutAvailable()
  const webPlans = !isNativeApp()
  const [storeHint, setStoreHint] = useState(false)
  const storeHintRef = useRef<HTMLElement>(null)
  const [products, setProducts] = useState<Record<string, Product>>({})
  const [cycleChoice, setYearly] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<PlanTier>(RECOMMENDED)
  const [celebrateOpen, setCelebrateOpen] = useState(
    () => Boolean((location.state as { celebrate?: boolean } | null)?.celebrate),
  )
  // Default to yearly (best value); subscribers start on their current cycle.
  const yearly = cycleChoice ?? (data?.phase === 'Subscribed' && data.plan ? data.yearly : true)

  useEffect(() => {
    if (data?.phase === 'Grace') markGraceScreenShown()
  }, [data?.phase])

  useEffect(() => {
    if (!(location.state as { celebrate?: boolean } | null)?.celebrate) return
    navigate(location.pathname + location.search, { replace: true, state: {} })
  }, [location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    if (!storeCheckout) return
    let active = true
    void storeProducts().then((found) => {
      if (active) setProducts(found)
    })
    return () => {
      active = false
    }
  }, [storeCheckout])

  function planChanged(message: string) {
    showSaveToast(message)
    plan.reload()
    access.reload()
    window.dispatchEvent(new Event(PLAN_CHANGED))
  }

  useEffect(() => {
    if (!inviteToken) return
    // After the store step, continue to the invite accept screen with the same token.
    if (data?.phase === 'Subscribed' || data?.phase === 'Trial') {
      navigate(`/grupo/convite/${encodeURIComponent(inviteToken)}`, { replace: true })
    }
  }, [inviteToken, data?.phase, navigate])

  function explainStore() {
    setStoreHint(true)
    queueMicrotask(() => storeHintRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  async function choose(offer: PlanOffer) {
    setSelected(offer.tier)
    if (!storeCheckout) {
      explainStore()
      return
    }
    if (!profile.data?.contractAcknowledgedAt) {
      navigate(`/plano/contrato?kind=${encodeURIComponent(offer.kind)}`)
      return
    }
    let message: string | null = null
    const ok = await subscribe.run(async () => {
      message = await purchasePlan(offer, products)
    })
    if (ok && message) {
      planChanged(message)
      setCelebrateOpen(true)
    }
  }

  async function restore() {
    let restored: Plan | null = null
    const ok = await restorer.run(async () => {
      restored = await restoreStorePurchases()
    })
    if (!ok) return
    if (restored) planChanged('Assinatura restaurada.')
    else restorer.setError(`Nenhuma assinatura ativa deste login foi encontrada na ${storeName()}.`)
  }

  async function exportData() {
    const ok = await exporter.run(() => lgpdApi.exportData())
    if (ok) {
      showSaveToast(
        'A exportação será agendada e estará disponível pra você daqui a 24 horas.',
        5000,
      )
    }
  }

  return (
    <div className={styles.page}>
      {celebrateOpen ? (
        <ConoraCelebrate
          title="Assinatura confirmada"
          message="Vivendo bem o presente, planejando um futuro melhor."
          showIan
          onClose={() => setCelebrateOpen(false)}
        />
      ) : null}
      {inviteToken ? (
        <p className={styles.intro} role="status">
          Você foi convidado para um grupo. Confirme o plano na loja; em seguida o Conora abre o aceite do convite.
          Se você já paga Individual sozinho, o aceite cancela essa cobrança.
        </p>
      ) : null}
      <header className={styles.intro}>
        <span className={styles.eyebrow}>Planos Conora</span>
        <h1>Sua vida financeira organizada, com quem você ama</h1>
        <p>Todas as funcionalidades em todos os planos. Escolha só quantas pessoas vão usar com você.</p>
      </header>

      <ErrorText message={plan.error ?? subscribe.error ?? restorer.error ?? exporter.error} />
      {plan.loading && !data ? <Loading /> : null}

      {data ? (
        <StatusHero plan={data} exporting={exporter.busy} onExport={() => void exportData()} />
      ) : null}

      {course.data?.checkoutUrl ? (
        <a className={styles.hotmart} href={course.data.checkoutUrl} target="_blank" rel="noreferrer">
          Comprar o treinamento na Hotmart
        </a>
      ) : null}

      {data ? (
        <>
          {!storeCheckout ? (
            <section className={styles.payNotice} role="note">
              <strong>A assinatura é feita no app</strong>
              <span>
                Abra o Conora no celular e pague pela App Store ou pelo Google Play, com este mesmo login. O plano
                passa a valer aqui no navegador.
              </span>
            </section>
          ) : null}

          {storeHint ? (
            <section ref={storeHintRef} className={styles.storeHint} role="status">
              <strong>Seu plano fica no aplicativo</strong>
              <span>
                Assinar, renovar ou cancelar a gente faz pelo app do Conora. Baixe na App Store ou no Google Play,
                entre com este mesmo login e cuide do seu plano por lá.
              </span>
            </section>
          ) : null}

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
                <span className={styles.freeBadge}>16% de desconto</span>
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
              const productId = STORE_PRODUCT_IDS[offer.kind]
              const product = productId ? products[productId] : undefined
              const storePrice = product ? storePriceLabel(product, offer.price, formatMoney) : formatMoney(offer.price)
              const usedStoreLabel = Boolean(product?.priceString) && storePrice === product?.priceString
              // Google Play cannot swap separate subscription products in place: cancel first, then buy the new one.
              const androidSwitch = isAndroidApp() && currentTier(data) !== null && !isCurrent
              return (
                <section
                  key={tier}
                  data-tier={tier}
                  className={[styles.card, recommended ? styles.cardRecommended : '', selected === tier ? styles.cardSelected : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`Plano ${info.title}`}
                  onClick={() => setSelected(tier)}
                >
                  {recommended ? <span className={styles.ribbon}>Recomendado</span> : null}
                  <div className={styles.cardHead}>
                    <h2>{info.title}</h2>
                    <p>{info.tagline}</p>
                  </div>
                  {/* The billed amount is the most prominent price (App Store guideline 3.1.2). */}
                  <div className={styles.price}>
                    <strong>{storePrice}</strong>
                    <span>/{offer.yearly ? 'ano' : 'mês'}</span>
                  </div>
                  <p className={styles.priceNote}>
                    {offer.yearly ? (
                      <>
                        Cobrança anual{usedStoreLabel ? ` na ${storeName()}` : ''} · equivale a{' '}
                        {formatMoney(offer.monthlyEquivalent)}/mês ·{' '}
                        <span className={styles.save}>economize {formatMoney(savings)}</span>
                      </>
                    ) : (
                      `Cobrança mensal${usedStoreLabel ? ` na ${storeName()}` : ''}`
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
                  <p className={styles.currentSlot}>{isCurrent ? 'Seu plano atual' : '\u00a0'}</p>
                  <Button
                    className={styles.cta}
                    variant="secondary"
                    disabled={subscribe.busy || (storeCheckout && (isCurrent || androidSwitch))}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelected(tier)
                      if (webPlans) {
                        explainStore()
                        return
                      }
                      void choose(offer)
                    }}
                  >
                    {webPlans
                      ? isCurrent
                        ? 'Renovar plano atual'
                        : `Assinar ${info.title}`
                      : isCurrent
                        ? 'Plano atual'
                        : `Assinar ${info.title}`}
                  </Button>
                  {androidSwitch ? (
                    <p className={styles.currentNote}>
                      Para trocar de plano, cancele o atual em “Gerenciar assinatura” e assine este depois.
                    </p>
                  ) : null}
                </section>
              )
            })}
          </div>

          {storeCheckout ? (
            <section className={styles.included} aria-label="Assinatura na loja">
              <p>
                Assinatura com renovação automática pela {storeName()}. O valor é cobrado na sua conta da loja ao
                confirmar a compra e renova sozinho ao fim de cada período (mensal ou anual), a menos que você cancele
                até 24 horas antes da renovação nas assinaturas da sua conta da loja.
              </p>
              <p>
                <a href="https://conora.com.br/termos" target="_blank" rel="noreferrer">
                  Termos de Uso
                </a>{' '}
                ·{' '}
                <a href="https://conora.com.br/privacidade" target="_blank" rel="noreferrer">
                  Política de Privacidade
                </a>
              </p>
              <div className={styles.heroActions}>
                <Button variant="secondary" disabled={restorer.busy} onClick={() => void restore()}>
                  Restaurar compras
                </Button>
                <Button variant="secondary" onClick={() => void openStoreSubscriptions()}>
                  Gerenciar assinatura
                </Button>
              </div>
            </section>
          ) : null}

          <p className={styles.support}>
            <Link to="/plano/contrato">Ver contrato, cancelamento e LGPD</Link>
          </p>
        </>
      ) : null}

      <section className={styles.included}>
        <h2>Incluído em todos os planos</h2>
        <ul>
          {INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.faq}>
        <h2>Dúvidas frequentes</h2>
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
        <p className={styles.support}>
          Ainda com dúvida? <Link to="/ajuda">Veja na central de ajuda</Link>.
        </p>
      </section>
    </div>
  )
}

type HeroProps = { plan: Plan; exporting: boolean; onExport: () => void }

function StatusHero({ plan, exporting, onExport }: HeroProps) {
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

  if (!hasFullAccess(plan) && (plan.phase === 'Expired' || plan.phase === 'Grace' || plan.phase === 'Blocked')) {
    const renew = plan.everSubscribed
    return (
      <section className={`${styles.hero} ${styles.heroWarn}`}>
        <strong>{renew ? 'Seu plano venceu' : 'Você está no plano gratuito'}</strong>
        <span>
          {renew
            ? 'Você continua no Conora grátis, com aluguel, luz, água e escola. Renove para voltar ao acesso completo.'
            : 'Assine e libere o Conora completo.'}
        </span>
        <div className={styles.heroActions}>
          <Button variant="secondary" disabled={exporting} onClick={onExport}>
            Exportar meus dados
          </Button>
        </div>
        <span>{planCtaLabel(plan)} abaixo.</span>
      </section>
    )
  }

  return (
    <section className={styles.hero}>
      <strong>
        {plan.isTrainingStudent
          ? `Você é aluno: ${plan.daysLeft} ${plan.daysLeft === 1 ? 'dia' : 'dias'} de acesso completo e gratuito`
          : `${plan.daysLeft} ${plan.daysLeft === 1 ? 'dia' : 'dias'} de acesso gratuito`}
      </strong>
      <span>
        {plan.isTrainingStudent
          ? `Cortesia do treinamento financeiro do Leomar Campos, até ${formatDate(plan.trialEndsAt)}. Assine antes e continue sem nenhuma interrupção.`
          : `Até ${formatDate(plan.trialEndsAt)}. Depois você continua no Conora grátis com as quatro categorias liberadas, ou assina para o acesso completo.`}
      </span>
      <Timeline plan={plan} />
    </section>
  )
}

function Timeline({ plan }: { plan: Plan }) {
  const steps = [
    { key: 'Trial', day: 'Dia 1', title: 'Acesso completo', text: plan.isTrainingStudent ? 'Grátis para alunos' : 'Período inicial' },
    { key: 'Expired', day: `Dia ${TRIAL_DAYS}`, title: 'Conora grátis', text: 'Quatro categorias + consulta' },
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
