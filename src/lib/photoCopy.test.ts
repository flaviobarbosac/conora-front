import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('receipt photo copy', () => {
  it('asks to fill the gaps and refuses with the commercial message', () => {
    const source = readFileSync(new URL('./receiptFlow.ts', import.meta.url), 'utf8')
    expect(source).toContain('Não consegui ler tudo nesta foto. Quer preencher o que faltou?')
    expect(source).toContain(
      'Sem problema. Manda uma foto mais nítida, com o CNPJ, o nome de quem recebeu, a data e o valor bem visíveis. Aí eu lanço pra você.',
    )
  })
})
