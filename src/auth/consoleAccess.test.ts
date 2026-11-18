import { describe, expect, it } from 'vitest'
import { consoleShell } from './consoleAccess'

const admin = 'flavio.barbosa.vix@gmail.com'
const other = 'demo.loja@conora.local'

describe('consoleShell', () => {
  it('shows the console shortcut outside and the exit plus menu inside for an operator', () => {
    expect(consoleShell(admin, '/')).toEqual({ menu: false, exit: false, entry: true })
    const inside = consoleShell(admin, '/console/usuarios')
    expect(inside).toEqual({ menu: true, exit: true, entry: false })
    expect(consoleShell(admin, '/')).toEqual({ menu: false, exit: false, entry: true })
  })

  it('hides every console entry for a non-operator, inside or outside', () => {
    expect(consoleShell(other, '/')).toEqual({ menu: false, exit: false, entry: false })
    expect(consoleShell(other, '/console/usuarios')).toEqual({ menu: false, exit: false, entry: false })
    expect(consoleShell(null, '/console')).toEqual({ menu: false, exit: false, entry: false })
  })
})
