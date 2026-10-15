const OPERATORS = new Set(['flaviobarbosa.vix@gmail.com', 'leolelcampos2009@gmail.com'])

export function isConsoleOperator(email: string | null | undefined): boolean {
  return OPERATORS.has((email ?? '').trim().toLowerCase())
}
