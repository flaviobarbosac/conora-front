import styles from '../pages/PlanPage.module.css'

type Props = {
  acceptContract: boolean
  acceptLgpd: boolean
  onAcceptContract: (value: boolean) => void
  onAcceptLgpd: (value: boolean) => void
}

/** Contract + cancellation + LGPD — only at paid-plan checkout. Free tier has no LGPD checkbox. */
export function LegalConsentPanel({
  acceptContract,
  acceptLgpd,
  onAcceptContract,
  onAcceptLgpd,
}: Props) {
  return (
    <section className={styles.included} aria-label="Contrato, cancelamento e LGPD">
      <h2>Antes de pagar</h2>
      <p className={styles.people}>
        O aceite abaixo vale só no pagamento de um plano pago. No acesso gratuito não há exigência de
        assinatura da LGPD.
      </p>

      <article className={styles.legalBlock}>
        <h3>Contrato de uso</h3>
        <div className={styles.legalScroll} tabIndex={0}>
          <p>
            O Conora é um serviço de organização financeira pessoal e familiar. Ao assinar, você recebe
            acesso às funcionalidades do plano escolhido (Individual, Duo ou Family) pelo ciclo mensal ou
            anual. Os dados financeiros que você lança são seus; o Conora processa esses dados para
            prestar o serviço (orçamento, raio-x, alertas, assistente Ian e exportações).
          </p>
          <p>
            A cobrança é feita pela Google Play ou pela App Store, conforme a loja da sua conta. O valor
            exibido no app espelha o catálogo vigente (Individual R$&nbsp;49,90, Duo R$&nbsp;59,90, Family
            R$&nbsp;79,00 mensais; o anual equivale a 10 mensalidades).
          </p>
          <p>
            É proibido usar o Conora para fins ilícitos, tentar acessar dados de outros clientes ou
            sobrecarregar a infraestrutura. O Conora pode suspender o acesso em caso de abuso ou
            inadimplência após o período de graça previsto no plano.
          </p>
        </div>
      </article>

      <article className={styles.legalBlock}>
        <h3>Política de cancelamento</h3>
        <div className={styles.legalScroll} tabIndex={0}>
          <p>
            O cancelamento é feito na loja em que a assinatura foi comprada (Google Play ou App Store).
            Não há multa de cancelamento. O acesso permanece ativo até o fim do período já pago.
          </p>
          <p>
            Renovações automáticas seguem as regras da loja. Após o fim do período pago, a conta entra
            em modo somente leitura e, depois do prazo de graça, pode ser bloqueada — seus dados
            continuam disponíveis para exportação enquanto a conta existir.
          </p>
        </div>
      </article>

      <article className={styles.legalBlock}>
        <h3>LGPD — processos satélites</h3>
        <div className={styles.legalScroll} tabIndex={0}>
          <p>
            Tratamos dados pessoais (nome, e-mail, telefone, CEP, CPF quando informado e lançamentos
            financeiros) para executar o contrato. Base legal: execução de contrato e legítimo
            interesse operacional (segurança e melhoria do serviço).
          </p>
          <p>
            Processos satélites (disponíveis em qualquer tier): <strong>exportar meus dados</strong> e{' '}
            <strong>excluir conta</strong> em Configurações. O aceite ciente da LGPD é exigido somente
            neste checkout de plano pago. Termos em{' '}
            <a href="https://conora.com.br/termos" target="_blank" rel="noreferrer">
              conora.com.br/termos
            </a>
            .
          </p>
        </div>
      </article>

      <label className={styles.people}>
        <input
          type="checkbox"
          checked={acceptContract}
          onChange={(event) => onAcceptContract(event.target.checked)}
        />{' '}
        Li e aceito o contrato de uso e a política de cancelamento.
      </label>
      <label className={styles.people}>
        <input type="checkbox" checked={acceptLgpd} onChange={(event) => onAcceptLgpd(event.target.checked)} />{' '}
        Autorizo o tratamento dos meus dados conforme a LGPD e os processos satélites descritos.
      </label>
    </section>
  )
}
