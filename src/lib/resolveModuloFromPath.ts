export type ModuloRouteItem = { path: string; label: string }

/** Resolve the module label from the current route (longest matching prefix wins). */
export function resolveModuloFromPath(
  pathname: string,
  items: ModuloRouteItem[],
  fallback = 'Geral',
): { modulo: string; rota: string } {
  const rota = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  const sorted = [...items].sort((a, b) => b.path.length - a.path.length)
  const match = sorted.find((i) => {
    const base = i.path.replace(/\/+$/, '') || '/'
    return rota === base || rota.startsWith(`${base}/`)
  })
  return { modulo: match?.label ?? fallback, rota }
}
