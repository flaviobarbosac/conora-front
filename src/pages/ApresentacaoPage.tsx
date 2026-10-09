import { Link, useNavigate } from 'react-router-dom'
import { BrandLockup } from '../components/BrandLockup'
import { Button } from '../components/ui/Button'
import { useTheme } from '../theme/ThemeProvider'
import styles from './apresentacao.module.css'

const BLOCKS = [
  {
    title: 'O que é o Onra',
    text: 'App para a família organizar o dinheiro com clareza — orçamento, patrimônio e acompanhamento mês a mês.',
  },
  {
    title: 'Orçamento',
    text: 'Planeje por conta e compare previsto com realizado. O Raio-X mostra o balancete e o detalhe de cada lançamento.',
  },
  {
    title: 'Patrimônio',
    text: 'Ativos, passivos e patrimônio líquido em uma visão separada do fluxo mensal — sem misturar com o orçamento.',
  },
  {
    title: 'Raio-X',
    text: 'Visão em árvore do plano de contas: receita, descontos, projetos, essenciais e social, com drill-down até o lançamento.',
  },
] as const

export function ApresentacaoPage() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const illustration = `${import.meta.env.BASE_URL}brand/${theme === 'dark' ? 'ilustracao-escura' : 'ilustracao-login'}.jpg`

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <BrandLockup size="auth" />
        <Link to="/login" className={styles.loginLink}>
          Entrar
        </Link>
      </header>

      <section className={styles.hero}>
        <img className={styles.heroImage} src={illustration} alt="" />
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Conora · Onra</p>
          <h1>Organize o dinheiro da família com clareza</h1>
          <p className={styles.lead}>
            Orçamento e patrimônio em um só app, com visão macro e detalhe por conta — pronto para acompanhar
            valores altos sem perder a precisão.
          </p>
          <div className={styles.actions}>
            <Button onClick={() => navigate('/register')}>Criar conta</Button>
            <Button variant="secondary" onClick={() => navigate('/login')}>
              Já tenho conta
            </Button>
          </div>
        </div>
      </section>

      <section className={styles.blocks} aria-label="O produto">
        {BLOCKS.map((block) => (
          <article key={block.title} className={styles.card}>
            <h2>{block.title}</h2>
            <p>{block.text}</p>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>
          <a href="https://conora.com.br/privacidade" target="_blank" rel="noreferrer">
            Privacidade
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://conora.com.br/termos" target="_blank" rel="noreferrer">
            Termos
          </a>
        </p>
      </footer>
    </div>
  )
}
