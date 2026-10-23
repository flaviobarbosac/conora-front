import { Link, useNavigate } from 'react-router-dom'
import { gamificationApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { type IanAge, maturityAgeFromAchievements } from '../lib/speakPt'
import page from './page.module.css'
import styles from './JornadaRaioXPage.module.css'

type StepKind = 'start' | 'cadastro' | 'marco' | 'apex'

type TimelineStep = {
  id: string
  kind: StepKind
  title: string
  ianAge: IanAge
  ianLabel: string
  body: string
  action: string
  /** Journey API key for cadastro steps */
  journeyKey?: string
  route?: string
  /** Achievement keys — any earned marks the marco done */
  achievementKeys?: readonly string[]
}

const TIMELINE: TimelineStep[] = [
  {
    id: 'start',
    kind: 'start',
    title: 'Você nasceu aqui',
    ianAge: 0,
    ianLabel: 'Bebê',
    body: 'Estado inicial após o onboard. Ian começa bebê. A linha do tempo mostra o caminho até o adulto.',
    action: 'Início da jornada',
  },
  {
    id: 'budget',
    kind: 'cadastro',
    title: 'Orçamento',
    ianAge: 5,
    ianLabel: 'Criança',
    body: 'Renda, descontos e despesas. Primeira aula do Raio-X. Parcela mensal de dívida também entra aqui.',
    action: 'Cadastrar orçamento',
    journeyKey: 'budget',
    route: '/orcamento',
  },
  {
    id: 'debt',
    kind: 'cadastro',
    title: 'Dívidas (parcela mensal)',
    ianAge: 5,
    ianLabel: 'Criança',
    body: 'Parcelas do mês na categoria Dívidas. Separado do valor total da dívida.',
    action: 'Cadastrar dívidas',
    journeyKey: 'debt',
    route: '/orcamento',
  },
  {
    id: 'patrimony',
    kind: 'cadastro',
    title: 'Patrimônio',
    ianAge: 8,
    ianLabel: 'Criança',
    body: 'Ativo e passivo total (ex.: 20× R$ 1.000 → R$ 20 mil no passivo).',
    action: 'Cadastrar patrimônio',
    journeyKey: 'patrimony',
    route: '/patrimonio',
  },
  {
    id: 'projects',
    kind: 'cadastro',
    title: 'Projetos de vida',
    ianAge: 8,
    ianLabel: 'Criança',
    body: 'Fecha o bloco do Raio-X. Completar os 4 cadastros não vira adulto sozinho.',
    action: 'Cadastrar projetos',
    journeyKey: 'projects',
    route: '/projetos',
  },
  {
    id: 'first-month',
    kind: 'marco',
    title: 'Fechar o 1º mês',
    ianAge: 10,
    ianLabel: 'Pré-adolescente',
    body: 'Marco de constância. Não se pula etapa no dia 1.',
    action: 'Marco do sistema',
    achievementKeys: ['first-month-closed'],
  },
  {
    id: 'three-months',
    kind: 'marco',
    title: 'Três meses no orçamento',
    ianAge: 12,
    ianLabel: 'Pré-adolescente',
    body: 'Maturidade exige constância. Não adulto no 1º/2º mês.',
    action: 'Marco do sistema',
    achievementKeys: ['three-months-in-budget'],
  },
  {
    id: 'on-time',
    kind: 'marco',
    title: 'Pagamentos e orçamento em dia',
    ianAge: 15,
    ianLabel: 'Adolescente',
    body: 'Retrato e voz acompanham a idade.',
    action: 'Marco do sistema',
    achievementKeys: ['payment-on-time', 'budget-on-time'],
  },
  {
    id: 'reserve-start',
    kind: 'marco',
    title: 'Reserva iniciada',
    ianAge: 18,
    ianLabel: 'Jovem',
    body: 'Avanço na maturidade sem travar o aplicativo.',
    action: 'Marco do sistema',
    achievementKeys: ['reserve-started', 'has-reserve'],
  },
  {
    id: 'reserve-complete',
    kind: 'marco',
    title: 'Reserva completa',
    ianAge: 22,
    ianLabel: 'Jovem adulto',
    body: 'Cumprir o 22 pode levar direto ao 30 (ápice).',
    action: 'Marco do sistema',
    achievementKeys: ['reserve-complete'],
  },
  {
    id: 'apex',
    kind: 'apex',
    title: 'Progresso em projeto · Ápice',
    ianAge: 30,
    ianLabel: 'Adulto',
    body: 'Ian adulto. Cadastros + marcos. Uso pleno. Congela no ápice.',
    action: 'Uso pleno',
    achievementKeys: ['project-progress'],
    route: '/projetos',
  },
]

function kindLabel(kind: StepKind): string {
  if (kind === 'start') return 'Início'
  if (kind === 'cadastro') return 'Cadastro'
  if (kind === 'marco') return 'Marco'
  return 'Ápice'
}

function chipClass(kind: StepKind): string {
  if (kind === 'cadastro') return `${styles.chip} ${styles.chipCadastro}`
  if (kind === 'marco') return `${styles.chip} ${styles.chipMarco}`
  if (kind === 'apex') return `${styles.chip} ${styles.chipApex}`
  return styles.chip
}

function portraitUrl(age: IanAge): string {
  return `${import.meta.env.BASE_URL}assets/ian-garoto-${String(age).padStart(2, '0')}.png`
}

export function JornadaRaioXPage() {
  const navigate = useNavigate()
  const journey = useLoad(() => gamificationApi.journey(), [])
  const achievements = useLoad(() => gamificationApi.achievements(), [])

  const journeyByKey = new Map((journey.data?.steps ?? []).map((s) => [s.key, s]))
  const earned = new Set(
    (achievements.data?.items ?? []).filter((i) => i.earned).map((i) => i.key),
  )

  const maturityAge = maturityAgeFromAchievements(achievements.data?.items ?? [])

  function isDone(step: TimelineStep): boolean {
    if (step.kind === 'start') return true
    if (step.journeyKey) {
      return journeyByKey.get(step.journeyKey)?.completed === true
    }
    if (step.achievementKeys?.length) {
      return step.achievementKeys.some((key) => earned.has(key))
    }
    return false
  }

  const doneFlags = TIMELINE.map(isDone)
  const nextIndex = doneFlags.findIndex((done) => !done)
  const doneCount = doneFlags.filter(Boolean).length
  const pct = Math.round((doneCount / TIMELINE.length) * 100)
  const loading = (journey.loading && !journey.data) || (achievements.loading && !achievements.data)

  return (
    <div className={`${page.page} ${styles.wrap}`}>
      <PageHeader kicker="Raio-X" title="Jornada Raio X" />
      <ErrorText message={journey.error ?? achievements.error} />
      {loading ? <Loading /> : null}

      <section className={styles.headerCard} aria-label="Progresso da jornada">
        <p className={styles.kicker}>
          Maturidade · Ian {maturityAge === 0 ? 'bebê' : `${maturityAge} anos`}
        </p>
        <p className={styles.headerTitle}>
          {doneCount} de {TIMELINE.length} passos · não trava lançamentos
        </p>
        <div className={page.journeyProgress}>
          <div className={page.journeyProgressLabel}>
            <span>Progresso da jornada</span>
            <span>{pct}%</span>
          </div>
          <div
            className={page.journeyTrack}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da jornada Raio X"
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <ol className={styles.timeline} aria-label="Linha do tempo da jornada">
        {TIMELINE.map((step, i) => {
          const done = doneFlags[i]!
          const isNext = i === nextIndex
          const isLast = i === TIMELINE.length - 1
          const showAgePhoto = i === 0 || TIMELINE[i - 1]!.ianAge !== step.ianAge
          const cardClass = [
            styles.card,
            done ? styles.cardDone : '',
            isNext ? styles.cardNext : '',
            isLast ? styles.cardLast : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <li key={step.id} className={styles.row}>
              <div className={styles.rail} aria-hidden>
                {showAgePhoto ? (
                  <img
                    className={`${styles.portrait}${isNext ? ` ${styles.portraitNext}` : ''}`}
                    src={portraitUrl(step.ianAge)}
                    alt=""
                    width={40}
                    height={40}
                  />
                ) : (
                  <span
                    className={`${styles.dot}${done ? ` ${styles.dotDone}` : ''}${
                      isNext ? ` ${styles.dotNext}` : ''
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                )}
                {!isLast ? (
                  <span className={`${styles.line}${done ? ` ${styles.lineDone}` : ''}`} />
                ) : null}
              </div>

              <article className={cardClass}>
                <div className={styles.meta}>
                  <span className={chipClass(step.kind)}>{kindLabel(step.kind)}</span>
                  <span className={styles.ageLabel}>
                    Ian {step.ianAge}a · {step.ianLabel}
                  </span>
                </div>
                <h2 className={styles.cardTitle}>{step.title}</h2>
                <p className={styles.cardAction}>{step.action}</p>
                {isNext ? <p className={styles.cardBody}>{step.body}</p> : null}
                {isNext && step.route && step.kind === 'cadastro' ? (
                  <Link className={styles.cta} to={step.route}>
                    {step.action}
                  </Link>
                ) : null}
                {isNext && step.kind === 'apex' && step.route ? (
                  <Link className={styles.cta} to={step.route}>
                    Ver projetos
                  </Link>
                ) : null}
              </article>
            </li>
          )
        })}
      </ol>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Continuar no aplicativo
        </Button>
        <p className={styles.footerHint}>
          Lançamentos liberados · a linha do tempo volta enquanto houver pendência
        </p>
      </div>
    </div>
  )
}
