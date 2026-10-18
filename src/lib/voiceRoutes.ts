/** Paths the voice command may open. Mirrors the app routes. */
const ROUTES = new Set([
  '/',
  '/orcamento',
  '/raio-x',
  '/lancamentos',
  '/categorias',
  '/contas',
  '/cartoes',
  '/projetos',
  '/patrimonio',
  '/membros',
  '/marcos',
  '/relatorios',
  '/diagnostico',
  '/importar',
  '/mes',
  '/perfil',
  '/configuracoes',
  '/ajuda',
  '/plano',
  '/whatsapp',
  '/ia',
])

export function isVoiceRoute(route: string | null | undefined): route is string {
  return Boolean(route && ROUTES.has(route))
}
