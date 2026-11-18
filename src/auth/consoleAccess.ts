const OPERATORS = new Set([
  'flaviobarbosa.vix@gmail.com',
  'flavio.barbosa.vix@gmail.com',
  'lelcampos2009@gmail.com',
  'lelcampos34@gmail.com',
])

export function isConsoleOperator(email: string | null | undefined): boolean {
  return OPERATORS.has((email ?? '').trim().toLowerCase())
}

/** Sidebar chrome for the operator console. Non-operators see none of it. */
export function consoleShell(email: string | null | undefined, pathname: string) {
  const admin = isConsoleOperator(email)
  const inside = pathname.includes('/console')
  return {
    menu: admin && inside,
    exit: admin && inside,
    entry: admin && !inside,
  }
}
